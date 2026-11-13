import uuid
from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from apps.customers.models import Customer
from apps.hahitantsoa.models import HahitantsoaEventDraft
from apps.hahitantsoa.serializers import HahitantsoaEventDraftSerializer
from apps.inventory.models import InventoryItem
from apps.reservations.models import ReservationDraft
from apps.reservations.serializers import ReservationDraftSerializer
from apps.reservations.wizard_business import create_session_draft

pytestmark = pytest.mark.django_db


def _period():
    start_at = timezone.now().replace(microsecond=0)
    return start_at, start_at + timedelta(hours=2)


def test_titan_reservation_draft_creation_records_and_serializes_author(client):
    user_model = get_user_model()
    user = user_model.objects.create_user(
        username="ando.titan",
        first_name="Ando",
        last_name="Rabeharimanana",
        password="test-password",
    )
    client.force_login(user)

    customer = Customer.objects.create(display_name="Client Titan Test")
    item = InventoryItem.objects.create(
        name="Table pliante", kind="article", rental_price="10000.00"
    )
    start_at, end_at = _period()

    response = client.post(
        "/api/v1/reservations/drafts/",
        data={
            "customer_id": str(customer.id),
            "start_at": start_at.isoformat(),
            "end_at": end_at.isoformat(),
            "notes": "Test de traçabilité auteur Titan.",
            "lines": [
                {
                    "inventory_item_id": str(item.id),
                    "quantity": 2,
                    "notes": "Line note.",
                }
            ],
        },
        content_type="application/json",
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["created_by_id"] == str(user.id)
    assert payload["created_by_username"] == "ando.titan"
    assert payload["created_by_display_name"] == "Ando Rabeharimanana"
    assert payload["created_at"] is not None

    db_draft = ReservationDraft.objects.get(id=payload["id"])
    assert db_draft.created_by == user
    assert db_draft.created_at is not None


def test_hahitantsoa_event_draft_creation_records_and_serializes_author(client):
    user_model = get_user_model()
    user = user_model.objects.create_user(
        username="tantely.hht",
        first_name="Tantely",
        last_name="Rasolofo",
        password="test-password",
    )
    client.force_login(user)

    customer = Customer.objects.create(display_name="Client Hahitantsoa Test")
    item = InventoryItem.objects.create(
        name="Chaise Banquet", kind="article", rental_price="5000.00"
    )
    start_at, end_at = _period()

    response = client.post(
        "/api/v1/hahitantsoa/event-drafts/",
        data={
            "customer_id": str(customer.id),
            "event_name": "Mariage Fête",
            "event_type": "wedding",
            "rental_type": "logistics",
            "venue_name": "Salle Royale",
            "start_at": start_at.isoformat(),
            "end_at": end_at.isoformat(),
            "lines": [
                {
                    "inventory_item_id": str(item.id),
                    "quantity": 50,
                }
            ],
        },
        content_type="application/json",
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["created_by_id"] == str(user.id)
    assert payload["created_by_username"] == "tantely.hht"
    assert payload["created_by_display_name"] == "Tantely Rasolofo"
    assert payload["created_at"] is not None

    db_draft = HahitantsoaEventDraft.objects.get(id=payload["id"])
    assert db_draft.created_by == user
    assert db_draft.created_at is not None


def test_titan_wizard_creation_records_author():
    user_model = get_user_model()
    actor = user_model.objects.create_user(
        username="wizard.creator",
        first_name="Jean",
        last_name="Dupont",
        password="test-password",
        is_staff=True,
    )
    api = APIClient()
    api.force_authenticate(actor)

    customer = Customer.objects.create(display_name="Client Wizard")
    item = InventoryItem.objects.create(
        name="Assiette Porcelaine", kind="material", rental_price="1500.00"
    )

    session_res = api.post(
        "/api/v1/reservations/wizard-sessions/",
        {"client_key": str(uuid.uuid4()), "domain": "titan", "customer_id": str(customer.pk)},
        format="json",
    ).json()

    start_at, end_at = _period()
    payload = {
        "customer_id": str(customer.id),
        "start_at": start_at.isoformat(),
        "end_at": end_at.isoformat(),
        "lines": [
            {
                "inventory_item_id": str(item.id),
                "quantity": 10,
            }
        ],
    }

    session, draft, created = create_session_draft(
        actor=actor,
        session_id=session_res["id"],
        expected_version=session_res["version"],
        domain="titan",
        payload=payload,
        proforma_validity_days=15,
    )

    assert created is True
    assert draft.created_by == actor
    serialized = ReservationDraftSerializer(draft).data
    assert serialized["created_by_id"] == str(actor.id)
    assert serialized["created_by_username"] == "wizard.creator"
    assert serialized["created_by_display_name"] == "Jean Dupont"


def test_serialization_handles_null_created_by_gracefully():
    customer = Customer.objects.create(display_name="Client Legacy")
    start_at, end_at = _period()

    titan_draft = ReservationDraft.objects.create(
        customer=customer,
        start_at=start_at,
        end_at=end_at,
        created_by=None,
    )
    serialized_titan = ReservationDraftSerializer(titan_draft).data
    assert serialized_titan["created_by_id"] is None
    assert serialized_titan["created_by_username"] is None
    assert serialized_titan["created_by_display_name"] is None
    assert serialized_titan["created_at"] is not None

    hht_draft = HahitantsoaEventDraft.objects.create(
        customer=customer,
        start_at=start_at,
        end_at=end_at,
        created_by=None,
    )
    serialized_hht = HahitantsoaEventDraftSerializer(hht_draft).data
    assert serialized_hht["created_by_id"] is None
    assert serialized_hht["created_by_username"] is None
    assert serialized_hht["created_by_display_name"] is None
    assert serialized_hht["created_at"] is not None
