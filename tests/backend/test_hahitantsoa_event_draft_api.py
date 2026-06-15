from datetime import timedelta

import pytest
from django.utils import timezone

from apps.customers.models import Customer
from apps.hahitantsoa.models import HahitantsoaEventDraft, HahitantsoaEventDraftLine
from apps.inventory.models import InventoryAvailability, InventoryItem

pytestmark = pytest.mark.django_db

EVENT_DRAFT_LIST_URL = "/api/v1/hahitantsoa/event-drafts/"


@pytest.fixture
def authenticated_client(client, django_user_model):
    user = django_user_model.objects.create_user(
        username="hahitantsoa-event-draft-user",
        password="test-password",
    )
    client.force_login(user)
    return client


def _period():
    start_at = timezone.now().replace(microsecond=0)
    return start_at, start_at + timedelta(hours=6)


def _customer(name: str = "Hahitantsoa Customer") -> Customer:
    return Customer.objects.create(display_name=name)


def _item(name: str = "Shared material", kind: str = "material") -> InventoryItem:
    return InventoryItem.objects.create(name=name, kind=kind)


def _payload(customer: Customer, item: InventoryItem) -> dict:
    start_at, end_at = _period()
    return {
        "customer_id": str(customer.id),
        "event_name": "Corporate gala",
        "venue_name": "City venue",
        "location_details": "Main room",
        "service_notes": "DJ and lights",
        "start_at": start_at.isoformat(),
        "end_at": end_at.isoformat(),
        "notes": "Planning notes",
        "lines": [
            {
                "inventory_item_id": str(item.id),
                "quantity": 3,
                "notes": "Main line",
            }
        ],
    }


def test_hahitantsoa_event_draft_list_rejects_unauthenticated_user(client) -> None:
    response = client.get(EVENT_DRAFT_LIST_URL)

    assert response.status_code in {401, 403}


def test_authenticated_user_can_create_hahitantsoa_event_draft(authenticated_client) -> None:
    customer = _customer()
    item = _item(kind="article")

    response = authenticated_client.post(
        EVENT_DRAFT_LIST_URL,
        data=_payload(customer, item),
        content_type="application/json",
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["status"] == "draft"
    assert payload["customer_id"] == str(customer.id)
    assert payload["customer_display_name"] == customer.display_name
    assert payload["public_reference"].startswith("HED-")
    assert payload["event_name"] == "Corporate gala"
    assert payload["lines"][0]["inventory_item_id"] == str(item.id)
    assert payload["lines"][0]["inventory_item_kind"] == "article"
    assert HahitantsoaEventDraft.objects.count() == 1
    assert HahitantsoaEventDraftLine.objects.count() == 1


def test_authenticated_user_can_read_event_draft_list_and_detail(authenticated_client) -> None:
    start_at, end_at = _period()
    draft = HahitantsoaEventDraft.objects.create(
        customer=_customer(),
        event_name="Planning event",
        start_at=start_at,
        end_at=end_at,
    )
    HahitantsoaEventDraftLine.objects.create(
        event_draft=draft,
        inventory_item=_item(),
        quantity=1,
    )

    list_response = authenticated_client.get(EVENT_DRAFT_LIST_URL)
    detail_response = authenticated_client.get(f"{EVENT_DRAFT_LIST_URL}{draft.id}/")

    assert list_response.status_code == 200
    assert detail_response.status_code == 200
    assert list_response.json()[0]["id"] == str(draft.id)
    assert detail_response.json()["id"] == str(draft.id)


def test_event_draft_rejects_material_pack_lines(authenticated_client) -> None:
    customer = _customer()
    item = _item(kind="material_pack")

    response = authenticated_client.post(
        EVENT_DRAFT_LIST_URL,
        data=_payload(customer, item),
        content_type="application/json",
    )

    assert response.status_code == 400
    assert "lines" in response.json()
    assert HahitantsoaEventDraft.objects.count() == 0


def test_event_draft_update_keeps_scope_bounded_and_no_inventory_write(
    authenticated_client,
) -> None:
    start_at, end_at = _period()
    customer = _customer()
    first_item = _item(name="Shared article", kind="article")
    second_item = _item(name="Shared material", kind="material")
    draft = HahitantsoaEventDraft.objects.create(
        customer=customer,
        event_name="Initial event",
        start_at=start_at,
        end_at=end_at,
        notes="Initial notes",
    )
    HahitantsoaEventDraftLine.objects.create(
        event_draft=draft,
        inventory_item=first_item,
        quantity=1,
        notes="Initial line",
    )
    availability_count = InventoryAvailability.objects.count()

    response = authenticated_client.patch(
        f"{EVENT_DRAFT_LIST_URL}{draft.id}/",
        data={
            "event_name": "Updated event",
            "venue_name": "Updated venue",
            "lines": [
                {
                    "inventory_item_id": str(second_item.id),
                    "quantity": 2,
                    "notes": "Updated line",
                }
            ],
        },
        content_type="application/json",
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["event_name"] == "Updated event"
    assert payload["venue_name"] == "Updated venue"
    assert payload["lines"][0]["inventory_item_id"] == str(second_item.id)
    assert InventoryAvailability.objects.count() == availability_count


def test_event_draft_detail_rejects_delete(authenticated_client) -> None:
    start_at, end_at = _period()
    draft = HahitantsoaEventDraft.objects.create(
        customer=_customer(),
        event_name="Delete forbidden",
        start_at=start_at,
        end_at=end_at,
    )

    response = authenticated_client.delete(f"{EVENT_DRAFT_LIST_URL}{draft.id}/")

    assert response.status_code == 405
