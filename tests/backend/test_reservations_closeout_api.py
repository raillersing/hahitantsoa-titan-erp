import pytest
from django.utils import timezone

from apps.customers.models import Customer
from apps.reservations.models import ReservationDraft

pytestmark = pytest.mark.django_db

CASHBOX_SESSION_LIST_URL = "/api/v1/cashbox/sessions/"
CLOSEOUT_URL = "/api/v1/reservations/drafts/{pk}/closeout/"


def _customer():
    return Customer.objects.create(display_name="Closeout API Client")


def _reservation_draft():
    from datetime import timedelta

    start = timezone.now().replace(microsecond=0)
    return ReservationDraft.objects.create(
        customer=_customer(),
        start_at=start,
        end_at=start + timedelta(hours=4),
    )


@pytest.fixture
def operator_client(client):
    from django.contrib.auth import get_user_model

    user = get_user_model().objects.create_user(
        username="closeout_op", password="test-pass", is_staff=True
    )
    client.force_login(user)
    return client


def test_closeout_summary_requires_auth(client):
    draft = _reservation_draft()
    response = client.get(CLOSEOUT_URL.format(pk=str(draft.id)))
    assert response.status_code in {401, 403}


def test_closeout_summary_returns_expected_keys(operator_client):
    draft = _reservation_draft()
    response = operator_client.get(CLOSEOUT_URL.format(pk=str(draft.id)))
    assert response.status_code == 200
    data = response.json()
    assert data["reservation_draft_id"] == str(draft.id)
    assert "status" in data
    assert "contract_signed" in data
    assert "deposit_received" in data
    assert "confirmed" in data
    assert "cancelled" in data
    assert "billing" in data
    assert "payments" in data
    assert "logistics" in data
    assert "returns" in data


def test_closeout_summary_404_for_missing_draft(operator_client):
    response = operator_client.get(CLOSEOUT_URL.format(pk="11111111-1111-1111-1111-111111111111"))
    assert response.status_code == 404


def test_closeout_summary_rejects_post(operator_client):
    draft = _reservation_draft()
    response = operator_client.post(CLOSEOUT_URL.format(pk=str(draft.id)))
    assert response.status_code == 405
