from datetime import timedelta

import pytest
from django.test import Client
from django.utils import timezone

from apps.customers.models import Customer
from apps.hahitantsoa.models import HahitantsoaEventDraft, HahitantsoaEventDraftLine
from apps.inventory.models import InventoryAvailability, InventoryItem

pytestmark = pytest.mark.django_db

EVENT_DRAFT_LIST_URL = "/api/v1/hahitantsoa/event-drafts/"


@pytest.fixture
def authenticated_client(django_user_model):
    client = Client()
    user = django_user_model.objects.create_user(
        username="hahitantsoa-event-draft-user",
        password="test-password",
    )
    client.force_login(user)
    client.test_user = user
    return client


@pytest.fixture
def authenticated_client_two(django_user_model):
    client = Client()
    user = django_user_model.objects.create_user(
        username="hahitantsoa-event-draft-user-two",
        password="test-password",
    )
    client.force_login(user)
    client.test_user = user
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
    assert HahitantsoaEventDraft.objects.get().created_by is not None


def test_authenticated_user_can_read_event_draft_list_and_detail(authenticated_client) -> None:
    start_at, end_at = _period()
    user = authenticated_client.test_user
    draft = HahitantsoaEventDraft.objects.create(
        customer=_customer(),
        event_name="Planning event",
        start_at=start_at,
        end_at=end_at,
        created_by=user,
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
    user = authenticated_client.test_user
    customer = _customer()
    first_item = _item(name="Shared article", kind="article")
    second_item = _item(name="Shared material", kind="material")
    draft = HahitantsoaEventDraft.objects.create(
        customer=customer,
        event_name="Initial event",
        start_at=start_at,
        end_at=end_at,
        notes="Initial notes",
        created_by=user,
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
    assert len(payload["lines"]) == 1
    assert payload["lines"][0]["inventory_item_id"] == str(second_item.id)
    assert InventoryAvailability.objects.count() == availability_count
    draft.refresh_from_db()
    assert draft.updated_by == user
    assert draft.lines.filter(is_deleted=False).count() == 1
    assert draft.lines.filter(is_deleted=True).count() == 1
    assert list(
        draft.lines.filter(is_deleted=False).values_list("inventory_item_id", flat=True)
    ) == [second_item.id]


def test_event_draft_update_can_keep_same_item_without_inventory_write(
    authenticated_client,
) -> None:
    start_at, end_at = _period()
    user = authenticated_client.test_user
    customer = _customer()
    item = _item(name="Shared article", kind="article")
    draft = HahitantsoaEventDraft.objects.create(
        customer=customer,
        event_name="Initial event",
        start_at=start_at,
        end_at=end_at,
        notes="Initial notes",
        created_by=user,
    )
    line = HahitantsoaEventDraftLine.objects.create(
        event_draft=draft,
        inventory_item=item,
        quantity=1,
        notes="Initial line",
    )
    availability_count = InventoryAvailability.objects.count()

    response = authenticated_client.patch(
        f"{EVENT_DRAFT_LIST_URL}{draft.id}/",
        data={
            "lines": [
                {
                    "inventory_item_id": str(item.id),
                    "quantity": 4,
                    "notes": "Updated line",
                }
            ],
        },
        content_type="application/json",
    )

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["lines"]) == 1
    assert payload["lines"][0]["id"] == str(line.id)
    assert payload["lines"][0]["inventory_item_id"] == str(item.id)
    assert payload["lines"][0]["quantity"] == 4
    assert payload["lines"][0]["notes"] == "Updated line"
    assert InventoryAvailability.objects.count() == availability_count
    draft.refresh_from_db()
    line.refresh_from_db()
    assert draft.updated_by == user
    assert draft.lines.filter(is_deleted=False).count() == 1
    assert draft.lines.filter(is_deleted=True).count() == 0
    assert line.is_deleted is False
    assert line.quantity == 4
    assert line.notes == "Updated line"


def test_event_draft_update_can_restore_previously_soft_deleted_item(
    authenticated_client,
) -> None:
    start_at, end_at = _period()
    user = authenticated_client.test_user
    customer = _customer()
    first_item = _item(name="Shared article", kind="article")
    second_item = _item(name="Shared material", kind="material")
    draft = HahitantsoaEventDraft.objects.create(
        customer=customer,
        event_name="Initial event",
        start_at=start_at,
        end_at=end_at,
        notes="Initial notes",
        created_by=user,
    )
    first_line = HahitantsoaEventDraftLine.objects.create(
        event_draft=draft,
        inventory_item=first_item,
        quantity=1,
        notes="First line",
    )
    availability_count = InventoryAvailability.objects.count()

    first_response = authenticated_client.patch(
        f"{EVENT_DRAFT_LIST_URL}{draft.id}/",
        data={
            "lines": [
                {
                    "inventory_item_id": str(second_item.id),
                    "quantity": 2,
                    "notes": "Second line",
                }
            ],
        },
        content_type="application/json",
    )

    assert first_response.status_code == 200

    second_response = authenticated_client.patch(
        f"{EVENT_DRAFT_LIST_URL}{draft.id}/",
        data={
            "lines": [
                {
                    "inventory_item_id": str(first_item.id),
                    "quantity": 3,
                    "notes": "Restored first line",
                }
            ],
        },
        content_type="application/json",
    )

    assert second_response.status_code == 200
    payload = second_response.json()
    assert len(payload["lines"]) == 1
    assert payload["lines"][0]["id"] == str(first_line.id)
    assert payload["lines"][0]["inventory_item_id"] == str(first_item.id)
    assert payload["lines"][0]["quantity"] == 3
    assert payload["lines"][0]["notes"] == "Restored first line"
    assert InventoryAvailability.objects.count() == availability_count
    draft.refresh_from_db()
    first_line.refresh_from_db()
    second_line = draft.lines.get(inventory_item=second_item)
    assert draft.updated_by == user
    assert draft.lines.filter(is_deleted=False).count() == 1
    assert draft.lines.filter(is_deleted=True).count() == 1
    assert first_line.is_deleted is False
    assert first_line.deleted_at is None
    assert first_line.quantity == 3
    assert first_line.notes == "Restored first line"
    assert second_line.is_deleted is True
    assert second_line.deleted_at is not None


def test_event_draft_soft_delete_hides_draft_without_inventory_write(authenticated_client) -> None:
    start_at, end_at = _period()
    user = authenticated_client.test_user
    item = _item()
    draft = HahitantsoaEventDraft.objects.create(
        customer=_customer(),
        event_name="Delete forbidden",
        start_at=start_at,
        end_at=end_at,
        created_by=user,
    )
    HahitantsoaEventDraftLine.objects.create(
        event_draft=draft,
        inventory_item=item,
        quantity=1,
    )
    InventoryAvailability.objects.create(
        inventory_item=item,
        status="blocked",
        start_at=start_at,
        end_at=end_at,
    )
    availability_count = InventoryAvailability.objects.count()
    line = draft.lines.get()

    response = authenticated_client.delete(f"{EVENT_DRAFT_LIST_URL}{draft.id}/")

    assert response.status_code == 204
    draft.refresh_from_db()
    line.refresh_from_db()
    assert draft.is_deleted is True
    assert draft.deleted_at is not None
    assert draft.updated_by == user
    assert draft.lines.filter(is_deleted=False).count() == 0
    assert draft.lines.filter(is_deleted=True).count() == 1
    assert line.is_deleted is True
    assert line.deleted_at is not None
    assert InventoryAvailability.objects.count() == availability_count
    assert authenticated_client.get(EVENT_DRAFT_LIST_URL).json() == []
    assert authenticated_client.get(f"{EVENT_DRAFT_LIST_URL}{draft.id}/").status_code == 404
    assert (
        authenticated_client.get(
            f"{EVENT_DRAFT_LIST_URL}{draft.id}/availability-preview/"
        ).status_code
        == 404
    )


def test_authenticated_user_can_read_event_draft_availability_preview(authenticated_client) -> None:
    start_at, end_at = _period()
    user = authenticated_client.test_user
    available_item = _item(name="Available shared article", kind="article")
    blocked_item = _item(name="Blocked shared material", kind="material")
    draft = HahitantsoaEventDraft.objects.create(
        customer=_customer(),
        event_name="Preview event",
        start_at=start_at,
        end_at=end_at,
        created_by=user,
    )
    available_line = HahitantsoaEventDraftLine.objects.create(
        event_draft=draft,
        inventory_item=available_item,
        quantity=1,
    )
    blocked_line = HahitantsoaEventDraftLine.objects.create(
        event_draft=draft,
        inventory_item=blocked_item,
        quantity=2,
    )
    InventoryAvailability.objects.create(
        inventory_item=blocked_item,
        status="blocked",
        start_at=start_at,
        end_at=end_at,
    )

    response = authenticated_client.get(f"{EVENT_DRAFT_LIST_URL}{draft.id}/availability-preview/")

    assert response.status_code == 200
    payload = response.json()
    assert payload["event_draft_id"] == str(draft.id)
    assert payload["public_reference"] == draft.public_reference
    assert payload["line_count"] == 2
    assert payload["available_line_count"] == 1
    assert payload["unavailable_line_count"] == 1
    assert [line["event_draft_line_id"] for line in payload["lines"]] == [
        str(available_line.id),
        str(blocked_line.id),
    ]
    assert [line["status"] for line in payload["lines"]] == ["available", "unavailable"]
    assert [line["conflict_count"] for line in payload["lines"]] == [0, 1]


def test_event_draft_availability_preview_returns_404_for_soft_deleted_draft(
    authenticated_client,
) -> None:
    start_at, end_at = _period()
    user = authenticated_client.test_user
    draft = HahitantsoaEventDraft.objects.create(
        customer=_customer(),
        event_name="Hidden preview",
        start_at=start_at,
        end_at=end_at,
        is_deleted=True,
        deleted_at=timezone.now(),
        created_by=user,
    )

    response = authenticated_client.get(f"{EVENT_DRAFT_LIST_URL}{draft.id}/availability-preview/")

    assert response.status_code == 404


def test_event_draft_availability_preview_rejects_write_methods(authenticated_client) -> None:
    start_at, end_at = _period()
    user = authenticated_client.test_user
    draft = HahitantsoaEventDraft.objects.create(
        customer=_customer(),
        event_name="Readonly preview",
        start_at=start_at,
        end_at=end_at,
        created_by=user,
    )

    response = authenticated_client.post(f"{EVENT_DRAFT_LIST_URL}{draft.id}/availability-preview/")

    assert response.status_code == 405


def test_second_user_cannot_list_read_update_delete_or_preview_another_users_draft(
    authenticated_client,
    authenticated_client_two,
) -> None:
    start_at, end_at = _period()
    owner = authenticated_client.test_user
    other_user = authenticated_client_two.test_user
    item = _item()
    draft = HahitantsoaEventDraft.objects.create(
        customer=_customer(),
        event_name="Private event",
        start_at=start_at,
        end_at=end_at,
        created_by=owner,
    )
    HahitantsoaEventDraftLine.objects.create(
        event_draft=draft,
        inventory_item=item,
        quantity=1,
    )

    list_response = authenticated_client_two.get(EVENT_DRAFT_LIST_URL)
    detail_response = authenticated_client_two.get(f"{EVENT_DRAFT_LIST_URL}{draft.id}/")
    update_response = authenticated_client_two.patch(
        f"{EVENT_DRAFT_LIST_URL}{draft.id}/",
        data={"event_name": "Should stay hidden"},
        content_type="application/json",
    )
    delete_response = authenticated_client_two.delete(f"{EVENT_DRAFT_LIST_URL}{draft.id}/")
    preview_response = authenticated_client_two.get(
        f"{EVENT_DRAFT_LIST_URL}{draft.id}/availability-preview/"
    )

    assert list_response.status_code == 200
    assert list_response.json() == []
    assert detail_response.status_code == 404
    assert update_response.status_code == 404
    assert delete_response.status_code == 404
    assert preview_response.status_code == 404
    draft.refresh_from_db()
    assert draft.created_by == owner
    assert draft.updated_by != other_user
    assert draft.is_deleted is False


def test_event_draft_detail_hides_soft_deleted_lines_after_update(authenticated_client) -> None:
    start_at, end_at = _period()
    user = authenticated_client.test_user
    first_item = _item(name="Shared article", kind="article")
    second_item = _item(name="Shared material", kind="material")
    draft = HahitantsoaEventDraft.objects.create(
        customer=_customer(),
        event_name="Line replacement event",
        start_at=start_at,
        end_at=end_at,
        created_by=user,
    )
    original_line = HahitantsoaEventDraftLine.objects.create(
        event_draft=draft,
        inventory_item=first_item,
        quantity=1,
    )

    response = authenticated_client.put(
        f"{EVENT_DRAFT_LIST_URL}{draft.id}/",
        data=_payload(draft.customer, second_item),
        content_type="application/json",
    )

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["lines"]) == 1
    assert payload["lines"][0]["inventory_item_id"] == str(second_item.id)
    original_line.refresh_from_db()
    assert original_line.is_deleted is True
    assert original_line.deleted_at is not None
    detail_response = authenticated_client.get(f"{EVENT_DRAFT_LIST_URL}{draft.id}/")
    assert detail_response.status_code == 200
    assert len(detail_response.json()["lines"]) == 1
    assert detail_response.json()["lines"][0]["inventory_item_id"] == str(second_item.id)
