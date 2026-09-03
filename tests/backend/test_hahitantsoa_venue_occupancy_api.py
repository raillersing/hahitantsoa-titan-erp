from datetime import datetime, timedelta

import pytest
from django.test import Client
from django.utils import timezone

from apps.customers.models import Customer
from apps.hahitantsoa.models import HahitantsoaEventDraft

pytestmark = pytest.mark.django_db

HAHITANTSOA_VENUE_OCCUPANCY_URL = "/api/v1/hahitantsoa/venue-occupancy/"
EXPECTED_ITEM_FIELDS = {
    "public_reference",
    "venue_name",
    "start_at",
    "end_at",
    "occupancy_status",
}


@pytest.fixture
def reservation_sensitive_client(django_user_model):
    client = Client()
    user = django_user_model.objects.create_user(
        username="hahitantsoa-venue-planner",
        password="test-password",
        is_staff=True,
    )
    client.force_login(user)
    return client


@pytest.fixture
def authenticated_client(django_user_model):
    client = Client()
    user = django_user_model.objects.create_user(
        username="hahitantsoa-venue-viewer",
        password="test-password",
    )
    client.force_login(user)
    return client


def _period() -> tuple[datetime, datetime]:
    start_at = timezone.now().replace(microsecond=0)
    return start_at, start_at + timedelta(hours=4)


def _query_params(start_at: datetime, end_at: datetime) -> dict[str, str]:
    return {
        "start_at": start_at.isoformat().replace("+00:00", "Z"),
        "end_at": end_at.isoformat().replace("+00:00", "Z"),
    }


def _event_draft(*, status: str, start_at: datetime, end_at: datetime, venue_name: str):
    customer = Customer.objects.create(display_name=f"Customer for {venue_name}")
    return HahitantsoaEventDraft.objects.create(
        customer=customer,
        event_name="Private event",
        status=status,
        venue_name=venue_name,
        start_at=start_at,
        end_at=end_at,
    )


def test_venue_occupancy_requires_reservation_sensitive_access(client) -> None:
    start_at, end_at = _period()

    response = client.get(HAHITANTSOA_VENUE_OCCUPANCY_URL, data=_query_params(start_at, end_at))

    assert response.status_code in {401, 403}


def test_venue_occupancy_rejects_an_authenticated_user_without_required_access(
    authenticated_client,
) -> None:
    start_at, end_at = _period()

    response = authenticated_client.get(
        HAHITANTSOA_VENUE_OCCUPANCY_URL,
        data=_query_params(start_at, end_at),
    )

    assert response.status_code == 403


def test_venue_occupancy_returns_drafts_as_options_and_confirmed_events_as_reserved(
    reservation_sensitive_client,
) -> None:
    start_at, end_at = _period()
    draft = _event_draft(
        status="draft", start_at=start_at, end_at=end_at, venue_name="Salle Orchidée"
    )
    confirmed = _event_draft(
        status="confirmed", start_at=start_at, end_at=end_at, venue_name="Salle Jardin"
    )
    _event_draft(
        status="confirmed",
        start_at=end_at,
        end_at=end_at + timedelta(hours=2),
        venue_name="Salle suivante",
    )

    response = reservation_sensitive_client.get(
        HAHITANTSOA_VENUE_OCCUPANCY_URL,
        data=_query_params(start_at, end_at),
    )

    assert response.status_code == 200
    payload = response.json()
    assert set(payload) == {"items", "count"}
    assert payload["count"] == len(payload["items"]) == 2
    assert payload["items"] == [
        {
            "public_reference": draft.public_reference,
            "venue_name": "Salle Orchidée",
            "start_at": start_at.isoformat().replace("+00:00", "Z"),
            "end_at": end_at.isoformat().replace("+00:00", "Z"),
            "occupancy_status": "option",
        },
        {
            "public_reference": confirmed.public_reference,
            "venue_name": "Salle Jardin",
            "start_at": start_at.isoformat().replace("+00:00", "Z"),
            "end_at": end_at.isoformat().replace("+00:00", "Z"),
            "occupancy_status": "reserved",
        },
    ]
    assert all(set(item) == EXPECTED_ITEM_FIELDS for item in payload["items"])


@pytest.mark.parametrize("offset", [timedelta(), -timedelta(seconds=1)])
def test_venue_occupancy_rejects_an_invalid_period(reservation_sensitive_client, offset) -> None:
    start_at, _ = _period()

    response = reservation_sensitive_client.get(
        HAHITANTSOA_VENUE_OCCUPANCY_URL,
        data=_query_params(start_at, start_at + offset),
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "Reservation period end_at must be after start_at."}
