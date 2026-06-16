from datetime import timedelta

import pytest
from django.test import Client
from django.utils import timezone

from apps.customers.models import Customer
from apps.hahitantsoa.models import (
    HahitantsoaEventDraft,
    HahitantsoaEventDraftAmendmentRequest,
    HahitantsoaEventDraftLine,
)
from apps.inventory.models import InventoryAvailability, InventoryItem
from apps.reservations.confirmation import (
    RESERVATION_CONFIRMATION_BLOCKER_ACTIVE_AVAILABILITY_CONFLICT,
    RESERVATION_CONFIRMATION_BLOCKER_MISSING_REQUIRED_DATA,
    RESERVATION_CONFIRMATION_BLOCKER_MISSING_REQUIRED_DEPOSIT,
    RESERVATION_CONFIRMATION_BLOCKER_MISSING_SIGNED_CONTRACT,
)
from apps.reservations.models import ReservationDraft

pytestmark = pytest.mark.django_db

EVENT_DRAFT_LIST_URL = "/api/v1/hahitantsoa/event-drafts/"


def _amendment_request_list_url(event_draft_id) -> str:
    return f"{EVENT_DRAFT_LIST_URL}{event_draft_id}/amendment-requests/"


def _amendment_request_detail_url(event_draft_id, amendment_request_id) -> str:
    return f"{EVENT_DRAFT_LIST_URL}{event_draft_id}/amendment-requests/{amendment_request_id}/"


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


def _customer(
    name: str = "Hahitantsoa Customer",
    *,
    is_active: bool = True,
    is_deleted: bool = False,
) -> Customer:
    return Customer.objects.create(
        display_name=name,
        is_active=is_active,
        is_deleted=is_deleted,
    )


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


def _confirmed_draft(*, user, item: InventoryItem) -> HahitantsoaEventDraft:
    start_at, end_at = _period()
    draft = HahitantsoaEventDraft.objects.create(
        customer=_customer(name="Confirmed draft customer"),
        event_name="Confirmed event",
        start_at=start_at,
        end_at=end_at,
        status="confirmed",
        contract_signed_at=timezone.now(),
        contract_signed_by=user,
        required_deposit_received_at=timezone.now(),
        required_deposit_received_by=user,
        confirmed_at=timezone.now(),
        confirmed_by=user,
        created_by=user,
        updated_by=user,
    )
    HahitantsoaEventDraftLine.objects.create(
        event_draft=draft,
        inventory_item=item,
        quantity=1,
        created_by=user,
        updated_by=user,
    )
    return draft


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
    draft = HahitantsoaEventDraft.objects.get()
    line = HahitantsoaEventDraftLine.objects.get()
    assert draft.created_by == authenticated_client.test_user
    assert line.created_by == authenticated_client.test_user
    assert line.updated_by is None


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
        created_by=user,
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
    first_line = draft.lines.get(inventory_item=first_item)
    replacement_line = draft.lines.get(inventory_item=second_item)
    assert draft.updated_by == user
    assert draft.lines.filter(is_deleted=False).count() == 1
    assert draft.lines.filter(is_deleted=True).count() == 1
    first_line.refresh_from_db()
    replacement_line.refresh_from_db()
    assert first_line.updated_by == user
    assert replacement_line.created_by == user
    assert replacement_line.updated_by == user
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
        created_by=user,
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
    assert line.created_by == user
    assert line.updated_by == user
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
        created_by=user,
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
    assert first_line.created_by == user
    assert first_line.updated_by == user
    assert first_line.quantity == 3
    assert first_line.notes == "Restored first line"
    assert second_line.created_by == user
    assert second_line.updated_by == user
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
        created_by=user,
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
    assert line.created_by == user
    assert line.updated_by == user
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


def test_authenticated_user_can_read_event_draft_confirmation_preflight(
    authenticated_client,
    django_user_model,
) -> None:
    start_at, end_at = _period()
    user = authenticated_client.test_user
    actor = django_user_model.objects.create_user(
        username="hahitantsoa-preflight-marker-user",
        password="test-password",
    )
    item = _item(name="Available shared article", kind="article")
    draft = HahitantsoaEventDraft.objects.create(
        customer=_customer(),
        event_name="Preflight event",
        start_at=start_at,
        end_at=end_at,
        created_by=user,
        contract_signed_at=timezone.now(),
        contract_signed_by=actor,
        required_deposit_received_at=timezone.now(),
        required_deposit_received_by=actor,
    )
    HahitantsoaEventDraftLine.objects.create(
        event_draft=draft,
        inventory_item=item,
        quantity=1,
        created_by=user,
    )
    availability_count = InventoryAvailability.objects.count()
    reservation_count = ReservationDraft.objects.count()

    response = authenticated_client.get(f"{EVENT_DRAFT_LIST_URL}{draft.id}/confirmation-preflight/")

    assert response.status_code == 200
    payload = response.json()
    assert payload == {
        "event_draft_id": str(draft.id),
        "public_reference": draft.public_reference,
        "status": "draft",
        "can_confirm": True,
        "blockers": [],
        "active_line_count": 1,
        "unavailable_line_count": 0,
    }
    assert InventoryAvailability.objects.count() == availability_count
    assert ReservationDraft.objects.count() == reservation_count


def test_event_draft_confirmation_preflight_reports_blockers_without_inventory_write(
    authenticated_client,
) -> None:
    start_at, end_at = _period()
    user = authenticated_client.test_user
    blocked_item = _item(name="Blocked shared material", kind="material")
    draft = HahitantsoaEventDraft.objects.create(
        customer=_customer(is_active=False),
        event_name="Blocked preflight",
        start_at=start_at,
        end_at=end_at,
        created_by=user,
    )
    HahitantsoaEventDraftLine.objects.create(
        event_draft=draft,
        inventory_item=blocked_item,
        quantity=1,
        created_by=user,
    )
    InventoryAvailability.objects.create(
        inventory_item=blocked_item,
        status="blocked",
        start_at=start_at,
        end_at=end_at,
    )
    availability_count = InventoryAvailability.objects.count()
    reservation_count = ReservationDraft.objects.count()

    response = authenticated_client.get(f"{EVENT_DRAFT_LIST_URL}{draft.id}/confirmation-preflight/")

    assert response.status_code == 200
    payload = response.json()
    assert payload["event_draft_id"] == str(draft.id)
    assert payload["public_reference"] == draft.public_reference
    assert payload["status"] == "draft"
    assert payload["can_confirm"] is False
    assert payload["active_line_count"] == 1
    assert payload["unavailable_line_count"] == 1
    assert payload["blockers"] == [
        RESERVATION_CONFIRMATION_BLOCKER_MISSING_REQUIRED_DATA,
        RESERVATION_CONFIRMATION_BLOCKER_ACTIVE_AVAILABILITY_CONFLICT,
        RESERVATION_CONFIRMATION_BLOCKER_MISSING_SIGNED_CONTRACT,
        RESERVATION_CONFIRMATION_BLOCKER_MISSING_REQUIRED_DEPOSIT,
    ]
    assert InventoryAvailability.objects.count() == availability_count
    assert ReservationDraft.objects.count() == reservation_count


def test_event_draft_confirmation_preflight_blocks_empty_active_lines(
    authenticated_client,
) -> None:
    start_at, end_at = _period()
    user = authenticated_client.test_user
    draft = HahitantsoaEventDraft.objects.create(
        customer=_customer(),
        event_name="Empty preflight",
        start_at=start_at,
        end_at=end_at,
        created_by=user,
    )
    line = HahitantsoaEventDraftLine.objects.create(
        event_draft=draft,
        inventory_item=_item(),
        quantity=1,
        created_by=user,
    )
    line.is_deleted = True
    line.deleted_at = timezone.now()
    line.save(update_fields=["is_deleted", "deleted_at"])
    availability_count = InventoryAvailability.objects.count()
    reservation_count = ReservationDraft.objects.count()

    response = authenticated_client.get(f"{EVENT_DRAFT_LIST_URL}{draft.id}/confirmation-preflight/")

    assert response.status_code == 200
    payload = response.json()
    assert payload["can_confirm"] is False
    assert payload["active_line_count"] == 0
    assert payload["unavailable_line_count"] == 0
    assert payload["blockers"] == [RESERVATION_CONFIRMATION_BLOCKER_MISSING_REQUIRED_DATA]
    assert InventoryAvailability.objects.count() == availability_count
    assert ReservationDraft.objects.count() == reservation_count


def test_event_draft_confirmation_preflight_blocks_when_signed_contract_marker_is_missing(
    authenticated_client,
    django_user_model,
) -> None:
    start_at, end_at = _period()
    user = authenticated_client.test_user
    actor = django_user_model.objects.create_user(
        username="hahitantsoa-deposit-ready-user",
        password="test-password",
    )
    draft = HahitantsoaEventDraft.objects.create(
        customer=_customer(),
        event_name="Missing contract marker",
        start_at=start_at,
        end_at=end_at,
        created_by=user,
        required_deposit_received_at=timezone.now(),
        required_deposit_received_by=actor,
    )
    HahitantsoaEventDraftLine.objects.create(
        event_draft=draft,
        inventory_item=_item(kind="article"),
        quantity=1,
        created_by=user,
    )

    response = authenticated_client.get(f"{EVENT_DRAFT_LIST_URL}{draft.id}/confirmation-preflight/")

    assert response.status_code == 200
    payload = response.json()
    assert payload["can_confirm"] is False
    assert payload["blockers"] == [RESERVATION_CONFIRMATION_BLOCKER_MISSING_SIGNED_CONTRACT]


def test_event_draft_confirmation_preflight_blocks_when_required_deposit_marker_is_missing(
    authenticated_client,
    django_user_model,
) -> None:
    start_at, end_at = _period()
    user = authenticated_client.test_user
    actor = django_user_model.objects.create_user(
        username="hahitantsoa-contract-ready-user",
        password="test-password",
    )
    draft = HahitantsoaEventDraft.objects.create(
        customer=_customer(),
        event_name="Missing deposit marker",
        start_at=start_at,
        end_at=end_at,
        created_by=user,
        contract_signed_at=timezone.now(),
        contract_signed_by=actor,
    )
    HahitantsoaEventDraftLine.objects.create(
        event_draft=draft,
        inventory_item=_item(kind="article"),
        quantity=1,
        created_by=user,
    )

    response = authenticated_client.get(f"{EVENT_DRAFT_LIST_URL}{draft.id}/confirmation-preflight/")

    assert response.status_code == 200
    payload = response.json()
    assert payload["can_confirm"] is False
    assert payload["blockers"] == [RESERVATION_CONFIRMATION_BLOCKER_MISSING_REQUIRED_DEPOSIT]


def test_second_user_cannot_access_another_users_confirmation_preflight(
    authenticated_client,
    authenticated_client_two,
) -> None:
    start_at, end_at = _period()
    owner = authenticated_client.test_user
    draft = HahitantsoaEventDraft.objects.create(
        customer=_customer(),
        event_name="Private preflight event",
        start_at=start_at,
        end_at=end_at,
        created_by=owner,
    )
    HahitantsoaEventDraftLine.objects.create(
        event_draft=draft,
        inventory_item=_item(),
        quantity=1,
        created_by=owner,
    )

    response = authenticated_client_two.get(
        f"{EVENT_DRAFT_LIST_URL}{draft.id}/confirmation-preflight/"
    )

    assert response.status_code == 404


def test_confirmed_event_draft_amendment_preflight_allows_confirmed_owner_draft(
    authenticated_client,
) -> None:
    user = authenticated_client.test_user
    user.is_staff = True
    user.save(update_fields=["is_staff"])
    draft = _confirmed_draft(user=user, item=_item(kind="article"))
    availability_count = InventoryAvailability.objects.count()
    reservation_count = ReservationDraft.objects.count()

    response = authenticated_client.get(f"{EVENT_DRAFT_LIST_URL}{draft.id}/amendment-preflight/")

    assert response.status_code == 200
    payload = response.json()
    assert payload["event_draft_id"] == str(draft.id)
    assert payload["status"] == "confirmed"
    assert payload["can_amend"] is True
    assert payload["blockers"] == []
    assert payload["active_line_count"] == 1
    assert InventoryAvailability.objects.count() == availability_count
    assert ReservationDraft.objects.count() == reservation_count


def test_draft_event_draft_amendment_preflight_blocks_unconfirmed_draft(
    authenticated_client,
) -> None:
    start_at, end_at = _period()
    user = authenticated_client.test_user
    draft = HahitantsoaEventDraft.objects.create(
        customer=_customer(),
        event_name="Draft amendment preflight",
        start_at=start_at,
        end_at=end_at,
        created_by=user,
    )
    HahitantsoaEventDraftLine.objects.create(
        event_draft=draft,
        inventory_item=_item(kind="article"),
        quantity=1,
        created_by=user,
    )

    response = authenticated_client.get(f"{EVENT_DRAFT_LIST_URL}{draft.id}/amendment-preflight/")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "draft"
    assert payload["can_amend"] is False
    assert payload["blockers"] == ["draft_not_confirmed_for_amendment"]
    assert payload["active_line_count"] == 1


def test_second_user_cannot_access_another_users_amendment_preflight(
    authenticated_client,
    authenticated_client_two,
) -> None:
    owner = authenticated_client.test_user
    owner.is_staff = True
    owner.save(update_fields=["is_staff"])
    draft = _confirmed_draft(user=owner, item=_item(kind="article"))

    response = authenticated_client_two.get(
        f"{EVENT_DRAFT_LIST_URL}{draft.id}/amendment-preflight/"
    )

    assert response.status_code == 404


def test_event_draft_amendment_preflight_rejects_write_methods(authenticated_client) -> None:
    user = authenticated_client.test_user
    user.is_staff = True
    user.save(update_fields=["is_staff"])
    draft = _confirmed_draft(user=user, item=_item(kind="article"))

    response = authenticated_client.post(f"{EVENT_DRAFT_LIST_URL}{draft.id}/amendment-preflight/")

    assert response.status_code == 405


def test_owner_can_create_list_and_read_amendment_request_for_confirmed_draft(
    authenticated_client,
) -> None:
    user = authenticated_client.test_user
    user.is_staff = True
    user.save(update_fields=["is_staff"])
    draft = _confirmed_draft(user=user, item=_item(kind="article"))
    inventory_availability_count = InventoryAvailability.objects.count()
    reservation_count = ReservationDraft.objects.count()

    create_response = authenticated_client.post(
        _amendment_request_list_url(draft.id),
        data={
            "reason": "Customer changed event timing",
            "notes": "Need to review the confirmed material mix.",
        },
        content_type="application/json",
    )

    assert create_response.status_code == 201
    create_payload = create_response.json()
    amendment_request_payload = create_payload["amendment_request"]
    amendment_request_id = amendment_request_payload["id"]
    assert amendment_request_payload["event_draft_id"] == str(draft.id)
    assert amendment_request_payload["status"] == "draft"
    assert amendment_request_payload["reason"] == "Customer changed event timing"
    assert amendment_request_payload["notes"] == "Need to review the confirmed material mix."

    amendment_request = HahitantsoaEventDraftAmendmentRequest.objects.get(pk=amendment_request_id)
    assert amendment_request.event_draft_id == draft.id
    assert amendment_request.created_by == user
    assert amendment_request.updated_by is None
    draft.refresh_from_db()
    assert draft.status == "confirmed"
    assert draft.updated_by == user
    assert InventoryAvailability.objects.count() == inventory_availability_count
    assert ReservationDraft.objects.count() == reservation_count
    assert amendment_request.created_at is not None

    list_response = authenticated_client.get(_amendment_request_list_url(draft.id))
    assert list_response.status_code == 200
    assert [item["id"] for item in list_response.json()] == [str(amendment_request.id)]

    detail_response = authenticated_client.get(
        _amendment_request_detail_url(draft.id, amendment_request.id)
    )
    assert detail_response.status_code == 200
    assert detail_response.json()["id"] == str(amendment_request.id)


def test_amendment_request_creation_rejects_draft_state_original(authenticated_client) -> None:
    start_at, end_at = _period()
    user = authenticated_client.test_user
    user.is_staff = True
    user.save(update_fields=["is_staff"])
    draft = HahitantsoaEventDraft.objects.create(
        customer=_customer(),
        event_name="Draft amendment request target",
        start_at=start_at,
        end_at=end_at,
        created_by=user,
    )
    HahitantsoaEventDraftLine.objects.create(
        event_draft=draft,
        inventory_item=_item(kind="article"),
        quantity=1,
        created_by=user,
    )
    inventory_availability_count = InventoryAvailability.objects.count()

    response = authenticated_client.post(
        _amendment_request_list_url(draft.id),
        data={"reason": "Should fail"},
        content_type="application/json",
    )

    assert response.status_code == 400
    payload = response.json()
    assert payload["code"] == "draft_not_confirmed_for_amendment"
    assert HahitantsoaEventDraftAmendmentRequest.objects.count() == 0
    assert InventoryAvailability.objects.count() == inventory_availability_count
    draft.refresh_from_db()
    assert draft.status == "draft"


def test_amendment_request_creation_requires_reservation_sensitive_staff(
    authenticated_client,
) -> None:
    user = authenticated_client.test_user
    draft = _confirmed_draft(user=user, item=_item(kind="article"))

    response = authenticated_client.post(
        _amendment_request_list_url(draft.id),
        data={"reason": "Needs staff boundary"},
        content_type="application/json",
    )

    assert response.status_code == 403
    assert (
        response.json()["detail"]
        == "Actor is not allowed to perform a reservation-sensitive write."
    )
    assert HahitantsoaEventDraftAmendmentRequest.objects.count() == 0


def test_amendment_request_creation_returns_404_for_deleted_original(authenticated_client) -> None:
    user = authenticated_client.test_user
    user.is_staff = True
    user.save(update_fields=["is_staff"])
    draft = _confirmed_draft(user=user, item=_item(kind="article"))
    draft.is_deleted = True
    draft.deleted_at = timezone.now()
    draft.save(update_fields=["is_deleted", "deleted_at"])

    response = authenticated_client.post(
        _amendment_request_list_url(draft.id),
        data={"reason": "Should stay hidden"},
        content_type="application/json",
    )

    assert response.status_code == 404
    assert HahitantsoaEventDraftAmendmentRequest.objects.count() == 0


def test_second_user_cannot_access_another_users_amendment_requests(
    authenticated_client,
    authenticated_client_two,
) -> None:
    owner = authenticated_client.test_user
    owner.is_staff = True
    owner.save(update_fields=["is_staff"])
    draft = _confirmed_draft(user=owner, item=_item(kind="article"))
    amendment_request = HahitantsoaEventDraftAmendmentRequest.objects.create(
        event_draft=draft,
        reason="Owner-only change",
        created_by=owner,
    )

    list_response = authenticated_client_two.get(_amendment_request_list_url(draft.id))
    create_response = authenticated_client_two.post(
        _amendment_request_list_url(draft.id),
        data={"reason": "Should not see draft"},
        content_type="application/json",
    )
    detail_response = authenticated_client_two.get(
        _amendment_request_detail_url(draft.id, amendment_request.id)
    )

    assert list_response.status_code == 404
    assert create_response.status_code == 404
    assert detail_response.status_code == 404


def test_authenticated_user_can_confirm_own_event_draft(
    authenticated_client,
    django_user_model,
) -> None:
    start_at, end_at = _period()
    user = authenticated_client.test_user
    user.is_staff = True
    user.save(update_fields=["is_staff"])
    actor = django_user_model.objects.create_user(
        username="hahitantsoa-confirm-api-user",
        password="test-password",
    )
    item = _item(name="Confirmable shared article", kind="article")
    draft = HahitantsoaEventDraft.objects.create(
        customer=_customer(),
        event_name="Confirm via API",
        start_at=start_at,
        end_at=end_at,
        created_by=user,
        contract_signed_at=timezone.now(),
        contract_signed_by=actor,
        required_deposit_received_at=timezone.now(),
        required_deposit_received_by=actor,
    )
    HahitantsoaEventDraftLine.objects.create(
        event_draft=draft,
        inventory_item=item,
        quantity=1,
        created_by=user,
    )
    availability_count = InventoryAvailability.objects.count()
    reservation_count = ReservationDraft.objects.count()

    response = authenticated_client.post(f"{EVENT_DRAFT_LIST_URL}{draft.id}/confirm/")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "confirmed"
    assert payload["public_reference"] == draft.public_reference
    assert payload["blocked_item_count"] == 1
    assert payload["event_draft"]["id"] == str(draft.id)
    assert payload["event_draft"]["status"] == "confirmed"
    draft.refresh_from_db()
    assert draft.status == "confirmed"
    assert draft.confirmed_at is not None
    assert InventoryAvailability.objects.count() == availability_count + 1
    assert InventoryAvailability.objects.get(hahitantsoa_event_draft=draft).status == "reserved"
    assert ReservationDraft.objects.count() == reservation_count


def test_event_draft_confirm_returns_preflight_blockers_without_mutating_state(
    authenticated_client,
    django_user_model,
) -> None:
    start_at, end_at = _period()
    user = authenticated_client.test_user
    user.is_staff = True
    user.save(update_fields=["is_staff"])
    actor = django_user_model.objects.create_user(
        username="hahitantsoa-confirm-blocker-user",
        password="test-password",
    )
    draft = HahitantsoaEventDraft.objects.create(
        customer=_customer(),
        event_name="Blocked confirm API",
        start_at=start_at,
        end_at=end_at,
        created_by=user,
        contract_signed_at=timezone.now(),
        contract_signed_by=actor,
    )
    HahitantsoaEventDraftLine.objects.create(
        event_draft=draft,
        inventory_item=_item(kind="article"),
        quantity=1,
        created_by=user,
    )
    availability_count = InventoryAvailability.objects.count()

    response = authenticated_client.post(f"{EVENT_DRAFT_LIST_URL}{draft.id}/confirm/")

    assert response.status_code == 400
    payload = response.json()
    assert payload["code"] == "confirmation_preflight_failed"
    assert payload["blockers"] == [RESERVATION_CONFIRMATION_BLOCKER_MISSING_REQUIRED_DEPOSIT]
    draft.refresh_from_db()
    assert draft.status == "draft"
    assert draft.confirmed_at is None
    assert InventoryAvailability.objects.count() == availability_count


def test_confirmed_event_draft_patch_is_rejected_without_inventory_mutation(
    authenticated_client,
) -> None:
    user = authenticated_client.test_user
    user.is_staff = True
    user.save(update_fields=["is_staff"])
    item = _item(name="Confirmed shared article", kind="article")
    draft = _confirmed_draft(user=user, item=item)
    availability_count = InventoryAvailability.objects.count()
    reservation_count = ReservationDraft.objects.count()

    response = authenticated_client.patch(
        f"{EVENT_DRAFT_LIST_URL}{draft.id}/",
        data={"event_name": "Should not update"},
        content_type="application/json",
    )

    assert response.status_code == 400
    assert response.json()["code"] == "confirmed_draft_is_immutable"
    draft.refresh_from_db()
    assert draft.event_name == "Confirmed event"
    assert draft.status == "confirmed"
    assert draft.is_deleted is False
    assert InventoryAvailability.objects.count() == availability_count
    assert ReservationDraft.objects.count() == reservation_count


def test_confirmed_event_draft_put_is_rejected_without_inventory_mutation(
    authenticated_client,
) -> None:
    user = authenticated_client.test_user
    user.is_staff = True
    user.save(update_fields=["is_staff"])
    original_item = _item(name="Original confirmed article", kind="article")
    replacement_item = _item(name="Replacement confirmed material", kind="material")
    draft = _confirmed_draft(user=user, item=original_item)
    availability_count = InventoryAvailability.objects.count()

    response = authenticated_client.put(
        f"{EVENT_DRAFT_LIST_URL}{draft.id}/",
        data=_payload(draft.customer, replacement_item),
        content_type="application/json",
    )

    assert response.status_code == 400
    assert response.json()["code"] == "confirmed_draft_is_immutable"
    draft.refresh_from_db()
    assert draft.status == "confirmed"
    assert draft.event_name == "Confirmed event"
    assert InventoryAvailability.objects.count() == availability_count
    assert draft.lines.filter(is_deleted=False).count() == 1
    assert draft.lines.get().inventory_item_id == original_item.id


def test_confirmed_event_draft_delete_is_rejected_without_inventory_mutation(
    authenticated_client,
) -> None:
    user = authenticated_client.test_user
    user.is_staff = True
    user.save(update_fields=["is_staff"])
    draft = _confirmed_draft(user=user, item=_item())
    availability_count = InventoryAvailability.objects.count()
    reservation_count = ReservationDraft.objects.count()

    response = authenticated_client.delete(f"{EVENT_DRAFT_LIST_URL}{draft.id}/")

    assert response.status_code == 400
    assert response.json()["code"] == "confirmed_draft_is_immutable"
    draft.refresh_from_db()
    assert draft.status == "confirmed"
    assert draft.is_deleted is False
    assert draft.deleted_at is None
    assert draft.lines.filter(is_deleted=False).count() == 1
    assert InventoryAvailability.objects.count() == availability_count
    assert ReservationDraft.objects.count() == reservation_count


def test_second_user_gets_404_for_confirmed_event_draft_mutations(
    authenticated_client,
    authenticated_client_two,
) -> None:
    owner = authenticated_client.test_user
    owner.is_staff = True
    owner.save(update_fields=["is_staff"])
    draft = _confirmed_draft(user=owner, item=_item())

    detail_response = authenticated_client_two.get(f"{EVENT_DRAFT_LIST_URL}{draft.id}/")
    update_response = authenticated_client_two.patch(
        f"{EVENT_DRAFT_LIST_URL}{draft.id}/",
        data={"event_name": "Hidden"},
        content_type="application/json",
    )
    delete_response = authenticated_client_two.delete(f"{EVENT_DRAFT_LIST_URL}{draft.id}/")

    assert detail_response.status_code == 404
    assert update_response.status_code == 404
    assert delete_response.status_code == 404


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
    preflight_response = authenticated_client_two.get(
        f"{EVENT_DRAFT_LIST_URL}{draft.id}/confirmation-preflight/"
    )
    amendment_preflight_response = authenticated_client_two.get(
        f"{EVENT_DRAFT_LIST_URL}{draft.id}/amendment-preflight/"
    )
    confirm_response = authenticated_client_two.post(f"{EVENT_DRAFT_LIST_URL}{draft.id}/confirm/")

    assert list_response.status_code == 200
    assert list_response.json() == []
    assert detail_response.status_code == 404
    assert update_response.status_code == 404
    assert delete_response.status_code == 404
    assert preview_response.status_code == 404
    assert preflight_response.status_code == 404
    assert amendment_preflight_response.status_code == 404
    assert confirm_response.status_code == 404
    draft.refresh_from_db()
    line = draft.lines.get()
    assert draft.created_by == owner
    assert draft.updated_by != other_user
    assert draft.is_deleted is False
    assert line.created_by != other_user
    assert line.updated_by != other_user


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
