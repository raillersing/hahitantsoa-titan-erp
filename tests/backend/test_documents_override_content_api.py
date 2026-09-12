from datetime import timedelta
from hashlib import sha256
from pathlib import Path
from uuid import uuid4

import pytest
from django.conf import settings
from django.core.files.storage import FileSystemStorage
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

import apps.documents.runtime as runtime_module
from apps.audit.models import AuditEvent
from apps.customers.models import Customer
from apps.documents.models import DocumentInstanceStatus
from apps.documents.runtime import DocumentRuntimeGenerationError
from apps.documents.services import (
    create_document_instance_from_hahitantsoa_event_draft,
    create_document_instance_from_reservation_draft,
    override_document_instance_content,
)
from apps.documents.views import (
    DocumentInstanceOverrideContentAPIView,
    DocumentInstanceRetrieveAPIView,
)
from apps.hahitantsoa.models import HahitantsoaEventDraft
from apps.reservations.models import ReservationDraft

pytestmark = pytest.mark.django_db(transaction=True)


@pytest.fixture
def api_factory():
    return APIRequestFactory()


@pytest.fixture
def sensitive_user(django_user_model):
    user, _ = django_user_model.objects.get_or_create(
        username="doc-override-sensitive",
        defaults={"is_staff": True},
    )
    return user


@pytest.fixture
def non_sensitive_user(django_user_model):
    user, _ = django_user_model.objects.get_or_create(
        username="doc-override-normal",
        defaults={"is_staff": False},
    )
    return user


@pytest.fixture(autouse=True)
def isolated_document_storage(tmp_path, monkeypatch):
    storage = FileSystemStorage(location=str(tmp_path))
    monkeypatch.setattr("django.core.files.storage.default_storage", storage)
    monkeypatch.setattr(runtime_module, "default_storage", storage)
    return storage


def _customer() -> Customer:
    return Customer.objects.create(
        display_name="Client Test",
        email="client@example.test",
        phone="+261340000001",
        address="Antananarivo",
    )


def _reservation_draft() -> ReservationDraft:
    start_at = timezone.now().replace(microsecond=0) + timedelta(days=2)
    return ReservationDraft.objects.create(
        customer=_customer(),
        start_at=start_at,
        end_at=start_at + timedelta(hours=4),
        notes="Reservation test",
    )


def _event_draft() -> HahitantsoaEventDraft:
    start_at = timezone.now().replace(microsecond=0) + timedelta(days=3)
    return HahitantsoaEventDraft.objects.create(
        customer=_customer(),
        start_at=start_at,
        end_at=start_at + timedelta(hours=6),
        notes="Hahitantsoa test event",
    )


def test_table_headers_have_no_bottom_border_in_commercial_templates():
    templates_dir = Path(settings.BASE_DIR) / "apps" / "documents" / "templates" / "documents"

    # 1. Proforma and invoice templates must not have border-bottom on .items th
    for template_name in [
        "titan_proforma.html",
        "titan_invoice.html",
        "hahitantsoa_proforma.html",
        "hahitantsoa_invoice.html",
        "titan_breakage_repair_invoice.html",
        "hahitantsoa_breakage_repair_invoice.html",
    ]:
        content = (templates_dir / template_name).read_text(encoding="utf-8")
        assert "border-bottom: 0.3mm solid #444444;" not in content
        assert ".items th" in content

    # 2. Constructed family CSS must not have border-bottom on .document-table th
    constructed_css = (templates_dir / "partials" / "constructed_document_family.css").read_text(
        encoding="utf-8"
    )
    assert "border-bottom: 0.35mm solid #555555;" not in constructed_css
    assert ".document-table th" in constructed_css

    # 3. Hahitantsoa contract CSS must not have border-bottom on .breakage-table th
    contract_css = (templates_dir / "partials" / "hahitantsoa_contract.css").read_text(
        encoding="utf-8"
    )
    assert ".breakage-table th {" in contract_css
    assert (
        "border-bottom: 0.25mm solid #cbd5e1;"
        not in contract_css.split(".breakage-table th {")[1].split("}")[0]
    )


def test_override_document_instance_content_service_success_hahitantsoa(
    sensitive_user, isolated_document_storage
):
    event_draft = _event_draft()
    instance = create_document_instance_from_hahitantsoa_event_draft(
        event_draft=event_draft,
        template_key="hahitantsoa.preparation_sheet.v1",
        actor=sensitive_user,
    )
    assert instance.status == DocumentInstanceStatus.PREPARED

    custom_html = "<!doctype html><html><body><h1>Checking Custom</h1><p>Vérifié</p></body></html>"
    override_document_instance_content(
        document_instance_id=instance.id,
        html_content=custom_html,
        actor=sensitive_user,
    )

    instance.refresh_from_db()
    assert instance.status == DocumentInstanceStatus.GENERATED
    assert instance.storage_path is not None
    assert instance.pdf_storage_path is not None
    assert instance.content_checksum == sha256(custom_html.encode("utf-8")).hexdigest()
    assert instance.generated_content_size_bytes == len(custom_html.encode("utf-8"))

    with isolated_document_storage.open(instance.storage_path) as f:
        stored_content = f.read().decode("utf-8")
    assert stored_content == custom_html

    assert AuditEvent.objects.filter(
        action="document.instance_content_overridden",
        target_id=str(instance.id),
    ).exists()


def test_override_document_instance_content_service_success_shared(
    sensitive_user, isolated_document_storage
):
    draft = _reservation_draft()
    instance = create_document_instance_from_reservation_draft(
        reservation_draft=draft,
        template_key="shared.preparation_sheet.v1",
        actor=sensitive_user,
    )

    custom_html = (
        "<html><body><table><tr><th>Article</th><th>Qté</th></tr>"
        "<tr><td>Chaise</td><td>10</td></tr></table></body></html>"
    )
    override_document_instance_content(
        document_instance_id=instance.id,
        html_content=custom_html,
        actor=sensitive_user,
    )

    instance.refresh_from_db()
    assert instance.status == DocumentInstanceStatus.GENERATED
    with isolated_document_storage.open(instance.storage_path) as f:
        assert f.read().decode("utf-8") == custom_html


def test_override_document_instance_content_rejects_disallowed_template(sensitive_user):
    draft = _reservation_draft()
    instance = create_document_instance_from_reservation_draft(
        reservation_draft=draft,
        template_key="titan.proforma.v1",
        actor=sensitive_user,
    )

    with pytest.raises(DocumentRuntimeGenerationError) as exc_info:
        override_document_instance_content(
            document_instance_id=instance.id,
            html_content="<p>Not allowed</p>",
            actor=sensitive_user,
        )
    assert exc_info.value.code == "document_content_override_not_allowed"


def test_override_document_instance_content_rejects_empty_content(sensitive_user):
    draft = _reservation_draft()
    instance = create_document_instance_from_reservation_draft(
        reservation_draft=draft,
        template_key="shared.preparation_sheet.v1",
        actor=sensitive_user,
    )

    with pytest.raises(DocumentRuntimeGenerationError) as exc_info:
        override_document_instance_content(
            document_instance_id=instance.id,
            html_content="   ",
            actor=sensitive_user,
        )
    assert exc_info.value.code == "empty_html_content"


def test_override_document_instance_content_rejects_voided_instance(sensitive_user):
    draft = _reservation_draft()
    instance = create_document_instance_from_reservation_draft(
        reservation_draft=draft,
        template_key="shared.preparation_sheet.v1",
        actor=sensitive_user,
    )
    instance.status = DocumentInstanceStatus.VOIDED
    instance.voided_at = timezone.now()
    instance.voided_by = sensitive_user
    instance.save()

    with pytest.raises(DocumentRuntimeGenerationError) as exc_info:
        override_document_instance_content(
            document_instance_id=instance.id,
            html_content="<p>Voided</p>",
            actor=sensitive_user,
        )
    assert exc_info.value.code == "document_instance_voided"


def test_override_content_api_endpoint(
    api_factory, sensitive_user, non_sensitive_user, isolated_document_storage
):
    draft = _reservation_draft()
    instance = create_document_instance_from_reservation_draft(
        reservation_draft=draft,
        template_key="shared.preparation_sheet.v1",
        actor=sensitive_user,
    )

    view = DocumentInstanceOverrideContentAPIView.as_view()
    url = f"/api/v1/documents/instances/{instance.id}/override-content/"

    # 1. Unauthenticated -> 401/403
    req = api_factory.post(url, {"html_content": "<p>Test</p>"}, format="json")
    resp = view(req, id=instance.id)
    assert resp.status_code in (401, 403)

    # 2. Non-sensitive authenticated user -> 403
    req = api_factory.post(url, {"html_content": "<p>Test</p>"}, format="json")
    force_authenticate(req, user=non_sensitive_user)
    resp = view(req, id=instance.id)
    assert resp.status_code == 403

    # 3. Sensitive user -> 200 OK
    custom_html = "<html><body><h1>Live Edited Passation</h1></body></html>"
    req = api_factory.post(url, {"html_content": custom_html}, format="json")
    force_authenticate(req, user=sensitive_user)
    resp = view(req, id=instance.id)
    assert resp.status_code == 200
    assert resp.data["id"] == str(instance.id)
    assert resp.data["status"] == DocumentInstanceStatus.GENERATED

    instance.refresh_from_db()
    with isolated_document_storage.open(instance.storage_path) as f:
        assert f.read().decode("utf-8") == custom_html

    # 4. Bad request on empty html
    req = api_factory.post(url, {"html_content": "  "}, format="json")
    force_authenticate(req, user=sensitive_user)
    resp = view(req, id=instance.id)
    assert resp.status_code == 400

    # 5. 404 on unknown instance
    req = api_factory.post(
        f"/api/v1/documents/instances/{uuid4()}/override-content/",
        {"html_content": "<p>Test</p>"},
        format="json",
    )
    force_authenticate(req, user=sensitive_user)
    resp = view(req, id=uuid4())
    assert resp.status_code == 404


def test_document_instance_retrieve_api_endpoint(api_factory, sensitive_user):
    draft = _reservation_draft()
    instance = create_document_instance_from_reservation_draft(
        reservation_draft=draft,
        template_key="shared.preparation_sheet.v1",
        actor=sensitive_user,
    )

    view = DocumentInstanceRetrieveAPIView.as_view()
    url = f"/api/v1/documents/instances/{instance.id}/"

    req = api_factory.get(url)
    force_authenticate(req, user=sensitive_user)
    resp = view(req, id=instance.id)
    assert resp.status_code == 200
    assert resp.data["id"] == str(instance.id)
    assert resp.data["template_key"] == "shared.preparation_sheet.v1"

    # 404 on unknown
    req = api_factory.get(f"/api/v1/documents/instances/{uuid4()}/")
    force_authenticate(req, user=sensitive_user)
    resp = view(req, id=uuid4())
    assert resp.status_code == 404
