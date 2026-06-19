import sys
from datetime import timedelta

import pytest
from django.contrib.auth.models import Group
from django.core.files.storage import FileSystemStorage
from django.utils import timezone

import apps.documents.runtime as runtime_module
from apps.audit.models import AuditEvent
from apps.customers.models import Customer
from apps.documents.models import DocumentInstance, DocumentInstanceStatus
from apps.identity.roles import IdentityRole
from apps.inventory.models import InventoryAvailability, InventoryItem
from apps.reservations.models import ReservationDraft, ReservationDraftLine

pytestmark = pytest.mark.django_db


@pytest.fixture
def authenticated_user(django_user_model):
    return django_user_model.objects.create_user(
        username="docs-api-user",
        password="test-pass",
    )


@pytest.fixture
def authenticated_client(client, authenticated_user):
    client.force_login(authenticated_user)
    return client


@pytest.fixture
def sensitive_user(django_user_model):
    return django_user_model.objects.create_user(
        username="docs-sensitive-user",
        password="test-pass",
        is_staff=True,
    )


@pytest.fixture
def sensitive_client(client, sensitive_user):
    client.force_login(sensitive_user)
    return client


@pytest.fixture(autouse=True)
def isolated_document_storage(tmp_path, monkeypatch):
    storage = FileSystemStorage(location=str(tmp_path))
    monkeypatch.setattr(runtime_module, "default_storage", storage)
    monkeypatch.setattr(sys.modules[__name__], "FileSystemStorage", FileSystemStorage)
    return storage


def _customer() -> Customer:
    return Customer.objects.create(
        display_name="Client documents API",
        email="docs-api@example.test",
        phone="+261340000111",
        address="Antananarivo",
    )


def _item(*, name: str = "Projecteur Titan", kind: str = "material") -> InventoryItem:
    return InventoryItem.objects.create(
        name=name,
        kind=kind,
        description="Description inventory",
    )


def _draft(*, customer: Customer | None = None) -> ReservationDraft:
    start_at = timezone.now().replace(microsecond=0) + timedelta(days=2)
    end_at = start_at + timedelta(hours=4)
    return ReservationDraft.objects.create(
        customer=customer or _customer(),
        start_at=start_at,
        end_at=end_at,
        notes="Reservation draft notes",
    )


def _draft_with_line() -> ReservationDraft:
    draft = _draft()
    ReservationDraftLine.objects.create(
        reservation_draft=draft,
        inventory_item=_item(),
        quantity=2,
        notes="Line note",
    )
    return draft


def _list_url(draft_id) -> str:
    return f"/api/v1/documents/reservation-drafts/{draft_id}/instances/"


def _detail_url(draft_id, instance_id) -> str:
    return f"/api/v1/documents/reservation-drafts/{draft_id}/instances/{instance_id}/"


def _generate_url(draft_id, instance_id) -> str:
    return f"/api/v1/documents/reservation-drafts/{draft_id}/instances/{instance_id}/generate/"


def test_document_instance_list_create_requires_authentication(client) -> None:
    draft = _draft_with_line()

    response = client.get(_list_url(draft.id))

    assert response.status_code in {401, 403}


def test_document_instance_create_requires_sensitive_access(authenticated_client) -> None:
    draft = _draft_with_line()

    response = authenticated_client.post(
        _list_url(draft.id),
        data={"template_key": "titan.proforma.v1", "notes": "Prepared for review"},
        content_type="application/json",
    )

    assert response.status_code == 403


def test_sensitive_staff_can_create_and_list_reservation_draft_document_instances(
    sensitive_client,
    sensitive_user,
    django_capture_on_commit_callbacks,
) -> None:
    draft = _draft_with_line()

    with django_capture_on_commit_callbacks(execute=True):
        create_response = sensitive_client.post(
            _list_url(draft.id),
            data={"template_key": "titan.proforma.v1", "notes": "Prepared for review"},
            content_type="application/json",
        )

    assert create_response.status_code == 201
    created_payload = create_response.json()
    assert created_payload["reservation_draft"] == str(draft.id)
    assert created_payload["template_key"] == "titan.proforma.v1"
    assert created_payload["status"] == DocumentInstanceStatus.PREPARED
    assert created_payload["notes"] == "Prepared for review"
    assert created_payload["content_checksum"] is None
    assert created_payload["storage_path"] is None

    list_response = sensitive_client.get(_list_url(draft.id))

    assert list_response.status_code == 200
    payload = list_response.json()
    assert len(payload) == 1
    assert payload[0]["id"] == created_payload["id"]
    assert payload[0]["template_label"] == "Proforma Titan"

    audit_event = AuditEvent.objects.filter(action="document.instance_prepared").first()
    assert audit_event is not None
    assert audit_event.actor_id == sensitive_user.id
    assert audit_event.target_id == created_payload["id"]


def test_group_mapped_sensitive_actor_can_create_document_instance(
    client,
    django_user_model,
    django_capture_on_commit_callbacks,
) -> None:
    mapped_user = django_user_model.objects.create_user(
        username="docs-sensitive-group",
        password="test-pass",
        is_staff=False,
    )
    mapped_user.groups.add(
        Group.objects.create(name=IdentityRole.RESERVATION_SENSITIVE_OPERATOR.value)
    )
    draft = _draft_with_line()

    client.force_login(mapped_user)
    with django_capture_on_commit_callbacks(execute=True):
        response = client.post(
            _list_url(draft.id),
            data={"template_key": "titan.proforma.v1", "notes": "Prepared for review"},
            content_type="application/json",
        )

    assert response.status_code == 201


def test_authenticated_user_can_list_reservation_draft_document_instances(
    authenticated_client,
) -> None:
    draft = _draft_with_line()
    instance = DocumentInstance.objects.create(
        reservation_draft=draft,
        customer=draft.customer,
        template_key="titan.proforma.v1",
        template_version="v1",
        template_label="Proforma Titan",
        business_scope="titan",
        document_type="proforma",
        template_status="validated_source_template",
        template_source_kind="source_pdf",
        template_source_reference="docs/references/source/Document_A.pdf",
        template_path="backend/apps/documents/templates_documents/titan/proforma/v1/template.html",
        template_preview_path="backend/apps/documents/templates_documents/titan/proforma/v1/preview.pdf",
        template_validated_by_client=True,
        template_notes="Prepared for review",
        reservation_public_reference=draft.public_reference,
        reservation_status=draft.status,
        customer_display_name=draft.customer.display_name,
        customer_email=draft.customer.email,
        customer_phone=draft.customer.phone,
        customer_address=draft.customer.address,
        status=DocumentInstanceStatus.PREPARED,
    )

    list_response = authenticated_client.get(_list_url(draft.id))

    assert list_response.status_code == 200
    payload = list_response.json()
    assert len(payload) == 1
    assert payload[0]["id"] == str(instance.id)
    assert payload[0]["template_label"] == "Proforma Titan"


def test_document_instance_detail_and_generate_keep_reservation_and_inventory_unchanged(
    sensitive_client,
    django_capture_on_commit_callbacks,
) -> None:
    draft = _draft_with_line()
    before = {
        "draft_status": draft.status,
        "draft_updated_at": draft.updated_at,
        "availability_count": InventoryAvailability.objects.count(),
        "line_count": draft.lines.count(),
    }
    instance = DocumentInstance.objects.create(
        reservation_draft=draft,
        customer=draft.customer,
        template_key="titan.proforma.v1",
        template_version="v1",
        template_label="Proforma Titan",
        business_scope="titan",
        document_type="proforma",
        template_status="validated_source_template",
        template_source_kind="source_pdf",
        template_source_reference="docs/references/source/Document_A.pdf",
        template_path="backend/apps/documents/templates_documents/titan/proforma/v1/template.html",
        template_preview_path="backend/apps/documents/templates_documents/titan/proforma/v1/preview.pdf",
        template_validated_by_client=True,
        template_notes="Template notes",
        reservation_public_reference=draft.public_reference,
        reservation_status=draft.status,
        customer_display_name=draft.customer.display_name,
        customer_email=draft.customer.email,
        customer_phone=draft.customer.phone,
        customer_address=draft.customer.address,
    )

    detail_response = sensitive_client.get(_detail_url(draft.id, instance.id))

    assert detail_response.status_code == 200
    assert detail_response.json()["id"] == str(instance.id)

    with django_capture_on_commit_callbacks(execute=True):
        generate_response = sensitive_client.post(_generate_url(draft.id, instance.id))

    assert generate_response.status_code == 200
    generated_payload = generate_response.json()
    assert generated_payload["id"] == str(instance.id)
    assert generated_payload["status"] == DocumentInstanceStatus.GENERATED
    assert generated_payload["content_checksum"]
    assert generated_payload["storage_path"].endswith(".html")
    assert generated_payload["generated_content_size_bytes"] > 0

    draft.refresh_from_db()
    instance.refresh_from_db()
    assert draft.status == before["draft_status"]
    assert draft.updated_at == before["draft_updated_at"]
    assert draft.lines.count() == before["line_count"]
    assert InventoryAvailability.objects.count() == before["availability_count"]
    assert instance.status == DocumentInstanceStatus.GENERATED

    audit_events = AuditEvent.objects.filter(
        action__in={"document.instance_prepared", "document.instance_generated"}
    )
    assert audit_events.filter(
        action="document.instance_generated", target_id=str(instance.id)
    ).exists()


def test_document_instance_generate_requires_sensitive_access(authenticated_client) -> None:
    draft = _draft_with_line()
    instance = DocumentInstance.objects.create(
        reservation_draft=draft,
        customer=draft.customer,
        template_key="titan.proforma.v1",
        template_version="v1",
        template_label="Proforma Titan",
        business_scope="titan",
        document_type="proforma",
        template_status="validated_source_template",
        template_source_kind="source_pdf",
        template_source_reference="docs/references/source/Document_A.pdf",
        template_path="backend/apps/documents/templates_documents/titan/proforma/v1/template.html",
        template_preview_path="backend/apps/documents/templates_documents/titan/proforma/v1/preview.pdf",
        template_validated_by_client=True,
        template_notes="Template notes",
        reservation_public_reference=draft.public_reference,
        reservation_status=draft.status,
        customer_display_name=draft.customer.display_name,
        customer_email=draft.customer.email,
        customer_phone=draft.customer.phone,
        customer_address=draft.customer.address,
        status=DocumentInstanceStatus.PREPARED,
    )

    response = authenticated_client.post(_generate_url(draft.id, instance.id))

    assert response.status_code == 403


def test_document_instance_detail_and_generate_return_404_for_wrong_reservation_draft_path(
    sensitive_client,
) -> None:
    draft = _draft_with_line()
    other_draft = _draft_with_line()
    instance = DocumentInstance.objects.create(
        reservation_draft=draft,
        customer=draft.customer,
        template_key="titan.proforma.v1",
        template_version="v1",
        template_label="Proforma Titan",
        business_scope="titan",
        document_type="proforma",
        template_status="validated_source_template",
        template_source_kind="source_pdf",
        template_source_reference="docs/references/source/Document_A.pdf",
        template_path="backend/apps/documents/templates_documents/titan/proforma/v1/template.html",
        template_preview_path="backend/apps/documents/templates_documents/titan/proforma/v1/preview.pdf",
        template_validated_by_client=True,
        template_notes="Template notes",
        reservation_public_reference=draft.public_reference,
        reservation_status=draft.status,
        customer_display_name=draft.customer.display_name,
        customer_email=draft.customer.email,
        customer_phone=draft.customer.phone,
        customer_address=draft.customer.address,
    )

    detail_response = sensitive_client.get(_detail_url(other_draft.id, instance.id))
    generate_response = sensitive_client.post(_generate_url(other_draft.id, instance.id))

    assert detail_response.status_code == 404
    assert generate_response.status_code == 404


def test_document_instance_create_rejects_unsupported_template_key(sensitive_client) -> None:
    draft = _draft_with_line()

    response = sensitive_client.post(
        _list_url(draft.id),
        data={"template_key": "shared.payment_receipt.v1"},
        content_type="application/json",
    )

    assert response.status_code == 400
    payload = response.json()
    assert "template_key" in payload


@pytest.mark.parametrize(
    ("template_key", "expected_label"),
    (
        ("titan.delivery_note.v1", "Bon de livraison Titan"),
        ("shared.return_note.v1", "Bon de retour"),
    ),
)
def test_document_instance_create_supports_logistics_note_templates(
    sensitive_client,
    django_capture_on_commit_callbacks,
    template_key: str,
    expected_label: str,
) -> None:
    draft = _draft_with_line()

    with django_capture_on_commit_callbacks(execute=True):
        response = sensitive_client.post(
            _list_url(draft.id),
            data={"template_key": template_key, "notes": "Logistics document"},
            content_type="application/json",
        )

    assert response.status_code == 201
    payload = response.json()
    assert payload["template_key"] == template_key
    assert payload["template_label"] == expected_label
    assert payload["status"] == DocumentInstanceStatus.PREPARED


@pytest.mark.parametrize(
    ("template_key", "template_label", "template_path", "expected_fragment"),
    (
        (
            "titan.delivery_note.v1",
            "Bon de livraison Titan",
            "backend/apps/documents/templates_documents/titan/bl/v1/template.html",
            "Delivered Items",
        ),
        (
            "shared.return_note.v1",
            "Bon de retour",
            "backend/apps/documents/templates_documents/shared/bon_retour/v1/template.html",
            "Returned Items",
        ),
    ),
)
def test_document_instance_generate_supports_logistics_note_templates(
    sensitive_client,
    template_key: str,
    template_label: str,
    template_path: str,
    expected_fragment: str,
) -> None:
    draft = _draft_with_line()
    instance = DocumentInstance.objects.create(
        reservation_draft=draft,
        customer=draft.customer,
        template_key=template_key,
        template_version="v1",
        template_label=template_label,
        business_scope="shared" if template_key.startswith("shared.") else "titan",
        document_type="return_note" if template_key.startswith("shared.") else "delivery_note",
        template_status=(
            "generated_draft_template"
            if template_key.startswith("shared.")
            else "validated_source_template"
        ),
        template_source_kind=(
            "generated_from_brand_style" if template_key.startswith("shared.") else "source_pdf"
        ),
        template_source_reference="docs/references/source/Document_A_CDC_Technique_Evenementiel_v3.4.pdf",
        template_path=template_path,
        template_preview_path=template_path.replace("template.html", "preview.pdf"),
        template_validated_by_client=template_key == "titan.delivery_note.v1",
        template_notes="Logistics note template",
        reservation_public_reference=draft.public_reference,
        reservation_status=draft.status,
        customer_display_name=draft.customer.display_name,
        customer_email=draft.customer.email,
        customer_phone=draft.customer.phone,
        customer_address=draft.customer.address,
        status=DocumentInstanceStatus.PREPARED,
    )

    response = sensitive_client.post(_generate_url(draft.id, instance.id))

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == DocumentInstanceStatus.GENERATED

    instance.refresh_from_db()
    with runtime_module.default_storage.open(instance.storage_path, "rb") as f:
        html = f.read().decode("utf-8")

    assert expected_fragment in html
    assert draft.public_reference in html


def test_document_instance_generate_returns_400_for_non_prepared_instance(
    sensitive_client,
) -> None:
    draft = _draft_with_line()
    instance = DocumentInstance.objects.create(
        reservation_draft=draft,
        customer=draft.customer,
        template_key="titan.proforma.v1",
        template_version="v1",
        template_label="Proforma Titan",
        business_scope="titan",
        document_type="proforma",
        template_status="validated_source_template",
        template_source_kind="source_pdf",
        template_source_reference="docs/references/source/Document_A.pdf",
        template_path="backend/apps/documents/templates_documents/titan/proforma/v1/template.html",
        template_preview_path="backend/apps/documents/templates_documents/titan/proforma/v1/preview.pdf",
        template_validated_by_client=True,
        template_notes="Template notes",
        reservation_public_reference=draft.public_reference,
        reservation_status=draft.status,
        customer_display_name=draft.customer.display_name,
        customer_email=draft.customer.email,
        customer_phone=draft.customer.phone,
        customer_address=draft.customer.address,
        status=DocumentInstanceStatus.GENERATED,
        content_checksum="a" * 64,
    )

    response = sensitive_client.post(_generate_url(draft.id, instance.id))

    assert response.status_code == 400
    payload = response.json()
    assert payload["code"] == "invalid_document_status_for_generation"
