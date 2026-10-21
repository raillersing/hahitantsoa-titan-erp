"""Saving an assistant draft must not pretend that its proforma was sent."""

from datetime import timedelta
from unittest.mock import patch

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.customers.models import Customer, ProspectStatus
from apps.documents.models import DocumentInstance
from apps.hahitantsoa.models import HahitantsoaEventDraft
from apps.inventory.models import InventoryItem
from apps.reservations.models import ReservationDraft

pytestmark = pytest.mark.django_db


@pytest.fixture
def operator(django_user_model):
    user = django_user_model.objects.create_user(username="prospect-operator", is_staff=True)
    client = APIClient()
    client.force_authenticate(user=user)
    return client, user


def _payload(customer, domain):
    start = timezone.now() + timedelta(days=5)
    payload = {
        "customer_id": str(customer.pk),
        "start_at": start.isoformat(),
        "end_at": (start + timedelta(hours=5)).isoformat(),
        "notes": "Parcours avec prospect",
    }
    if domain == "hahitantsoa":
        payload.update(
            event_name="Réception prospect",
            rental_type="bare",
            service_notes="Voilage et informations de service conservés",
            lines=[],
        )
    else:
        item = InventoryItem.objects.create(name="Chaise prospect", kind="article")
        payload["lines"] = [{"inventory_item_id": str(item.pk), "quantity": 2}]
    return payload


def _endpoint(domain):
    return (
        "/api/v1/hahitantsoa/event-drafts/"
        if domain == "hahitantsoa"
        else "/api/v1/reservations/drafts/"
    )


@pytest.mark.parametrize("domain", ["hahitantsoa", "titan"])
@pytest.mark.parametrize("status", ProspectStatus.values)
def test_prospect_can_save_and_resume_draft_without_fabricating_crm_transition(
    operator, domain, status
):
    client, user = operator
    customer = Customer.objects.create(
        display_name="Prospect parcours", lifecycle_status="prospect", prospect_status=status
    )
    payload = _payload(customer, domain)
    response = client.post(_endpoint(domain), payload, format="json")
    assert response.status_code == 201, response.data
    draft_id = response.data["id"]
    model = HahitantsoaEventDraft if domain == "hahitantsoa" else ReservationDraft
    assert model.objects.filter(customer=customer).count() == 1
    draft = model.objects.get(pk=draft_id)
    assert draft.created_by == user
    response = client.patch(
        f"{_endpoint(domain)}{draft_id}/", {"notes": "Correction après reprise"}, format="json"
    )
    assert response.status_code == 200, response.data
    draft.refresh_from_db()
    assert draft.notes == "Correction après reprise"
    if domain == "hahitantsoa":
        assert draft.service_notes == payload["service_notes"]
        assert DocumentInstance.objects.filter(hahitantsoa_event_draft=draft).count() == 1
    customer.refresh_from_db()
    assert customer.prospect_status == status
    assert customer.prospect_status_changed_at is None
    assert customer.updated_by_id is None


def test_failed_document_preparation_rolls_back_hahitantsoa_draft_and_retry_saves_once(operator):
    client, _ = operator
    customer = Customer.objects.create(display_name="Prospect retry", lifecycle_status="prospect")
    payload = _payload(customer, "hahitantsoa")
    with (
        patch(
            "apps.documents.services.create_document_instance_from_hahitantsoa_event_draft",
            side_effect=RuntimeError("Preparation unavailable"),
        ),
        pytest.raises(RuntimeError, match="Preparation unavailable"),
    ):
        client.post(_endpoint("hahitantsoa"), payload, format="json")
    assert not HahitantsoaEventDraft.objects.filter(customer=customer).exists()
    assert not DocumentInstance.objects.filter(customer=customer).exists()
    response = client.post(_endpoint("hahitantsoa"), payload, format="json")
    assert response.status_code == 201, response.data
    assert HahitantsoaEventDraft.objects.filter(customer=customer).count() == 1
    assert DocumentInstance.objects.filter(customer=customer).count() == 1
    customer.refresh_from_db()
    assert customer.prospect_status == ProspectStatus.NEW
