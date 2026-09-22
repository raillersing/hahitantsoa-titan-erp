from datetime import timedelta
from decimal import Decimal

import pytest
from django.test import Client
from django.utils import timezone

from apps.customers.models import Customer
from apps.documents.runtime import generate_document_instance_html
from apps.documents.services import create_document_instance_from_hahitantsoa_event_draft
from apps.hahitantsoa.commercial_terms import recalculate_hahitantsoa_event_draft_totals
from apps.hahitantsoa.models import (
    HahitantsoaEventDraft,
    HahitantsoaEventDraftLine,
)
from apps.inventory.models import InventoryAvailability, InventoryItem
from apps.payments.services import confirm_payment, create_payment

pytestmark = pytest.mark.django_db

EVENT_DRAFT_LIST_URL = "/api/v1/hahitantsoa/event-drafts/"


def _amendment_request_list_url(event_draft_id) -> str:
    return f"{EVENT_DRAFT_LIST_URL}{event_draft_id}/amendment-requests/"


def _amendment_request_apply_url(event_draft_id, amendment_request_id) -> str:
    return (
        f"{EVENT_DRAFT_LIST_URL}{event_draft_id}/amendment-requests/{amendment_request_id}/apply/"
    )


def _amendment_request_line_list_url(event_draft_id, amendment_request_id) -> str:
    return (
        f"{EVENT_DRAFT_LIST_URL}{event_draft_id}/amendment-requests/{amendment_request_id}/lines/"
    )


def _period():
    start_at = timezone.now() + timedelta(days=20)
    end_at = start_at + timedelta(hours=8)
    return start_at, end_at


def _customer(name: str = "Client Avenant") -> Customer:
    return Customer.objects.create(
        display_name=name,
        email=f"client-{timezone.now().timestamp()}@example.com",
    )


def _item(
    *,
    name: str = "Table Ronde",
    kind: str = "article",
    price: Decimal = Decimal("15000.00"),
) -> InventoryItem:
    return InventoryItem.objects.create(
        name=name,
        kind=kind,
        rental_price=price,
        is_active=True,
    )


def _confirmed_draft_with_items(
    *,
    user,
    items_and_quantities,
    rental_type="logistics",
    space_rental_amount=Decimal("2000000.00"),
    service_notes="",
) -> HahitantsoaEventDraft:
    start_at, end_at = _period()
    draft = HahitantsoaEventDraft.objects.create(
        customer=_customer(),
        event_name="Mariage Princier",
        rental_type=rental_type,
        duration_option="day",
        space_rental_amount=space_rental_amount,
        service_notes=service_notes,
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
    for item, qty, unit_price in items_and_quantities:
        HahitantsoaEventDraftLine.objects.create(
            event_draft=draft,
            inventory_item=item,
            quantity=qty,
            unit_rental_price=unit_price,
            created_by=user,
            updated_by=user,
        )
        InventoryAvailability.objects.create(
            inventory_item=item,
            hahitantsoa_event_draft=draft,
            status="reserved",
            start_at=start_at,
            end_at=end_at,
            created_by=user,
            updated_by=user,
        )
    contract_doc = create_document_instance_from_hahitantsoa_event_draft(
        event_draft=draft,
        template_key="hahitantsoa.contract.v1",
        actor=user,
    )
    generate_document_instance_html(document_instance=contract_doc, actor=user)
    payment = create_payment(
        actor=user,
        hahitantsoa_event_draft=draft,
        payment_kind="deposit",
        payment_method="cash",
        payment_status="pending",
        amount="500000.00",
    )
    confirm_payment(payment=payment, actor=user)
    draft.refresh_from_db()
    return draft


@pytest.fixture
def staff_client(django_user_model):
    client = Client()
    user = django_user_model.objects.create_user(
        username="hahitantsoa-staff-tester",
        password="test-password",
        is_staff=True,
    )
    client.force_login(user)
    client.test_user = user
    return client


def test_f09_amendment_prioritizes_explicit_space_rental_amount(staff_client):
    """
    F09: Explicit changed_space_rental_amount must be preserved even if duration_option changes.
    """
    user = staff_client.test_user
    item = _item(name="Chaise Napoléon", price=Decimal("10000.00"))
    draft = _confirmed_draft_with_items(
        user=user,
        items_and_quantities=[(item, 10, Decimal("10000.00"))],
        space_rental_amount=Decimal("2000000.00"),
    )

    # 1. Create amendment specifying both changed_duration_option and changed_space_rental_amount
    res = staff_client.post(
        _amendment_request_list_url(draft.id),
        data={
            "reason": "Tarif négocié pour formule soirée",
            "changed_duration_option": "night_1",
            "changed_space_rental_amount": "1450000.00",
        },
        content_type="application/json",
    )
    assert res.status_code == 201
    amendment_id = res.json()["amendment_request"]["id"]

    # 2. Apply amendment
    apply_res = staff_client.post(_amendment_request_apply_url(draft.id, amendment_id))
    assert apply_res.status_code == 200

    draft.refresh_from_db()
    assert draft.duration_option == "night_1"
    # Must preserve the explicitly negotiated 1 450 000 Ar rather than recalculating from terms
    assert draft.space_rental_amount == Decimal("1450000.00")


def test_f10_switching_to_bare_rental_clears_lines_and_frees_stock(staff_client):
    """
    F10: Switching to bare rental in amendment must soft-delete material lines and free stock.
    """
    user = staff_client.test_user
    item1 = _item(name="Tente 50m2", price=Decimal("500000.00"))
    item2 = _item(name="Guirlande Lumineuse", price=Decimal("80000.00"))
    draft = _confirmed_draft_with_items(
        user=user,
        items_and_quantities=[
            (item1, 1, Decimal("500000.00")),
            (item2, 4, Decimal("80000.00")),
        ],
        rental_type="logistics",
        space_rental_amount=Decimal("3000000.00"),
    )

    assert draft.lines.filter(is_deleted=False).count() == 2
    assert (
        InventoryAvailability.objects.filter(
            hahitantsoa_event_draft=draft, is_deleted=False
        ).count()
        == 2
    )

    # 1. Create amendment to switch to bare rental
    res = staff_client.post(
        _amendment_request_list_url(draft.id),
        data={
            "reason": "Passage en location de salle nue",
            "changed_rental_type": "bare",
        },
        content_type="application/json",
    )
    assert res.status_code == 201
    amendment_id = res.json()["amendment_request"]["id"]

    # 2. Attempting to add amendment lines to a bare rental amendment must be rejected
    line_res = staff_client.post(
        _amendment_request_line_list_url(draft.id, amendment_id),
        data={"inventory_item_id": str(item1.id), "quantity": 1},
        content_type="application/json",
    )
    assert line_res.status_code == 400
    assert "Location nue" in str(line_res.json())

    # 3. Apply amendment
    apply_res = staff_client.post(_amendment_request_apply_url(draft.id, amendment_id))
    assert apply_res.status_code == 200

    draft.refresh_from_db()
    assert draft.rental_type == "bare"
    # Material lines must be soft-deleted
    assert draft.lines.filter(is_deleted=False).count() == 0
    # Stock availability blocks must be completely released
    assert (
        InventoryAvailability.objects.filter(
            hahitantsoa_event_draft=draft, is_deleted=False
        ).count()
        == 0
    )
    # Logistics amount must be 0
    assert draft.logistics_amount == Decimal("0.00")
    assert draft.total_amount == draft.space_rental_amount


def test_f11_empty_service_notes_clears_services_and_recalculates_total(staff_client):
    """
    F11: Setting changed_service_notes to '' must clear service_notes and recalculate total.
    """
    user = staff_client.test_user
    item = _item(name="Table Basse", price=Decimal("20000.00"))
    initial_services = "DJ & Animation - 350000 Ar\nÉclairage Architectural - 250000 Ar"
    draft = _confirmed_draft_with_items(
        user=user,
        items_and_quantities=[(item, 2, Decimal("20000.00"))],
        space_rental_amount=Decimal("2000000.00"),
        service_notes=initial_services,
    )
    recalculate_hahitantsoa_event_draft_totals(event_draft=draft)
    draft.refresh_from_db()
    # 2000000 space + 40000 logistics + 600000 services = 2640000
    assert draft.total_amount == Decimal("2640000.00")

    # 1. Create amendment clearing service_notes
    res = staff_client.post(
        _amendment_request_list_url(draft.id),
        data={
            "reason": "Suppression des prestations scénographiques",
            "changed_service_notes": "",
        },
        content_type="application/json",
    )
    assert res.status_code == 201
    amendment_id = res.json()["amendment_request"]["id"]

    # 2. Apply amendment
    apply_res = staff_client.post(_amendment_request_apply_url(draft.id, amendment_id))
    assert apply_res.status_code == 200

    draft.refresh_from_db()
    assert draft.service_notes == ""
    # Total should now be 2000000 space + 40000 logistics = 2040000
    assert draft.total_amount == Decimal("2040000.00")


def test_f11_omitted_service_notes_preserves_existing_services(staff_client):
    """
    F11: When changed_service_notes is not provided (None), existing services must not be wiped.
    """
    user = staff_client.test_user
    item = _item(name="Table Basse", price=Decimal("20000.00"))
    initial_services = "Sonorisation VIP - 400000 Ar"
    draft = _confirmed_draft_with_items(
        user=user,
        items_and_quantities=[(item, 1, Decimal("20000.00"))],
        space_rental_amount=Decimal("1500000.00"),
        service_notes=initial_services,
    )

    res = staff_client.post(
        _amendment_request_list_url(draft.id),
        data={"reason": "Mise à jour nom de l'événement", "changed_event_name": "Nouveau Nom"},
        content_type="application/json",
    )
    assert res.status_code == 201
    amendment_id = res.json()["amendment_request"]["id"]

    apply_res = staff_client.post(_amendment_request_apply_url(draft.id, amendment_id))
    assert apply_res.status_code == 200

    draft.refresh_from_db()
    assert draft.event_name == "Nouveau Nom"
    assert draft.service_notes == initial_services


def test_f12_amendment_preserves_historical_contractual_unit_prices(staff_client):
    """
    F12: Applying an amendment must preserve historical contractual unit prices even on changes.
    """
    user = staff_client.test_user
    item = _item(name="Chaise Chiavari", price=Decimal("8000.00"))
    draft = _confirmed_draft_with_items(
        user=user,
        items_and_quantities=[(item, 50, Decimal("8000.00"))],
        space_rental_amount=Decimal("2000000.00"),
    )

    original_line = draft.lines.get(inventory_item=item)
    assert original_line.unit_rental_price == Decimal("8000.00")

    # Catalog price increases from 8 000 Ar to 18 000 Ar
    item.rental_price = Decimal("18000.00")
    item.save(update_fields=["rental_price"])

    # Client amends to increase quantity from 50 to 60
    res = staff_client.post(
        _amendment_request_list_url(draft.id),
        data={"reason": "Ajout de 10 chaises supplémentaires"},
        content_type="application/json",
    )
    assert res.status_code == 201
    amendment_id = res.json()["amendment_request"]["id"]

    line_res = staff_client.post(
        _amendment_request_line_list_url(draft.id, amendment_id),
        data={"inventory_item_id": str(item.id), "quantity": 60},
        content_type="application/json",
    )
    assert line_res.status_code == 201

    apply_res = staff_client.post(_amendment_request_apply_url(draft.id, amendment_id))
    assert apply_res.status_code == 200

    draft.refresh_from_db()
    updated_line = draft.lines.get(inventory_item=item)
    assert updated_line.quantity == 60
    # Must preserve the historical contractual unit price (8 000 Ar) rather than catalog price
    assert updated_line.unit_rental_price == Decimal("8000.00")
    # Logistics amount is 60 * 8 000 = 480 000 Ar
    assert draft.logistics_amount == Decimal("480000.00")
