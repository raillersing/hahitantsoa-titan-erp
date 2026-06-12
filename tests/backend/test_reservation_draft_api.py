from datetime import timedelta

import pytest
from django.utils import timezone

from apps.customers.models import Customer
from apps.inventory.models import InventoryAvailability, InventoryItem
from apps.reservations.models import ReservationDraft, ReservationDraftLine

pytestmark = pytest.mark.django_db

DRAFT_LIST_URL = "/api/v1/reservations/drafts/"


@pytest.fixture
def authenticated_client(client, django_user_model):
    user = django_user_model.objects.create_user(
        username="reservation-draft-reader",
        password="test-password",
    )
    client.force_login(user)
    return client


def _period():
    start_at = timezone.now().replace(microsecond=0)
    return start_at, start_at + timedelta(hours=2)


def _customer(name: str = "Client Demo") -> Customer:
    return Customer.objects.create(display_name=name)


def _item(name: str = "Projecteur LED", kind: str = "article") -> InventoryItem:
    return InventoryItem.objects.create(name=name, kind=kind)


def _payload(customer: Customer, item: InventoryItem) -> dict:
    start_at, end_at = _period()
    return {
        "customer_id": str(customer.id),
        "start_at": start_at.isoformat(),
        "end_at": end_at.isoformat(),
        "notes": "Draft API test.",
        "lines": [
            {
                "inventory_item_id": str(item.id),
                "quantity": 1,
                "notes": "Line notes.",
            }
        ],
    }


def test_reservation_draft_list_rejects_unauthenticated_user(client) -> None:
    response = client.get(DRAFT_LIST_URL)

    assert response.status_code in {401, 403}


def test_authenticated_user_can_create_draft(authenticated_client) -> None:
    customer = _customer()
    item = _item()

    response = authenticated_client.post(
        DRAFT_LIST_URL,
        data=_payload(customer, item),
        content_type="application/json",
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["status"] == "draft"
    assert payload["customer_id"] == str(customer.id)
    assert payload["customer_display_name"] == customer.display_name
    assert payload["public_reference"].startswith("RD-")
    assert len(payload["lines"]) == 1
    assert payload["lines"][0]["inventory_item_id"] == str(item.id)
    assert payload["lines"][0]["inventory_item_name"] == item.name
    assert ReservationDraft.objects.count() == 1
    assert ReservationDraftLine.objects.count() == 1


def test_authenticated_user_can_read_draft_list_and_detail(authenticated_client) -> None:
    start_at, end_at = _period()
    customer = _customer()
    item = _item()
    draft = ReservationDraft.objects.create(
        customer=customer,
        start_at=start_at,
        end_at=end_at,
    )
    ReservationDraftLine.objects.create(
        reservation_draft=draft,
        inventory_item=item,
        quantity=1,
    )

    list_response = authenticated_client.get(DRAFT_LIST_URL)
    detail_response = authenticated_client.get(f"{DRAFT_LIST_URL}{draft.id}/")

    assert list_response.status_code == 200
    assert detail_response.status_code == 200
    assert list_response.json()[0]["id"] == str(draft.id)
    assert detail_response.json()["id"] == str(draft.id)


def test_draft_list_and_detail_exclude_soft_deleted_drafts(authenticated_client) -> None:
    start_at, end_at = _period()
    visible_draft = ReservationDraft.objects.create(
        customer=_customer("Visible"),
        start_at=start_at,
        end_at=end_at,
    )
    hidden_draft = ReservationDraft.objects.create(
        customer=_customer("Hidden"),
        start_at=start_at,
        end_at=end_at,
        is_deleted=True,
        deleted_at=timezone.now(),
    )
    ReservationDraftLine.objects.create(
        reservation_draft=visible_draft,
        inventory_item=_item("Visible item"),
        quantity=1,
    )
    ReservationDraftLine.objects.create(
        reservation_draft=hidden_draft,
        inventory_item=_item("Hidden item"),
        quantity=1,
    )

    list_response = authenticated_client.get(DRAFT_LIST_URL)
    detail_response = authenticated_client.get(f"{DRAFT_LIST_URL}{hidden_draft.id}/")

    assert list_response.status_code == 200
    assert [entry["id"] for entry in list_response.json()] == [str(visible_draft.id)]
    assert detail_response.status_code == 404


def test_create_draft_rejects_invalid_period(authenticated_client) -> None:
    customer = _customer()
    item = _item()
    start_at = timezone.now().replace(microsecond=0)
    payload = _payload(customer, item)
    payload["start_at"] = start_at.isoformat()
    payload["end_at"] = start_at.isoformat()

    response = authenticated_client.post(
        DRAFT_LIST_URL,
        data=payload,
        content_type="application/json",
    )

    assert response.status_code == 400
    assert ReservationDraft.objects.count() == 0


def test_create_draft_rejects_empty_lines(authenticated_client) -> None:
    customer = _customer()
    item = _item()
    payload = _payload(customer, item)
    payload["lines"] = []

    response = authenticated_client.post(
        DRAFT_LIST_URL,
        data=payload,
        content_type="application/json",
    )

    assert response.status_code == 400
    assert ReservationDraft.objects.count() == 0


def test_create_draft_rejects_duplicate_items(authenticated_client) -> None:
    customer = _customer()
    item = _item()
    payload = _payload(customer, item)
    payload["lines"].append(payload["lines"][0].copy())

    response = authenticated_client.post(
        DRAFT_LIST_URL,
        data=payload,
        content_type="application/json",
    )

    assert response.status_code == 400
    assert ReservationDraft.objects.count() == 0


@pytest.mark.parametrize("method", ["delete"])
def test_reservation_draft_detail_rejects_delete_method(
    authenticated_client,
    method: str,
) -> None:
    start_at, end_at = _period()
    draft = ReservationDraft.objects.create(
        customer=_customer(),
        start_at=start_at,
        end_at=end_at,
    )
    request_method = getattr(authenticated_client, method)

    response = request_method(
        f"{DRAFT_LIST_URL}{draft.id}/",
        data={"notes": "Updated"},
        content_type="application/json",
    )

    assert response.status_code == 405


def test_draft_creation_does_not_create_inventory_availability(authenticated_client) -> None:
    customer = _customer()
    item = _item()

    response = authenticated_client.post(
        DRAFT_LIST_URL,
        data=_payload(customer, item),
        content_type="application/json",
    )

    assert response.status_code == 201
    assert InventoryAvailability.objects.count() == 0


def test_authenticated_user_can_update_reservation_draft_notes_only(client, django_user_model):
    user = django_user_model.objects.create_user(
        username="f107-draft-update-notes",
        password="password",
    )
    client.force_login(user)

    customer = Customer.objects.create(display_name="F107 Customer")
    item = InventoryItem.objects.create(name="F107 Projector", kind="material")
    start_at = timezone.now() + timedelta(days=1)
    end_at = start_at + timedelta(hours=2)

    draft = ReservationDraft.objects.create(
        customer=customer,
        start_at=start_at,
        end_at=end_at,
        notes="Initial notes.",
    )
    ReservationDraftLine.objects.create(
        reservation_draft=draft,
        inventory_item=item,
        quantity=1,
        notes="Initial line notes.",
    )

    response = client.patch(
        f"/api/v1/reservations/drafts/{draft.id}/",
        data={"notes": "Updated notes only."},
        content_type="application/json",
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["id"] == str(draft.id)
    assert payload["status"] == "draft"
    assert payload["notes"] == "Updated notes only."
    assert len(payload["lines"]) == 1

    draft.refresh_from_db()
    assert draft.status == "draft"
    assert draft.notes == "Updated notes only."
    assert draft.lines.count() == 1


def test_draft_api_does_not_expose_lifecycle_write_fields(authenticated_client) -> None:
    start_at, end_at = _period()
    draft = ReservationDraft.objects.create(
        customer=_customer(),
        start_at=start_at,
        end_at=end_at,
    )
    ReservationDraftLine.objects.create(
        reservation_draft=draft,
        inventory_item=_item(),
        quantity=1,
    )

    response = authenticated_client.get(f"{DRAFT_LIST_URL}{draft.id}/")

    assert response.status_code == 200
    payload = response.json()
    hidden_fields = {
        "contract_signed_at",
        "contract_signed_by",
        "required_deposit_received_at",
        "required_deposit_received_by",
        "confirmed_at",
        "confirmed_by",
        "cancelled_at",
        "cancelled_by",
    }
    assert hidden_fields.isdisjoint(payload)


def test_authenticated_user_can_replace_reservation_draft_lines(client, django_user_model):
    user = django_user_model.objects.create_user(
        username="f107-draft-update-lines",
        password="password",
    )
    client.force_login(user)

    customer = Customer.objects.create(display_name="F107 Customer")
    first_item = InventoryItem.objects.create(name="F107 Projector", kind="material")
    second_item = InventoryItem.objects.create(name="F107 Lighting pack", kind="material_pack")
    start_at = timezone.now() + timedelta(days=1)
    end_at = start_at + timedelta(hours=2)

    draft = ReservationDraft.objects.create(
        customer=customer,
        start_at=start_at,
        end_at=end_at,
        notes="Initial notes.",
    )
    ReservationDraftLine.objects.create(
        reservation_draft=draft,
        inventory_item=first_item,
        quantity=1,
        notes="Initial line notes.",
    )

    response = client.patch(
        f"/api/v1/reservations/drafts/{draft.id}/",
        data={
            "notes": "Updated with replacement line.",
            "lines": [
                {
                    "inventory_item_id": str(second_item.id),
                    "quantity": 2,
                    "notes": "Replacement line.",
                }
            ],
        },
        content_type="application/json",
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "draft"
    assert payload["notes"] == "Updated with replacement line."
    assert len(payload["lines"]) == 1
    assert payload["lines"][0]["inventory_item_id"] == str(second_item.id)
    assert payload["lines"][0]["quantity"] == 2
    assert payload["lines"][0]["notes"] == "Replacement line."

    draft.refresh_from_db()
    assert draft.status == "draft"
    assert draft.lines.count() == 1
    assert draft.lines.get().inventory_item_id == second_item.id
    assert draft.lines.get().quantity == 2


def test_reservation_draft_update_rejects_empty_lines(client, django_user_model):
    user = django_user_model.objects.create_user(
        username="f107-draft-update-empty-lines",
        password="password",
    )
    client.force_login(user)

    customer = Customer.objects.create(display_name="F107 Customer")
    item = InventoryItem.objects.create(name="F107 Projector", kind="material")
    start_at = timezone.now() + timedelta(days=1)
    end_at = start_at + timedelta(hours=2)

    draft = ReservationDraft.objects.create(
        customer=customer,
        start_at=start_at,
        end_at=end_at,
        notes="Initial notes.",
    )
    ReservationDraftLine.objects.create(
        reservation_draft=draft,
        inventory_item=item,
        quantity=1,
        notes="Initial line notes.",
    )

    response = client.patch(
        f"/api/v1/reservations/drafts/{draft.id}/",
        data={"lines": []},
        content_type="application/json",
    )

    assert response.status_code == 400
    assert ReservationDraftLine.objects.filter(reservation_draft=draft).count() == 1


def test_reservation_draft_update_does_not_create_commercial_side_effects(
    client,
    django_user_model,
):
    user = django_user_model.objects.create_user(
        username="f107-draft-update-no-side-effects",
        password="password",
    )
    client.force_login(user)

    customer = Customer.objects.create(display_name="F107 Customer")
    item = InventoryItem.objects.create(name="F107 Projector", kind="material")
    start_at = timezone.now() + timedelta(days=1)
    end_at = start_at + timedelta(hours=2)

    draft = ReservationDraft.objects.create(
        customer=customer,
        start_at=start_at,
        end_at=end_at,
        notes="Initial notes.",
    )
    ReservationDraftLine.objects.create(
        reservation_draft=draft,
        inventory_item=item,
        quantity=1,
        notes="Initial line notes.",
    )

    response = client.patch(
        f"/api/v1/reservations/drafts/{draft.id}/",
        data={"notes": "Still only a draft."},
        content_type="application/json",
    )

    assert response.status_code == 200

    draft.refresh_from_db()
    assert draft.status == "draft"
    assert InventoryAvailability.objects.count() == 0
