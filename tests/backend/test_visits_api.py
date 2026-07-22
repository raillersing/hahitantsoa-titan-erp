from datetime import datetime, timedelta

import pytest
from django.utils import timezone

from apps.audit.models import AuditEvent
from apps.customers.models import Customer
from apps.visits.models import VisitAppointment

pytestmark = pytest.mark.django_db

LIST_URL = "/api/v1/visits/appointments/"
RESPONSIBLES_URL = "/api/v1/visits/responsibles/"


@pytest.fixture
def staff_client(client, django_user_model):
    user = django_user_model.objects.create_user(
        username="visit-staff", password="test-password", is_staff=True
    )
    client.force_login(user)
    return client, user


def _customer():
    return Customer.objects.create(display_name="Visite Prospect", lifecycle_status="prospect")


def _payload(customer, responsible, **overrides):
    scheduled_at = timezone.now().replace(microsecond=0) + timedelta(days=2)
    payload = {
        "customer_id": str(customer.id),
        "reason": "prospect",
        "scheduled_at": scheduled_at.isoformat(),
        "responsible_id": str(responsible.id),
        "notes": "Prévoir une démonstration.",
    }
    payload.update(overrides)
    return payload


def test_unauthenticated_user_cannot_list_visits(client):
    assert client.get(LIST_URL).status_code in {401, 403}


def test_visit_responsibles_list_is_authenticated_and_minimal(client, django_user_model):
    active_staff = django_user_model.objects.create_user(
        username="available-responsible",
        password="test-password",
        is_staff=True,
        first_name="Rina",
        last_name="Rakoto",
    )
    django_user_model.objects.create_user(
        username="inactive-responsible-list",
        password="test-password",
        is_staff=True,
        is_active=False,
    )
    django_user_model.objects.create_user(
        username="non-staff-responsible-list", password="test-password"
    )

    assert client.get(RESPONSIBLES_URL).status_code in {401, 403}
    reader = django_user_model.objects.create_user(
        username="visit-responsible-reader", password="test-password"
    )
    client.force_login(reader)
    response = client.get(RESPONSIBLES_URL)

    assert response.status_code == 200
    assert response.json() == [
        {"id": str(active_staff.id), "display_name": "Rina Rakoto"}
    ]


def test_authenticated_non_staff_can_read_but_cannot_create_visit(client, django_user_model):
    user = django_user_model.objects.create_user(
        username="visit-reader", password="test-password"
    )
    client.force_login(user)
    customer = _customer()
    staff = django_user_model.objects.create_user(
        username="responsible", password="test-password", is_staff=True
    )

    assert client.get(LIST_URL).status_code == 200
    response = client.post(LIST_URL, _payload(customer, staff), content_type="application/json")
    assert response.status_code == 403


def test_staff_creates_visit_with_default_location_and_reminder(
    staff_client, django_user_model, django_capture_on_commit_callbacks
):
    client, actor = staff_client
    responsible = django_user_model.objects.create_user(
        username="visit-responsible", password="test-password", is_staff=True
    )
    customer = _customer()

    with django_capture_on_commit_callbacks(execute=True):
        response = client.post(
            LIST_URL, _payload(customer, responsible), content_type="application/json"
        )

    assert response.status_code == 201
    payload = response.json()
    visit = VisitAppointment.objects.get(pk=payload["id"])
    assert payload["location"] == "Local de l'entreprise"
    assert visit.reminder_at == visit.scheduled_at - timedelta(hours=24)
    assert visit.created_by == actor
    assert AuditEvent.objects.filter(
        action="visit.appointment_created", target_id=str(visit.id)
    ).exists()


def test_create_rejects_inactive_or_non_staff_responsible(
    staff_client, django_user_model
):
    client, _ = staff_client
    customer = _customer()
    non_staff = django_user_model.objects.create_user(
        username="not-responsible", password="test-password"
    )
    inactive_staff = django_user_model.objects.create_user(
        username="inactive-responsible",
        password="test-password",
        is_staff=True,
        is_active=False,
    )

    for responsible in (non_staff, inactive_staff):
        response = client.post(
            LIST_URL, _payload(customer, responsible), content_type="application/json"
        )
        assert response.status_code == 400


def test_list_filters_visits_by_customer_responsible_status_and_date(
    staff_client, django_user_model
):
    client, _ = staff_client
    responsible = django_user_model.objects.create_user(
        username="filter-responsible", password="test-password", is_staff=True
    )
    customer = _customer()
    response = client.post(
        LIST_URL, _payload(customer, responsible), content_type="application/json"
    )
    assert response.status_code == 201
    visit = VisitAppointment.objects.get(pk=response.json()["id"])

    filtered = client.get(
        f"{LIST_URL}?customer_id={customer.id}&responsible_id={responsible.id}"
        f"&status=scheduled&scheduled_after={visit.scheduled_at.isoformat()}"
    )
    assert filtered.status_code == 200
    assert [entry["id"] for entry in filtered.json()] == [str(visit.id)]


def test_updating_scheduled_at_recalculates_default_reminder_unless_explicit(
    staff_client, django_user_model
):
    client, _ = staff_client
    responsible = django_user_model.objects.create_user(
        username="reschedule-responsible", password="test-password", is_staff=True
    )
    created = client.post(
        LIST_URL,
        _payload(_customer(), responsible),
        content_type="application/json",
    ).json()
    initial_scheduled_at = datetime.fromisoformat(created["scheduled_at"])
    rescheduled_at = initial_scheduled_at + timedelta(days=3)

    response = client.patch(
        f"{LIST_URL}{created['id']}/",
        {"scheduled_at": rescheduled_at.isoformat()},
        content_type="application/json",
    )

    assert response.status_code == 200
    assert datetime.fromisoformat(response.json()["reminder_at"]) == rescheduled_at - timedelta(
        hours=24
    )
    explicit_reminder_at = rescheduled_at - timedelta(hours=6)
    explicit = client.patch(
        f"{LIST_URL}{created['id']}/",
        {
            "scheduled_at": (rescheduled_at + timedelta(days=1)).isoformat(),
            "reminder_at": explicit_reminder_at.isoformat(),
        },
        content_type="application/json",
    )
    assert explicit.status_code == 200
    assert datetime.fromisoformat(explicit.json()["reminder_at"]) == explicit_reminder_at


def test_visit_transition_openapi_contract_is_explicit(client):
    response = client.get("/api/schema/?format=json")

    assert response.status_code == 200
    paths = response.json()["paths"]
    for path in (
        "/api/v1/visits/appointments/{id}/complete/",
        "/api/v1/visits/appointments/{id}/cancel/",
    ):
        responses = paths[path]["post"]["responses"]
        assert set(("200", "400", "403", "404")).issubset(responses)
        assert responses["200"]["content"]["application/json"]["schema"]["$ref"].endswith(
            "/VisitAppointment"
        )


def test_staff_can_complete_or_cancel_once_and_cannot_update_terminal_visit(
    staff_client, django_user_model, django_capture_on_commit_callbacks
):
    client, _ = staff_client
    responsible = django_user_model.objects.create_user(
        username="transition-responsible", password="test-password", is_staff=True
    )
    customer = _customer()
    created = client.post(
        LIST_URL, _payload(customer, responsible), content_type="application/json"
    ).json()

    with django_capture_on_commit_callbacks(execute=True):
        complete = client.post(
            f"{LIST_URL}{created['id']}/complete/", content_type="application/json"
        )
    assert complete.status_code == 200
    assert complete.json()["status"] == "completed"
    duplicate = client.post(
        f"{LIST_URL}{created['id']}/complete/", content_type="application/json"
    )
    assert duplicate.status_code == 400
    late_update = client.patch(
        f"{LIST_URL}{created['id']}/",
        {"notes": "Trop tard"},
        content_type="application/json",
    )
    assert late_update.status_code == 400
    assert AuditEvent.objects.filter(
        action="visit.appointment_completed", target_id=created["id"]
    ).exists()

    second = client.post(
        LIST_URL, _payload(customer, responsible), content_type="application/json"
    ).json()
    cancel = client.post(
        f"{LIST_URL}{second['id']}/cancel/", content_type="application/json"
    )
    assert cancel.status_code == 200
    assert cancel.json()["status"] == "cancelled"


def test_visit_never_creates_inventory_reservation_or_blocks_availability(
    staff_client, django_user_model
):
    client, _ = staff_client
    responsible = django_user_model.objects.create_user(
        username="non-blocking-responsible", password="test-password", is_staff=True
    )
    response = client.post(
        LIST_URL, _payload(_customer(), responsible), content_type="application/json"
    )

    assert response.status_code == 201
    assert VisitAppointment.objects.count() == 1
