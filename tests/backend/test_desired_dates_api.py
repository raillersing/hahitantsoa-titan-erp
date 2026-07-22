from datetime import date, timedelta

import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction

from apps.audit.models import AuditEvent
from apps.customers.models import Customer, DesiredDateWaitlistEntry
from apps.customers.services import create_desired_date_waitlist_entry

pytestmark = pytest.mark.django_db

User = get_user_model()


@pytest.fixture
def staff_client(client):
    actor = User.objects.create_user(
        username="desired-date-staff",
        password="test-password",
        is_staff=True,
    )
    client.force_login(actor)
    return client, actor


@pytest.fixture
def customer():
    return Customer.objects.create(
        display_name="Prospect dates souhaitées",
        lifecycle_status="prospect",
    )


def _titan_payload(customer, responsible):
    return {
        "business_scope": "titan",
        "preferred_dates": [(date.today() + timedelta(days=14)).isoformat()],
        "interest_kind": "material",
        "quantity": 12,
        "responsible_id": str(responsible.id),
    }


def test_authorized_employee_creates_non_blocking_titan_waitlist_entry(
    staff_client, customer, django_capture_on_commit_callbacks
):
    client, actor = staff_client
    responsible = User.objects.create_user(
        username="commercial-responsible",
        password="test-password",
        is_staff=True,
    )

    with django_capture_on_commit_callbacks(execute=True):
        response = client.post(
            f"/api/v1/customers/{customer.id}/desired-dates/",
            _titan_payload(customer, responsible),
            content_type="application/json",
        )

    assert response.status_code == 201
    payload = response.json()
    assert payload["customer_id"] == str(customer.id)
    assert payload["business_scope"] == "titan"
    assert payload["status"] == "new"
    assert payload["preferred_dates"] == [
        (date.today() + timedelta(days=14)).isoformat(),
    ]
    assert payload["interest_kind"] == "material"
    assert payload["quantity"] == 12
    assert payload["responsible_id"] == responsible.id
    assert AuditEvent.objects.filter(
        action="customer.desired_date_waitlist_created",
        target_id=payload["id"],
        actor=actor,
        metadata={
            "customer_id": str(customer.id),
            "business_scope": "titan",
            "interest_kind": "material",
            "quantity": 12,
        },
    ).exists()


def test_waitlist_entry_transitions_new_to_contacted_then_converted_with_audit(
    staff_client, customer, django_capture_on_commit_callbacks
):
    client, actor = staff_client
    responsible = User.objects.create_user(
        username="transition-commercial",
        password="test-password",
        is_staff=True,
    )
    created = client.post(
        f"/api/v1/customers/{customer.id}/desired-dates/",
        _titan_payload(customer, responsible),
        content_type="application/json",
    ).json()
    detail_url = f"/api/v1/customers/{customer.id}/desired-dates/{created['id']}/"

    with django_capture_on_commit_callbacks(execute=True):
        contacted = client.post(f"{detail_url}contact/", content_type="application/json")

    assert contacted.status_code == 200
    assert contacted.json()["status"] == "contacted"
    assert AuditEvent.objects.filter(
        action="customer.desired_date_waitlist_contacted",
        target_id=created["id"],
        actor=actor,
        metadata={"customer_id": str(customer.id), "status": "contacted"},
    ).exists()
    converted = client.post(f"{detail_url}convert/", content_type="application/json")
    assert converted.status_code == 200
    assert converted.json()["status"] == "converted"
    assert client.post(f"{detail_url}lose/", content_type="application/json").status_code == 400


@pytest.mark.parametrize("interest_kind", ("local", "material", "service"))
def test_authorized_employee_creates_hahitantsoa_flexible_waitlist_entry(
    staff_client, customer, interest_kind
):
    client, _ = staff_client
    responsible = User.objects.create_user(
        username=f"hahitantsoa-commercial-{interest_kind}",
        password="test-password",
        is_staff=True,
    )
    response = client.post(
        f"/api/v1/customers/{customer.id}/desired-dates/",
        {
            "business_scope": "hahitantsoa",
            "flexible_start": (date.today() + timedelta(days=20)).isoformat(),
            "flexible_end": (date.today() + timedelta(days=25)).isoformat(),
            "interest_kind": interest_kind,
            "quantity": 3,
            "responsible_id": responsible.id,
        },
        content_type="application/json",
    )

    assert response.status_code == 201
    assert response.json()["preferred_dates"] == []
    assert response.json()["flexible_start"] == (date.today() + timedelta(days=20)).isoformat()
    assert response.json()["interest_kind"] == interest_kind


@pytest.mark.parametrize(
    "payload",
    (
        {"business_scope": "titan", "interest_kind": "local"},
        {
            "business_scope": "titan",
            "interest_kind": "material",
            "preferred_dates": [
                (date.today() + timedelta(days=1)).isoformat(),
                (date.today() + timedelta(days=2)).isoformat(),
                (date.today() + timedelta(days=3)).isoformat(),
                (date.today() + timedelta(days=4)).isoformat(),
            ],
        },
        {
            "business_scope": "titan",
            "interest_kind": "material",
            "preferred_dates": [(date.today() + timedelta(days=1)).isoformat()],
            "flexible_start": (date.today() + timedelta(days=2)).isoformat(),
            "flexible_end": (date.today() + timedelta(days=3)).isoformat(),
        },
    ),
)
def test_create_rejects_invalid_scope_or_date_selection(staff_client, customer, payload):
    client, _ = staff_client
    responsible = User.objects.create_user(
        username=f"invalid-commercial-{Customer.objects.count()}",
        password="test-password",
        is_staff=True,
    )
    payload.update(
        {
            "quantity": 1,
            "responsible_id": responsible.id,
            "preferred_dates": payload.get(
                "preferred_dates", [(date.today() + timedelta(days=1)).isoformat()]
            ),
        }
    )

    response = client.post(
        f"/api/v1/customers/{customer.id}/desired-dates/",
        payload,
        content_type="application/json",
    )

    assert response.status_code == 400


def test_waitlist_read_is_customer_scoped_and_has_no_generic_mutation(staff_client, customer):
    client, _ = staff_client
    responsible = User.objects.create_user(
        username="scoped-commercial",
        password="test-password",
        is_staff=True,
    )
    entry = client.post(
        f"/api/v1/customers/{customer.id}/desired-dates/",
        _titan_payload(customer, responsible),
        content_type="application/json",
    ).json()
    another_customer = Customer.objects.create(display_name="Other customer")
    detail_url = f"/api/v1/customers/{customer.id}/desired-dates/{entry['id']}/"
    other_detail_url = f"/api/v1/customers/{another_customer.id}/desired-dates/{entry['id']}/"

    assert client.get(f"/api/v1/customers/{customer.id}/desired-dates/").status_code == 200
    assert client.get(detail_url).status_code == 200
    assert client.get(other_detail_url).status_code == 404
    assert client.patch(detail_url, {}, content_type="application/json").status_code == 405
    assert client.delete(detail_url).status_code == 405


def test_create_reuses_sensitive_permission_and_rejects_inactive_customer(client, customer):
    regular = User.objects.create_user(username="regular-desired-date", password="test-password")
    responsible = User.objects.create_user(
        username="permission-commercial",
        password="test-password",
        is_staff=True,
    )
    client.force_login(regular)
    assert (
        client.post(
            f"/api/v1/customers/{customer.id}/desired-dates/",
            _titan_payload(customer, responsible),
            content_type="application/json",
        ).status_code
        == 403
    )
    customer.is_active = False
    customer.save(update_fields=["is_active"])
    staff = User.objects.create_user(
        username="inactive-customer-staff", password="test-password", is_staff=True
    )
    client.force_login(staff)
    assert (
        client.post(
            f"/api/v1/customers/{customer.id}/desired-dates/",
            _titan_payload(customer, responsible),
            content_type="application/json",
        ).status_code
        == 404
    )


def test_waitlist_creation_and_audit_rollback_together(customer):
    actor = User.objects.create_user(
        username="rollback-actor", password="test-password", is_staff=True
    )
    responsible = User.objects.create_user(
        username="rollback-responsible", password="test-password", is_staff=True
    )

    with pytest.raises(RuntimeError), transaction.atomic():
        create_desired_date_waitlist_entry(
            customer=customer,
            actor=actor,
            values={
                "business_scope": "titan",
                "preferred_date_1": date.today() + timedelta(days=1),
                "preferred_date_2": None,
                "preferred_date_3": None,
                "flexible_start": None,
                "flexible_end": None,
                "interest_kind": "material",
                "quantity": 1,
                "responsible": responsible,
            },
        )
        raise RuntimeError("force rollback")

    assert DesiredDateWaitlistEntry.objects.count() == 0
    assert not AuditEvent.objects.filter(action="customer.desired_date_waitlist_created").exists()


def test_database_rejects_titan_non_inventory_interest(customer):
    actor = User.objects.create_user(
        username="constraint-actor", password="test-password", is_staff=True
    )
    responsible = User.objects.create_user(
        username="constraint-responsible", password="test-password", is_staff=True
    )
    entry = create_desired_date_waitlist_entry(
        customer=customer,
        actor=actor,
        values={
            "business_scope": "titan",
            "preferred_date_1": date.today() + timedelta(days=1),
            "preferred_date_2": None,
            "preferred_date_3": None,
            "flexible_start": None,
            "flexible_end": None,
            "interest_kind": "material",
            "quantity": 1,
            "responsible": responsible,
        },
    )

    with pytest.raises(IntegrityError), transaction.atomic():
        DesiredDateWaitlistEntry.objects.filter(pk=entry.pk).update(interest_kind="local")


@pytest.mark.parametrize(
    "changes",
    (
        {
            "preferred_date_1": None,
            "preferred_date_2": None,
            "preferred_date_3": None,
        },
        {
            "preferred_date_2": None,
            "preferred_date_3": date.today() + timedelta(days=3),
        },
        {
            "flexible_start": date.today() + timedelta(days=4),
            "flexible_end": date.today() + timedelta(days=5),
        },
        {
            "preferred_date_1": None,
            "preferred_date_2": None,
            "preferred_date_3": None,
            "flexible_start": date.today() + timedelta(days=6),
        },
        {
            "preferred_date_1": None,
            "preferred_date_2": None,
            "preferred_date_3": None,
            "flexible_start": date.today() + timedelta(days=8),
            "flexible_end": date.today() + timedelta(days=7),
        },
        {"preferred_date_2": date.today() + timedelta(days=1)},
    ),
    ids=(
        "no_date_selection",
        "sparse_preferred_dates",
        "preferred_dates_and_flexible_period",
        "partial_flexible_period",
        "reversed_flexible_period",
        "duplicate_preferred_dates",
    ),
)
def test_database_rejects_invalid_date_selection_via_queryset_update(customer, changes):
    actor = User.objects.create_user(
        username=f"date-constraint-actor-{Customer.objects.count()}",
        password="test-password",
        is_staff=True,
    )
    responsible = User.objects.create_user(
        username=f"date-constraint-responsible-{Customer.objects.count()}",
        password="test-password",
        is_staff=True,
    )
    entry = create_desired_date_waitlist_entry(
        customer=customer,
        actor=actor,
        values={
            "business_scope": "titan",
            "preferred_date_1": date.today() + timedelta(days=1),
            "preferred_date_2": None,
            "preferred_date_3": None,
            "flexible_start": None,
            "flexible_end": None,
            "interest_kind": "material",
            "quantity": 1,
            "responsible": responsible,
        },
    )

    with pytest.raises(IntegrityError), transaction.atomic():
        DesiredDateWaitlistEntry.objects.filter(pk=entry.pk).update(**changes)


def test_api_rejects_titan_only_material_pack_for_hahitantsoa(staff_client, customer):
    client, _ = staff_client
    responsible = User.objects.create_user(
        username="hahitantsoa-pack-api-responsible",
        password="test-password",
        is_staff=True,
    )

    response = client.post(
        f"/api/v1/customers/{customer.id}/desired-dates/",
        {
            "business_scope": "hahitantsoa",
            "flexible_start": (date.today() + timedelta(days=20)).isoformat(),
            "flexible_end": (date.today() + timedelta(days=25)).isoformat(),
            "interest_kind": "material_pack",
            "quantity": 3,
            "responsible_id": responsible.id,
        },
        content_type="application/json",
    )

    assert response.status_code == 400


def test_database_rejects_titan_only_material_pack_for_hahitantsoa(customer):
    actor = User.objects.create_user(
        username="hahitantsoa-pack-db-actor",
        password="test-password",
        is_staff=True,
    )
    responsible = User.objects.create_user(
        username="hahitantsoa-pack-db-responsible",
        password="test-password",
        is_staff=True,
    )
    entry = create_desired_date_waitlist_entry(
        customer=customer,
        actor=actor,
        values={
            "business_scope": "hahitantsoa",
            "preferred_date_1": None,
            "preferred_date_2": None,
            "preferred_date_3": None,
            "flexible_start": date.today() + timedelta(days=20),
            "flexible_end": date.today() + timedelta(days=25),
            "interest_kind": "local",
            "quantity": 3,
            "responsible": responsible,
        },
    )

    with pytest.raises(IntegrityError), transaction.atomic():
        DesiredDateWaitlistEntry.objects.filter(pk=entry.pk).update(interest_kind="material_pack")
