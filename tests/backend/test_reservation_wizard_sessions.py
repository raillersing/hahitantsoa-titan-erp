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
from apps.documents.models import NumberingSequence
from apps.hahitantsoa.models import HahitantsoaEventDraft
from apps.inventory.models import InventoryAvailability
from apps.reservations.models import (
    ReservationDraft,
    ReservationWizardFile,
    ReservationWizardSession,
)
from apps.reservations.wizard import WizardConflict, create_wizard_session, update_wizard_session

pytestmark = pytest.mark.django_db
URL = "/api/v1/reservations/wizard-sessions/"


@pytest.fixture
def actor():
    return get_user_model().objects.create_user(username="wizard-owner")


@pytest.fixture
def api(actor):
    client = APIClient()
    client.force_authenticate(actor)
    return client


def create(api, **values):
    return api.post(URL, {"client_key": str(uuid.uuid4()), **values}, format="json")


def detail(session):
    return f"{URL}{session['id']}/"


def test_private_durable_session_without_official_dossier(api, actor):
    numbering_before = list(
        NumberingSequence.objects.order_by("id").values_list("id", "next_number")
    )
    hahitantsoa_before = HahitantsoaEventDraft.objects.count()
    before = (
        Customer.objects.count(),
        ReservationDraft.objects.count(),
        InventoryAvailability.objects.count(),
    )
    response = create(
        api, state={"newClient": {"name": "Client conservé"}, "hDetails": {"startDate": "2026-1"}}
    )
    assert response.status_code == 201
    session = response.json()
    assert session["version"] == 1 and session["files"] == []
    assert "public_reference" not in session
    assert HahitantsoaEventDraft.objects.count() == hahitantsoa_before
    assert (
        list(NumberingSequence.objects.order_by("id").values_list("id", "next_number"))
        == numbering_before
    )
    assert before == (
        Customer.objects.count(),
        ReservationDraft.objects.count(),
        InventoryAvailability.objects.count(),
    )
    other_terminal = APIClient()
    other_terminal.force_authenticate(actor)
    listed = other_terminal.get(URL).json()
    assert listed[0]["id"] == session["id"]
    assert "state" not in listed[0] and "files" not in listed[0]
    restored = other_terminal.get(detail(session))
    assert restored.json()["state"] == session["state"]
    assert restored["Cache-Control"] == "private, no-store"
    assert (
        AuditEvent.objects.filter(
            action="reservations.wizard_created", target_id=session["id"]
        ).count()
        == 1
    )


def test_unauthenticated_and_other_owner_cannot_recover(api):
    session = create(api).json()
    stranger = APIClient()
    assert stranger.get(URL).status_code in {401, 403}
    other = get_user_model().objects.create_user(username="other-owner", is_superuser=True)
    stranger.force_authenticate(other)
    assert stranger.get(URL).json() == []
    assert stranger.get(detail(session)).status_code == 404
    assert (
        stranger.put(detail(session), {"expected_version": 1, "step": 2}, format="json").status_code
        == 404
    )
    assert stranger.post(f"{detail(session)}files/", {}).status_code == 404


def test_actor_key_replay_never_reverts_current_saved_state(api, actor):
    key = str(uuid.uuid4())
    payload = {"client_key": key, "state": {"step": 1}}
    first = api.post(URL, payload, format="json").json()
    saved = api.put(detail(first), {"expected_version": 1, "state": {"step": 2}}, format="json")
    assert saved.status_code == 200
    replay = api.post(URL, payload, format="json")
    assert replay.status_code == 200
    assert replay.json()["state"] == {"step": 2}
    assert replay.json()["version"] == 2
    assert api.post(URL, {**payload, "state": {}}, format="json").status_code == 409
    other = APIClient()
    other.force_authenticate(get_user_model().objects.create_user(username="new-owner"))
    assert other.post(URL, payload, format="json").status_code == 201


def test_expected_revision_and_lost_response_replay(api):
    session = create(api).json()
    values = {"expected_version": 1, "step": 3, "state": {"step": 3}}
    first = api.put(detail(session), values, format="json")
    assert first.status_code == 200 and first.json()["version"] == 2
    replay = api.put(detail(session), values, format="json")
    assert replay.status_code == 200 and replay.json()["version"] == 2
    stale = api.put(detail(session), {**values, "step": 4}, format="json")
    assert stale.status_code == 409
    assert stale.json()["code"] == "wizard_version_conflict"
    assert stale.json()["current_version"] == 2
    assert api.get(detail(session)).json()["step"] == 3


@pytest.mark.parametrize(
    "values",
    [
        {"schema_version": 2},
        {"step": 10},
        {"step": -1},
        {"state": []},
        {"state": {"password": "secret"}},
        {"state": {"newClient": {"token": "secret"}}},
        {"state": {"newClient": {"notes": "x" * 32769}}},
        {"state": {"selectedMaterials": list(range(1001))}},
        {"state": {"newClient": {"notes": "data:application/pdf;base64,abc"}}},
        {"owner_id": str(uuid.uuid4())},
        {"client_key": "not-uuid"},
        {"customer_id": str(uuid.uuid4())},
        {"domain": "venue"},
    ],
)
def test_invalid_contract_is_field_error_without_side_effect(api, values):
    assert create(api, **values).status_code == 400
    assert ReservationWizardSession.objects.count() == 0


def test_completed_recovery_does_not_delete_customer_or_reopen(api):
    customer = Customer.objects.create(display_name="Client conservé")
    session = create(
        api, customer_id=str(customer.pk), state={"selectedClientId": str(customer.pk)}
    ).json()
    completed = api.put(
        detail(session), {"expected_version": 1, "status": "completed"}, format="json"
    )
    assert completed.status_code == 200
    assert api.get(URL).json() == []
    assert api.get(detail(session)).json()["status"] == "completed"
    assert (
        api.put(
            detail(session), {"expected_version": 2, "status": "active"}, format="json"
        ).status_code
        == 409
    )
    assert Customer.objects.filter(pk=customer.pk).exists()


def test_linked_dossier_must_match_customer_and_domain_and_stay_immutable(api, actor):
    customer = Customer.objects.create(display_name="Client")
    other = Customer.objects.create(display_name="Autre")
    start = timezone.now() + timedelta(days=20)
    draft = ReservationDraft.objects.create(
        customer=customer, start_at=start, end_at=start + timedelta(hours=2)
    )
    assert (
        create(
            api,
            domain="hahitantsoa",
            customer_id=str(customer.pk),
            reservation_draft_id=str(draft.pk),
        ).status_code
        == 400
    )
    assert (
        create(
            api, domain="titan", customer_id=str(other.pk), reservation_draft_id=str(draft.pk)
        ).status_code
        == 400
    )
    session = create(
        api, domain="titan", customer_id=str(customer.pk), reservation_draft_id=str(draft.pk)
    ).json()
    assert (
        api.put(
            detail(session), {"expected_version": 1, "reservation_draft_id": None}, format="json"
        ).status_code
        == 400
    )
    draft.contract_signed_at = timezone.now()
    draft.contract_signed_by = actor
    draft.save(update_fields=["contract_signed_at", "contract_signed_by"])
    assert (
        api.put(detail(session), {"expected_version": 1, "step": 8}, format="json").status_code
        == 409
    )
    assert (
        api.put(
            detail(session), {"expected_version": 1, "status": "completed"}, format="json"
        ).status_code
        == 200
    )


def upload(api, session, key, version, content=b"%PDF-1.7\ncontent", **extra):
    return api.post(
        f"{detail(session)}files/",
        {
            "client_file_key": key,
            "expected_version": version,
            "category": "CIN",
            "label": "Identité",
            "file": SimpleUploadedFile("identite.pdf", content, "application/pdf"),
            **extra,
        },
        format="multipart",
    )


def test_files_private_versioned_replayable_and_tombstones(api, settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    session = create(api).json()
    key = str(uuid.uuid4())
    first = upload(api, session, key, 1)
    assert first.status_code == 201 and first.json()["version"] == 2
    file = first.json()["file"]
    assert "file" not in file and "private/" not in str(file)
    assert upload(api, session, key, 1).status_code == 200
    assert ReservationWizardFile.objects.count() == 1
    assert upload(api, session, key, 2, b"%PDF-1.7\nchanged").status_code == 409
    assert upload(api, session, str(uuid.uuid4()), 1).status_code == 409
    restored = api.get(detail(session)).json()
    assert restored["files"] == [file]
    downloaded = api.get(file["download_url"])
    assert downloaded.status_code == 200
    assert b"".join(downloaded.streaming_content) == b"%PDF-1.7\ncontent"
    assert downloaded["X-Content-Type-Options"] == "nosniff"
    other = APIClient()
    other.force_authenticate(get_user_model().objects.create_user(username="file-stranger"))
    assert other.get(file["download_url"]).status_code == 404
    endpoint = f"{detail(session)}files/{file['id']}/"
    deleted = api.delete(endpoint, {"expected_version": 2}, format="json")
    assert deleted.status_code == 200 and deleted.json()["version"] == 3
    assert api.delete(endpoint, {"expected_version": 2}, format="json").json()["version"] == 3
    assert upload(api, session, key, 3).status_code == 409
    assert api.get(file["download_url"]).status_code == 404
    assert api.get(detail(session)).json()["files"] == []
    assert list(tmp_path.rglob("*.pdf"))  # Recovery deletion does not destroy retained evidence.


def test_invalid_file_and_atomic_upload_failure_leave_existing_recovery(api, settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    session = create(api).json()
    assert upload(api, session, str(uuid.uuid4()), 1, b"not a pdf").status_code == 400
    api.raise_request_exception = False
    with patch(
        "apps.reservations.wizard._audit", side_effect=RuntimeError("audit storage unavailable")
    ):
        assert upload(api, session, str(uuid.uuid4()), 1).status_code == 500
    assert not ReservationWizardFile.objects.exists()
    assert not list(tmp_path.rglob("*.pdf"))
    assert api.get(detail(session)).json()["version"] == 1


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("same_payload", [False, True])
def test_real_concurrent_writes_do_not_lose_a_validated_step(same_payload):
    actor = get_user_model().objects.create_user(username="concurrent-wizard")
    session, _ = create_wizard_session(actor=actor, values={"client_key": uuid.uuid4()})
    barrier = Barrier(2)

    def worker(step):
        close_old_connections()
        try:
            user = get_user_model().objects.get(pk=actor.pk)
            barrier.wait(timeout=10)
            try:
                saved = update_wizard_session(
                    actor=user, session_id=session.pk, expected_version=1, values={"step": step}
                )
                return (200, saved.version)
            except WizardConflict:
                return (409, None)
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(worker, 2), pool.submit(worker, 2 if same_payload else 3)]
        results = [future.result(timeout=30) for future in futures]
    assert sorted(row[0] for row in results) == ([200, 200] if same_payload else [200, 409])
    session.refresh_from_db()
    assert session.version == 2


@pytest.mark.django_db(transaction=True)
def test_real_concurrent_session_creation_uses_one_identity():
    actor = get_user_model().objects.create_user(username="concurrent-create")
    key = uuid.uuid4()
    barrier = Barrier(2)

    def worker():
        close_old_connections()
        try:
            user = get_user_model().objects.get(pk=actor.pk)
            barrier.wait(timeout=10)
            session, created = create_wizard_session(actor=user, values={"client_key": key})
            return session.pk, created
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = [
            future.result(timeout=30) for future in [pool.submit(worker), pool.submit(worker)]
        ]
    assert results[0][0] == results[1][0]
    assert sum(row[1] for row in results) == 1


def test_hahitantsoa_link_and_missing_file_are_controlled(api, settings, tmp_path):
    from apps.hahitantsoa.models import HahitantsoaEventDraft

    settings.MEDIA_ROOT = tmp_path
    customer = Customer.objects.create(display_name="Entreprise")
    start = timezone.now() + timedelta(days=25)
    draft = HahitantsoaEventDraft.objects.create(
        customer=customer, event_name="Séminaire", start_at=start, end_at=start + timedelta(hours=2)
    )
    session = create(
        api,
        domain="hahitantsoa",
        customer_id=str(customer.pk),
        hahitantsoa_event_draft_id=str(draft.pk),
        state={"domain": "hahitantsoa", "selectedClientId": str(customer.pk)},
    ).json()
    assert session["hahitantsoa_event_draft_id"] == str(draft.pk)
    file = upload(api, session, str(uuid.uuid4()), 1).json()["file"]
    row = ReservationWizardFile.objects.get(pk=file["id"])
    row.file.delete(save=False)
    assert api.get(file["download_url"]).status_code == 404
    assert api.get(detail(session)).json()["customer_id"] == str(customer.pk)


def test_stale_actor_and_failed_audit_cannot_acknowledge_a_saved_step(api, actor):
    session = create(api).json()
    with patch("apps.reservations.wizard._audit", side_effect=RuntimeError("unavailable")):
        api.raise_request_exception = False
        assert (
            api.put(detail(session), {"expected_version": 1, "step": 5}, format="json").status_code
            == 500
        )
    assert api.get(detail(session)).json()["step"] == 0
    assert api.get(detail(session)).json()["version"] == 1
    get_user_model().objects.filter(pk=actor.pk).update(is_active=False)
    assert (
        api.put(detail(session), {"expected_version": 1, "step": 3}, format="json").status_code
        == 403
    )
    assert ReservationWizardSession.objects.get(pk=session["id"]).version == 1


def test_file_limits_do_not_advance_recovery_revision(api, settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    session = create(api).json()
    values = dict(
        session_id=session["id"],
        category="CIN",
        label="",
        original_name="retained.pdf",
        content_type="application/pdf",
        size_bytes=1,
        sha256="0" * 64,
        file="private_attachments/retained.pdf",
    )
    ReservationWizardFile.objects.bulk_create(
        [ReservationWizardFile(client_file_key=uuid.uuid4(), **values) for _ in range(20)]
    )
    assert upload(api, session, str(uuid.uuid4()), 1).status_code == 400
    assert api.get(detail(session)).json()["version"] == 1
    assert not list(tmp_path.rglob("*.pdf"))
    ReservationWizardFile.objects.update(is_deleted=True, size_bytes=5 * 1024 * 1024)
    assert upload(api, session, str(uuid.uuid4()), 1).status_code == 400
    assert api.get(detail(session)).json()["version"] == 1


def test_openapi_documents_the_private_recovery_contract(api):
    from drf_spectacular.generators import SchemaGenerator

    schema = SchemaGenerator().get_schema(request=None, public=True)
    path = schema["paths"][URL]
    assert path["post"]["requestBody"]["content"]["application/json"]["schema"]["$ref"].endswith(
        "WizardCreate"
    )
    response = schema["components"]["schemas"]["WizardSessionRead"]
    assert "state" in response["properties"]
    assert response["properties"]["version"]["type"] == "integer"
    assert response["properties"]["files"]["type"] == "array"
    assert "files" in response["properties"]
    assert "owner" not in response["properties"]
