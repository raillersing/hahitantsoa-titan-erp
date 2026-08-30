from datetime import timedelta

import pytest
from django.test import Client
from django.utils import timezone

from apps.customers.models import Customer
from apps.hahitantsoa.lifecycle import get_hahitantsoa_lifecycle_summary
from apps.hahitantsoa.models import HahitantsoaEventDraft
from apps.reservations.lifecycle import get_reservation_lifecycle_summary
from apps.reservations.models import ReservationDraft

pytestmark = pytest.mark.django_db


def _actor(django_user_model):
    return django_user_model.objects.create_user(
        username="lifecycle-read-operator", password="test-pass", is_staff=True
    )


def test_titan_lifecycle_reports_confirmation_prerequisites(django_user_model):
    draft = ReservationDraft.objects.create(
        customer=Customer.objects.create(display_name="Client Titan"),
        start_at=timezone.now(),
        end_at=timezone.now() + timedelta(hours=2),
    )

    summary = get_reservation_lifecycle_summary(reservation_draft=draft)

    assert summary.domain == "titan"
    assert summary.next_action == "sign_contract"
    assert summary.blockers == ["contract_signature_required"]
    assert [step.key for step in summary.steps] == [
        "contract",
        "deposit",
        "confirmation",
        "closeout",
    ]

    client = Client()
    assert client.get(f"/api/v1/reservations/drafts/{draft.id}/lifecycle/").status_code in {
        401,
        403,
    }
    client.force_login(_actor(django_user_model))
    response = client.get(f"/api/v1/reservations/drafts/{draft.id}/lifecycle/")
    assert response.status_code == 200
    assert response.json()["next_action"] == "sign_contract"


def test_hahitantsoa_lifecycle_reports_confirmation_prerequisites(django_user_model):
    start_at = timezone.now()
    event_draft = HahitantsoaEventDraft.objects.create(
        customer=Customer.objects.create(display_name="Client Hahitantsoa"),
        event_name="Événement de test",
        start_at=start_at,
        end_at=start_at + timedelta(hours=2),
    )

    summary = get_hahitantsoa_lifecycle_summary(event_draft=event_draft)

    assert summary.domain == "hahitantsoa"
    assert summary.next_action == "sign_contract"
    client = Client()
    client.force_login(_actor(django_user_model))
    response = client.get(f"/api/v1/hahitantsoa/event-drafts/{event_draft.id}/lifecycle/")
    assert response.status_code == 200
    assert response.json()["dossier_id"] == str(event_draft.id)
