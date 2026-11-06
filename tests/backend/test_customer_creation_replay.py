from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier

import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError, close_old_connections, connections, transaction
from django.test import Client
from django.utils import timezone
from test_customer_write_api import (
    operator_user as operator_user,
)
from test_customer_write_api import (
    staff_authenticated_client as staff_authenticated_client,
)
from test_customer_write_api import (
    staff_user as staff_user,
)

from apps.customers.models import Customer, CustomerContactPoint
from apps.customers.serializers import CustomerSerializer
from apps.customers.services import (
    CustomerCreationConflict,
    create_customer_idempotently,
    update_customer_record,
)
from apps.reservations.models import ReservationDraft

pytestmark = pytest.mark.django_db
URL = "/api/v1/customers/create/"


def _post(client, key="operation", **values):
    return client.post(
        URL,
        {"display_name": "Initial", "idempotency_key": key, **values},
        content_type="application/json",
    )


def test_changed_payload_is_conflict_without_duplicate(staff_authenticated_client):
    first = _post(staff_authenticated_client)
    replay = _post(staff_authenticated_client, display_name="Other client")
    assert first.status_code == 201
    assert replay.status_code == 409
    assert replay.json()["code"] == "customer_creation_conflict"
    assert Customer.objects.filter(idempotency_key="operation").count() == 1


def test_key_is_actor_scoped(staff_authenticated_client, operator_user):
    first = _post(staff_authenticated_client)
    other = Client()
    other.force_login(operator_user)
    second = _post(other)
    assert first.status_code == second.status_code == 201
    assert first.json()["id"] != second.json()["id"]


@pytest.mark.parametrize("deleted", [False, True])
def test_removed_customer_cannot_be_recreated(staff_authenticated_client, deleted):
    first = _post(staff_authenticated_client)
    Customer.objects.filter(pk=first.json()["id"]).update(is_active=False, is_deleted=deleted)
    assert _post(staff_authenticated_client).status_code == 409
    assert Customer.objects.filter(idempotency_key="operation").count() == 1


@pytest.mark.parametrize("key", [1, True, None, [], {}])
def test_key_type_is_validated(staff_authenticated_client, key):
    assert _post(staff_authenticated_client, key=key).status_code == 400


def test_body_and_header_validation(staff_authenticated_client):
    assert (
        staff_authenticated_client.post(URL, [], content_type="application/json").status_code == 400
    )
    response = staff_authenticated_client.post(
        URL,
        {"display_name": "Initial", "idempotency_key": "body"},
        content_type="application/json",
        HTTP_IDEMPOTENCY_KEY="other",
    )
    assert response.status_code == 400
    assert (
        staff_authenticated_client.post(
            URL,
            {"display_name": "Initial"},
            content_type="application/json",
            HTTP_IDEMPOTENCY_KEY="x" * 129,
        ).status_code
        == 400
    )


def test_write_only_immutable_key_and_live_counters(staff_authenticated_client):
    first = _post(staff_authenticated_client)
    customer_id = first.json()["id"]
    assert "idempotency_key" not in first.json()
    url = f"/api/v1/customers/{customer_id}/update/"
    assert (
        staff_authenticated_client.post(
            url, {"idempotency_key": ""}, content_type="application/json"
        ).status_code
        == 400
    )
    assert (
        staff_authenticated_client.post(
            url, {"display_name": "Updated"}, content_type="application/json"
        ).status_code
        == 200
    )
    start = timezone.now() + timedelta(days=1)
    ReservationDraft.objects.create(
        customer_id=customer_id, start_at=start, end_at=start + timedelta(hours=2)
    )
    replay = _post(staff_authenticated_client)
    assert replay.status_code == 200
    assert replay.json()["id"] == customer_id
    assert replay.json()["display_name"] == "Updated"
    assert replay.json()["reservation_count"] == replay.json()["draft_dossier_count"] == 1
    assert "idempotency_key" not in replay.json()


def test_full_serializer_update_without_key_preserves_operation(staff_user):
    customer, _ = create_customer_idempotently(
        values={"display_name": "Initial"}, actor=staff_user, idempotency_key="full"
    )
    fingerprint = customer.idempotency_fingerprint
    serializer = CustomerSerializer(customer, data={"display_name": "Updated"})
    assert serializer.is_valid(), serializer.errors
    updated = serializer.save(updated_by=staff_user)
    assert updated.display_name == "Updated"
    assert updated.idempotency_key == "full"
    assert updated.idempotency_fingerprint == fingerprint


@pytest.mark.parametrize(
    "field", ["idempotency_key", "idempotency_actor", "idempotency_fingerprint"]
)
def test_service_cannot_rewrite_operation_metadata(staff_user, field):
    customer, _ = create_customer_idempotently(
        values={"display_name": "Initial"}, actor=staff_user, idempotency_key="immutable"
    )
    with pytest.raises(CustomerCreationConflict):
        update_customer_record(customer=customer, values={field: "changed"})


@pytest.mark.parametrize("deleted", [False, True])
def test_database_reserves_key_including_tombstones(staff_user, deleted):
    Customer.objects.create(
        display_name="Reserved",
        idempotency_actor=staff_user,
        idempotency_key="reserved",
        is_deleted=deleted,
    )
    with pytest.raises(IntegrityError), transaction.atomic():
        Customer.objects.create(
            display_name="Duplicate", idempotency_actor=staff_user, idempotency_key="reserved"
        )


def test_unknown_legacy_key_is_not_recreated(staff_authenticated_client):
    Customer.objects.create(display_name="Legacy", idempotency_key="legacy")
    assert _post(staff_authenticated_client, key="legacy").status_code == 409
    assert Customer.objects.filter(idempotency_key="legacy").count() == 1


def test_own_operation_precedes_orphan_legacy_key(staff_authenticated_client):
    first = _post(staff_authenticated_client)
    Customer.objects.create(display_name="Orphan", idempotency_key="operation")
    assert _post(staff_authenticated_client).json()["id"] == first.json()["id"]


def test_replay_without_known_legacy_fingerprint_is_conflict(
    staff_authenticated_client, staff_user
):
    Customer.objects.create(
        display_name="Legacy", idempotency_key="legacy", idempotency_actor=staff_user
    )
    assert _post(staff_authenticated_client, key="legacy").status_code == 409
    assert Customer.objects.filter(idempotency_key="legacy").count() == 1


def test_projection_deactivation_is_conflict_not_server_error(
    staff_authenticated_client, monkeypatch
):
    from apps.customers import views

    first = _post(staff_authenticated_client)
    original = views.create_customer_idempotently

    def deactivate(**kwargs):
        customer, created = original(**kwargs)
        Customer.objects.filter(pk=customer.pk).update(is_active=False)
        return customer, created

    monkeypatch.setattr(views, "create_customer_idempotently", deactivate)
    assert _post(staff_authenticated_client).status_code == 409
    assert Customer.objects.filter(pk=first.json()["id"]).count() == 1


def test_contacts_and_customer_rollback_after_partial_write(staff_user, monkeypatch):
    original = CustomerContactPoint.objects.bulk_create

    def fail_after_insert(*args, **kwargs):
        original(*args, **kwargs)
        raise IntegrityError("Synthetic contact failure")

    monkeypatch.setattr(CustomerContactPoint.objects, "bulk_create", fail_after_insert)
    with pytest.raises(IntegrityError):
        create_customer_idempotently(
            actor=staff_user,
            idempotency_key="rollback",
            values={
                "display_name": "Rollback",
                "contact_points": [{"kind": "email", "value": "rollback@example.test"}],
            },
        )
    assert not Customer.objects.filter(idempotency_key="rollback").exists()
    assert not CustomerContactPoint.objects.filter(value="rollback@example.test").exists()


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("different_payload", [False, True])
def test_real_concurrent_creation_same_actor_key(staff_user, different_payload):
    barrier = Barrier(2)

    def attempt(index):
        close_old_connections()
        try:
            actor = get_user_model().objects.get(pk=staff_user.pk)
            barrier.wait(timeout=15)
            try:
                customer, created = create_customer_idempotently(
                    actor=actor,
                    idempotency_key="concurrent",
                    values={"display_name": f"Client {index if different_payload else 0}"},
                )
                return str(customer.pk), created
            except CustomerCreationConflict:
                return "conflict", False
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = [executor.submit(attempt, i) for i in range(2)]
        results = [future.result(timeout=60) for future in futures]
    assert Customer.objects.filter(idempotency_key="concurrent").count() == 1
    assert sum(created for _, created in results) == 1
    if different_payload:
        assert sum(identity == "conflict" for identity, _ in results) == 1
    else:
        assert results[0][0] == results[1][0]
