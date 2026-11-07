import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import close_old_connections, connections
from django.utils import timezone
from rest_framework.test import APIClient

from apps.audit.models import AuditEvent
from apps.customers.models import Customer
from apps.documents.models import DocumentInstance, UploadedAttachment
from apps.inventory.models import InventoryAvailability, InventoryItem
from apps.reservations.models import ReservationDraft, ReservationWizardSession
from apps.reservations.wizard_business import create_session_draft

pytestmark = pytest.mark.django_db
URL = "/api/v1/reservations/wizard-sessions/"


@pytest.fixture
def actor():
    return get_user_model().objects.create_user(username="bridge-owner", is_staff=True)


@pytest.fixture
def api(actor):
    client = APIClient()
    client.force_authenticate(actor)
    return client


def setup(api, domain="titan"):
    customer = Customer.objects.create(display_name="Bridge Client")
    session = api.post(
        URL,
        {"client_key": str(uuid.uuid4()), "domain": domain, "customer_id": str(customer.pk)},
        format="json",
    ).json()
    start = timezone.now() + timedelta(days=20)
    payload = {
        "customer_id": str(customer.pk),
        "start_at": start.isoformat(),
        "end_at": (start + timedelta(hours=2)).isoformat(),
        "lines": [],
    }
    if domain == "titan":
        item = InventoryItem.objects.create(name="Rental item", kind="material", rental_price="500")
        payload["lines"] = [{"inventory_item_id": str(item.pk), "quantity": 1}]
    else:
        payload.update(event_name="Event", rental_type="bare", guest_count=30)
    return session, {
        "expected_version": 1,
        "domain": domain,
        "payload": payload,
        "proforma_validity_days": 27,
    }


def action(session, name="draft"):
    return f"{URL}{session['id']}/{name}/"


@pytest.mark.parametrize("domain", ["titan", "hahitantsoa"])
def test_atomic_draft_replay_preserves_current_business_data(api, actor, domain):
    session, payload = setup(api, domain)
    before = InventoryAvailability.objects.count()
    response = api.post(action(session), payload, format="json")
    assert response.status_code == 201, response.data
    data = response.json()
    assert data["version"] == 2
    proforma = DocumentInstance.objects.get(pk=data["proforma_id"])
    assert proforma.proforma_validity_days == 27
    assert proforma.prepared_by_id == actor.pk
    assert InventoryAvailability.objects.count() == before
    stored = ReservationWizardSession.objects.get(pk=session["id"])
    field = "reservation_draft" if domain == "titan" else "hahitantsoa_event_draft"
    draft = getattr(stored, field)
    assert draft.created_by_id == actor.pk
    draft.notes = "Edited in business dossier"
    draft.save(update_fields=["notes"])
    api.put(f"{URL}{session['id']}/", {"expected_version": 2, "step": 4}, format="json")
    replay = api.post(action(session), payload, format="json")
    assert replay.status_code == 200
    assert replay.json()["draft"]["notes"] == draft.notes
    assert replay.json()["version"] == 3
    assert draft.document_instances.count() == 1
    changed = {**payload, "proforma_validity_days": 26}
    assert api.post(action(session), changed, format="json").status_code == 409
    assert (
        AuditEvent.objects.filter(
            action="reservations.wizard_draft_created", target_id=session["id"]
        ).count()
        == 1
    )
    draft.is_deleted = True
    draft.save(update_fields=["is_deleted"])
    assert api.post(action(session), payload, format="json").status_code == 409


def test_draft_rollback_and_private_owner(api):
    session, payload = setup(api)
    before = DocumentInstance.objects.count()
    with patch(
        "apps.reservations.wizard_business._audit", side_effect=RuntimeError("audit failure")
    ):
        api.raise_request_exception = False
        assert api.post(action(session), payload, format="json").status_code == 500
    assert ReservationDraft.objects.count() == 0
    assert DocumentInstance.objects.count() == before
    stored = ReservationWizardSession.objects.get(pk=session["id"])
    assert stored.version == 1 and not stored.reservation_draft_id
    other = get_user_model().objects.create_user(username="foreign", is_staff=True)
    api.force_authenticate(other)
    assert api.post(action(session), payload, format="json").status_code == 404


@pytest.mark.parametrize(
    "bad", [{"proforma_validity_days": 0}, {"domain": "invalid"}, {"payload": {}}]
)
def test_invalid_draft_payload_does_not_create(api, bad):
    session, payload = setup(api)
    assert api.post(action(session), {**payload, **bad}, format="json").status_code == 400
    assert not ReservationDraft.objects.exists()


def upload(api, session, version):
    return api.post(
        action(session, "files"),
        {
            "expected_version": version,
            "client_file_key": str(uuid.uuid4()),
            "category": "CIN",
            "file": SimpleUploadedFile(
                "identity.pdf", b"%PDF-1.4\nfixture", content_type="application/pdf"
            ),
        },
        format="multipart",
    ).json()["file"]


def test_promotion_replay_permission_and_blob_rollback(api, actor, settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    session, _ = setup(api)
    file = upload(api, session, 1)
    url = f"{URL}{session['id']}/files/{file['id']}/promote/"
    payload = {"expected_version": 2, "target": "customer"}
    actor.is_staff = False
    actor.save(update_fields=["is_staff"])
    assert api.post(url, payload, format="json").status_code == 403
    actor.is_staff = True
    actor.save(update_fields=["is_staff"])
    before = set(tmp_path.rglob("*.pdf"))
    with patch(
        "apps.reservations.wizard_business._audit", side_effect=RuntimeError("audit failure")
    ):
        api.raise_request_exception = False
        assert api.post(url, payload, format="json").status_code == 500
    assert set(tmp_path.rglob("*.pdf")) == before
    assert not UploadedAttachment.objects.exists()
    response = api.post(url, payload, format="json")
    assert response.status_code == 201, response.data
    replay = api.post(url, payload, format="json")
    assert replay.status_code == 200
    assert replay.json()["attachment"]["id"] == response.json()["attachment"]["id"]
    assert UploadedAttachment.objects.count() == 1
    assert "url" not in replay.json()["attachment"]
    assert AuditEvent.objects.filter(action="documents.attachment_uploaded").count() == 1


def test_discharge_replay_and_changed_payload(api):
    session, payload = setup(api, "hahitantsoa")
    assert api.post(action(session), payload, format="json").status_code == 201
    request = {
        "expected_version": 2,
        "payload": {"template_key": "hahitantsoa.liability_release.v1", "notes": "Signed later"},
    }
    response = api.post(action(session, "discharge"), request, format="json")
    assert response.status_code == 201, response.data
    replay = api.post(action(session, "discharge"), request, format="json")
    assert replay.status_code == 200
    assert replay.json()["document"]["id"] == response.json()["document"]["id"]
    request["payload"]["notes"] = "Different"
    assert api.post(action(session, "discharge"), request, format="json").status_code == 409


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("domain", ["titan", "hahitantsoa"])
def test_concurrent_creation_returns_one_draft(actor, api, domain):
    if connections["default"].vendor != "postgresql":
        pytest.skip("Requires PostgreSQL row locks")
    session, request = setup(api, domain)
    barrier = Barrier(2)

    def worker():
        close_old_connections()
        try:
            user = get_user_model().objects.get(pk=actor.pk)
            barrier.wait(timeout=10)
            row, draft, created = create_session_draft(
                actor=user, session_id=session["id"], **request
            )
            return str(draft.pk), created, row.version
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(worker), pool.submit(worker)]
        results = [future.result(timeout=30) for future in futures]
    assert results[0][0] == results[1][0]
    assert sum(row[1] for row in results) == 1
    assert ReservationDraft.objects.count() == (1 if domain == "titan" else 0)
    assert DocumentInstance.objects.count() == 1


def test_proforma_validity_after_creation_replays_after_generation(api):
    session, payload = setup(api)
    data = api.post(action(session), payload, format="json").json()
    url = action(session, "proforma")
    request = {"expected_version": 2, "proforma_validity_days": 31}
    response = api.post(url, request, format="json")
    assert response.status_code == 200
    assert response.json()["version"] == 3
    document = DocumentInstance.objects.get(pk=data["proforma_id"])
    document.status = "generated"
    document.save(update_fields=["status"])
    for expected in [2, 3]:
        replay = api.post(url, {**request, "expected_version": expected}, format="json")
        assert replay.status_code == 200
        assert replay.json()["version"] == 3
        assert replay.json()["document"]["id"] == data["proforma_id"]
    assert (
        api.post(
            url, {"expected_version": 3, "proforma_validity_days": 22}, format="json"
        ).status_code
        == 409
    )
    assert document.reservation_draft.document_instances.count() == 1


def test_promotion_failed_insert_removes_only_new_blob(api, settings, tmp_path):
    from django.db import IntegrityError
    from django.db.models import Model

    settings.MEDIA_ROOT = tmp_path
    session, _ = setup(api)
    file = upload(api, session, 1)
    before = set(tmp_path.rglob("*.pdf"))
    original_insert = Model._do_insert

    def fail_attachment_insert(instance, *args, **kwargs):
        if isinstance(instance, UploadedAttachment):
            raise IntegrityError("simulated insert failure after file save")
        return original_insert(instance, *args, **kwargs)

    with patch.object(Model, "_do_insert", fail_attachment_insert):
        api.raise_request_exception = False
        response = api.post(
            f"{URL}{session['id']}/files/{file['id']}/promote/",
            {"expected_version": 2, "target": "customer"},
            format="json",
        )
        assert response.status_code == 500
    assert set(tmp_path.rglob("*.pdf")) == before
    assert api.get(file["download_url"]).status_code == 200
    assert not UploadedAttachment.objects.exists()
    assert ReservationWizardSession.objects.get(pk=session["id"]).version == 2


@pytest.mark.django_db(transaction=True)
def test_concurrent_discharge_is_single_document(actor, api):
    if connections["default"].vendor != "postgresql":
        pytest.skip("Requires PostgreSQL row locks")
    from apps.reservations.wizard_business import create_session_discharge

    session, request = setup(api, "hahitantsoa")
    created = api.post(action(session), request, format="json")
    assert created.status_code == 201
    barrier = Barrier(2)

    def worker():
        close_old_connections()
        try:
            user = get_user_model().objects.get(pk=actor.pk)
            barrier.wait(timeout=10)
            document, version, created = create_session_discharge(
                actor=user,
                session_id=session["id"],
                expected_version=2,
                payload={"template_key": "hahitantsoa.liability_release.v1"},
            )
            return str(document.pk), created, version
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(worker), pool.submit(worker)]
        results = [future.result(timeout=30) for future in futures]
    assert results[0][0] == results[1][0]
    assert sum(row[1] for row in results) == 1
    assert (
        DocumentInstance.objects.filter(template_key="hahitantsoa.liability_release.v1").count()
        == 1
    )


@pytest.mark.django_db(transaction=True)
def test_concurrent_promotion_keeps_one_attachment(actor, api, settings, tmp_path):
    if connections["default"].vendor != "postgresql":
        pytest.skip("Requires PostgreSQL row locks")
    from apps.reservations.wizard_business import promote_session_file

    settings.MEDIA_ROOT = tmp_path
    session, _ = setup(api)
    file = upload(api, session, 1)
    barrier = Barrier(2)

    def worker():
        close_old_connections()
        try:
            user = get_user_model().objects.get(pk=actor.pk)
            barrier.wait(timeout=10)
            attachment, version, created = promote_session_file(
                actor=user,
                session_id=session["id"],
                file_id=file["id"],
                expected_version=2,
                target="customer",
            )
            return str(attachment.pk), created, version
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(worker), pool.submit(worker)]
        results = [future.result(timeout=30) for future in futures]
    assert results[0][0] == results[1][0]
    assert sum(row[1] for row in results) == 1
    assert UploadedAttachment.objects.count() == 1
    assert len(list(tmp_path.rglob("*.pdf"))) == 2


@pytest.mark.parametrize("domain", ["titan", "hahitantsoa"])
def test_legacy_dossier_revision_preserves_history_and_replays_older_operation(
    api, actor, domain, settings, tmp_path
):
    from django.core.files.storage import default_storage

    from apps.documents.runtime import generate_document_instance_html

    settings.MEDIA_ROOT = tmp_path
    session, payload = setup(api, domain)
    original = api.post(action(session), payload, format="json").json()
    source = DocumentInstance.objects.get(pk=original["proforma_id"])
    generate_document_instance_html(document_instance=source, actor=actor)
    source.refresh_from_db()
    with default_storage.open(source.storage_path, "rb") as handle:
        original_bytes = handle.read()
    legacy = api.post(
        URL, {"client_key": str(uuid.uuid4()), "domain": domain}, format="json"
    ).json()
    link = "reservation_draft_id" if domain == "titan" else "hahitantsoa_event_draft_id"
    assert (
        api.put(
            f"{URL}{legacy['id']}/",
            {
                "expected_version": 1,
                "customer_id": payload["payload"]["customer_id"],
                link: original["draft"]["id"],
            },
            format="json",
        ).status_code
        == 200
    )
    model = ReservationWizardSession._meta.get_field(link.removesuffix("_id")).remote_field.model
    draft = model.objects.get(pk=original["draft"]["id"])
    draft.start_at += timedelta(days=2)
    draft.end_at += timedelta(days=2)
    draft.save(update_fields=["start_at", "end_at"])
    original_data = DocumentInstance.objects.filter(pk=source.pk).values().get()
    request = {
        "expected_version": 2,
        "proforma_validity_days": 42,
        "proforma_id": str(source.pk),
        "revision_key": str(uuid.uuid4()),
    }
    response = api.post(action(legacy, "proforma"), request, format="json")
    assert response.status_code == 200, response.data
    revised_id = response.json()["document"]["id"]
    assert revised_id != str(source.pk)
    revised = DocumentInstance.objects.get(pk=revised_id)
    assert revised.status == "prepared"
    assert revised.proforma_validity_days == 42
    generate_document_instance_html(document_instance=revised, actor=actor)
    revised.refresh_from_db()
    assert revised.status == "generated"
    assert revised.content_checksum != source.content_checksum
    with default_storage.open(source.storage_path, "rb") as handle:
        assert handle.read() == original_bytes
    assert DocumentInstance.objects.filter(pk=source.pk).values().get() == original_data
    next_request = {
        "expected_version": 3,
        "proforma_validity_days": 15,
        "proforma_id": revised_id,
        "revision_key": str(uuid.uuid4()),
    }
    later = api.post(action(legacy, "proforma"), next_request, format="json")
    assert later.status_code == 200
    replay = api.post(action(legacy, "proforma"), request, format="json")
    assert replay.status_code == 200
    assert replay.json()["document"]["id"] == revised_id
    assert replay.json()["version"] == 4
    assert (
        api.post(
            action(legacy, "proforma"), {**request, "proforma_validity_days": 43}, format="json"
        ).status_code
        == 409
    )
    assert (
        AuditEvent.objects.filter(
            action="reservations.wizard_proforma_revised", target_id=legacy["id"]
        ).count()
        == 2
    )
    assert draft.document_instances.count() == 3


def test_legacy_adoption_requires_exact_dossier_and_preserves_generated_document(api):
    first, payload = setup(api)
    data = api.post(action(first), payload, format="json").json()
    source = DocumentInstance.objects.get(pk=data["proforma_id"])
    source.status = "generated"
    source.save(update_fields=["status"])
    legacy = api.post(
        URL,
        {
            "client_key": str(uuid.uuid4()),
            "domain": "titan",
            "customer_id": payload["payload"]["customer_id"],
            "reservation_draft_id": data["draft"]["id"],
        },
        format="json",
    ).json()
    request = {"expected_version": 1, "proforma_validity_days": 27, "proforma_id": str(source.pk)}
    second, other_payload = setup(api)
    other = api.post(action(second), other_payload, format="json").json()
    assert (
        api.post(
            action(legacy, "proforma"),
            {**request, "proforma_id": other["proforma_id"]},
            format="json",
        ).status_code
        == 409
    )
    response = api.post(action(legacy, "proforma"), request, format="json")
    assert response.status_code == 200
    assert response.json()["version"] == 2
    assert response.json()["document"]["id"] == str(source.pk)
    assert api.post(action(legacy, "proforma"), request, format="json").status_code == 200
    assert source.reservation_draft.document_instances.count() == 1


@pytest.mark.django_db(transaction=True)
def test_concurrent_revision_is_one_new_official_document(actor, api):
    if connections["default"].vendor != "postgresql":
        pytest.skip("Requires PostgreSQL row locks")
    from apps.reservations.wizard_business import update_session_proforma

    session, request = setup(api)
    source = api.post(action(session), request, format="json").json()["proforma_id"]
    revision_key = uuid.uuid4()
    barrier = Barrier(2)

    def worker():
        close_old_connections()
        try:
            user = get_user_model().objects.get(pk=actor.pk)
            barrier.wait(timeout=10)
            document, version = update_session_proforma(
                actor=user,
                session_id=session["id"],
                expected_version=2,
                proforma_validity_days=30,
                proforma_id=source,
                revision_key=revision_key,
            )
            return str(document.pk), version
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(worker), pool.submit(worker)]
        results = [future.result(timeout=30) for future in futures]
    assert results[0] == results[1]
    assert DocumentInstance.objects.count() == 2
    assert (
        AuditEvent.objects.filter(
            action="reservations.wizard_proforma_revised", target_id=session["id"]
        ).count()
        == 1
    )
