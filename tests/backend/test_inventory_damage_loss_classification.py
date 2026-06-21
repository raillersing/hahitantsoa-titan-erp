from datetime import timedelta

import pytest
from django.utils import timezone

from apps.customers.models import Customer
from apps.inventory.models import InventoryItem
from apps.inventory.selectors import get_return_operation_classification_breakdown
from apps.inventory.services import (
    create_inventory_return_operation,
    propose_damage_loss_classification_lines,
    validate_inventory_return_operation,
)
from apps.reservations.models import ReservationDraft

pytestmark = pytest.mark.django_db


def _inventory_item(name: str) -> InventoryItem:
    return InventoryItem.objects.create(
        name=name,
        kind="material",
        description=f"{name} description",
    )


def _reservation_draft() -> ReservationDraft:
    customer = Customer.objects.create(
        display_name="Classify customer",
        email="classify@example.test",
        phone="+26134000999",
        address="Antananarivo",
    )
    start_at = timezone.now().replace(microsecond=0) + timedelta(days=2)
    end_at = start_at + timedelta(hours=4)
    return ReservationDraft.objects.create(
        customer=customer,
        start_at=start_at,
        end_at=end_at,
        notes="Classify draft",
    )


def _return_operation(actor, draft, lines):
    return create_inventory_return_operation(
        actor=actor,
        reservation_draft=draft,
        lines=lines,
    )


def test_propose_classification_intact_line(django_user_model) -> None:
    actor = django_user_model.objects.create_user(username="classify-intact", password="test-pass")
    item = _inventory_item("Intact chair")
    draft = _reservation_draft()
    ro = _return_operation(
        actor,
        draft,
        [
            {
                "inventory_item": item,
                "expected_quantity": 3,
                "returned_quantity": 3,
                "damaged_quantity": 0,
                "missing_quantity": 0,
                "condition_status": "intact",
                "notes": "Good condition",
            },
        ],
    )

    result = propose_damage_loss_classification_lines(return_operation=ro)

    assert result.return_operation_id == str(ro.id)
    assert len(result.proposals) == 0
    assert len(result.intact_summary) == 1
    assert result.intact_summary[0]["intact_quantity"] == 3


def test_propose_classification_damaged_line(django_user_model) -> None:
    actor = django_user_model.objects.create_user(username="classify-damaged", password="test-pass")
    item = _inventory_item("Damaged table")
    draft = _reservation_draft()
    ro = _return_operation(
        actor,
        draft,
        [
            {
                "inventory_item": item,
                "expected_quantity": 2,
                "returned_quantity": 2,
                "damaged_quantity": 2,
                "missing_quantity": 0,
                "condition_status": "damaged",
                "notes": "Broken leg",
            },
        ],
    )

    result = propose_damage_loss_classification_lines(return_operation=ro)

    assert len(result.proposals) == 1
    assert result.proposals[0].settlement_line_kind == "damage"
    assert result.proposals[0].quantity == 2
    assert result.proposals[0].inventory_item_name == "Damaged table"
    assert len(result.intact_summary) == 0


def test_propose_classification_missing_line(django_user_model) -> None:
    actor = django_user_model.objects.create_user(username="classify-missing", password="test-pass")
    item = _inventory_item("Missing lamp")
    draft = _reservation_draft()
    ro = _return_operation(
        actor,
        draft,
        [
            {
                "inventory_item": item,
                "expected_quantity": 1,
                "returned_quantity": 0,
                "damaged_quantity": 0,
                "missing_quantity": 1,
                "condition_status": "missing",
                "notes": "Not returned",
            },
        ],
    )

    result = propose_damage_loss_classification_lines(return_operation=ro)

    assert len(result.proposals) == 1
    assert result.proposals[0].settlement_line_kind == "loss"
    assert result.proposals[0].quantity == 1
    assert len(result.intact_summary) == 0


def test_propose_classification_mixed_line(django_user_model) -> None:
    actor = django_user_model.objects.create_user(username="classify-mixed", password="test-pass")
    item = _inventory_item("Mixed tent")
    draft = _reservation_draft()
    ro = _return_operation(
        actor,
        draft,
        [
            {
                "inventory_item": item,
                "expected_quantity": 5,
                "returned_quantity": 4,
                "damaged_quantity": 2,
                "missing_quantity": 1,
                "condition_status": "mixed",
                "notes": "Some damaged, some missing",
            },
        ],
    )

    result = propose_damage_loss_classification_lines(return_operation=ro)

    assert len(result.proposals) == 2
    damage_proposals = [p for p in result.proposals if p.settlement_line_kind == "damage"]
    loss_proposals = [p for p in result.proposals if p.settlement_line_kind == "loss"]
    assert len(damage_proposals) == 1
    assert damage_proposals[0].quantity == 2
    assert len(loss_proposals) == 1
    assert loss_proposals[0].quantity == 1
    assert len(result.intact_summary) == 1
    assert result.intact_summary[0]["intact_quantity"] == 2


def test_propose_classification_multiple_lines(django_user_model) -> None:
    actor = django_user_model.objects.create_user(username="classify-multi", password="test-pass")
    item_a = _inventory_item("Item A")
    item_b = _inventory_item("Item B")
    item_c = _inventory_item("Item C")
    draft = _reservation_draft()
    ro = create_inventory_return_operation(
        actor=actor,
        reservation_draft=draft,
        lines=[
            {
                "inventory_item": item_a,
                "expected_quantity": 2,
                "returned_quantity": 2,
                "damaged_quantity": 0,
                "missing_quantity": 0,
                "condition_status": "intact",
                "notes": "",
            },
            {
                "inventory_item": item_b,
                "expected_quantity": 1,
                "returned_quantity": 1,
                "damaged_quantity": 1,
                "missing_quantity": 0,
                "condition_status": "damaged",
                "notes": "Broken",
            },
            {
                "inventory_item": item_c,
                "expected_quantity": 3,
                "returned_quantity": 0,
                "damaged_quantity": 0,
                "missing_quantity": 3,
                "condition_status": "missing",
                "notes": "Lost",
            },
        ],
    )

    result = propose_damage_loss_classification_lines(return_operation=ro)

    assert len(result.intact_summary) == 1
    assert len(result.proposals) == 2
    proposal_kinds = {p.settlement_line_kind for p in result.proposals}
    assert proposal_kinds == {"damage", "loss"}


def test_classification_breakdown_intact(django_user_model) -> None:
    actor = django_user_model.objects.create_user(username="bd-intact", password="test-pass")
    item = _inventory_item("Breakdown intact")
    draft = _reservation_draft()
    ro = _return_operation(
        actor,
        draft,
        [
            {
                "inventory_item": item,
                "expected_quantity": 2,
                "returned_quantity": 2,
                "damaged_quantity": 0,
                "missing_quantity": 0,
                "condition_status": "intact",
                "notes": "",
            },
        ],
    )

    breakdown = get_return_operation_classification_breakdown(return_operation=ro)

    assert len(breakdown) == 1
    assert breakdown[0]["condition_status"] == "intact"
    assert breakdown[0]["classification_suggestions"] == []


def test_classification_breakdown_damaged(django_user_model) -> None:
    actor = django_user_model.objects.create_user(username="bd-damaged", password="test-pass")
    item = _inventory_item("Breakdown damaged")
    draft = _reservation_draft()
    ro = _return_operation(
        actor,
        draft,
        [
            {
                "inventory_item": item,
                "expected_quantity": 1,
                "returned_quantity": 1,
                "damaged_quantity": 1,
                "missing_quantity": 0,
                "condition_status": "damaged",
                "notes": "",
            },
        ],
    )

    breakdown = get_return_operation_classification_breakdown(return_operation=ro)

    assert len(breakdown) == 1
    assert breakdown[0]["classification_suggestions"] == [
        {"kind": "damage", "quantity": 1},
    ]


def test_classification_breakdown_missing(django_user_model) -> None:
    actor = django_user_model.objects.create_user(username="bd-missing", password="test-pass")
    item = _inventory_item("Breakdown missing")
    draft = _reservation_draft()
    ro = _return_operation(
        actor,
        draft,
        [
            {
                "inventory_item": item,
                "expected_quantity": 1,
                "returned_quantity": 0,
                "damaged_quantity": 0,
                "missing_quantity": 1,
                "condition_status": "missing",
                "notes": "",
            },
        ],
    )

    breakdown = get_return_operation_classification_breakdown(return_operation=ro)

    assert len(breakdown) == 1
    assert breakdown[0]["classification_suggestions"] == [
        {"kind": "loss", "quantity": 1},
    ]


def test_classification_breakdown_mixed(django_user_model) -> None:
    actor = django_user_model.objects.create_user(username="bd-mixed", password="test-pass")
    item = _inventory_item("Breakdown mixed")
    draft = _reservation_draft()
    ro = _return_operation(
        actor,
        draft,
        [
            {
                "inventory_item": item,
                "expected_quantity": 4,
                "returned_quantity": 3,
                "damaged_quantity": 2,
                "missing_quantity": 1,
                "condition_status": "mixed",
                "notes": "",
            },
        ],
    )

    breakdown = get_return_operation_classification_breakdown(return_operation=ro)

    assert len(breakdown) == 1
    suggestions = breakdown[0]["classification_suggestions"]
    assert len(suggestions) == 3
    suggestion_kinds = {s["kind"] for s in suggestions}
    assert suggestion_kinds == {"intact", "damage", "loss"}


def test_classification_proposal_validated_return(django_user_model) -> None:
    actor = django_user_model.objects.create_user(
        username="classify-validated", password="test-pass"
    )
    item = _inventory_item("Validated return item")
    draft = _reservation_draft()
    ro = _return_operation(
        actor,
        draft,
        [
            {
                "inventory_item": item,
                "expected_quantity": 2,
                "returned_quantity": 1,
                "damaged_quantity": 1,
                "missing_quantity": 1,
                "condition_status": "mixed",
                "notes": "",
            },
        ],
    )
    validate_inventory_return_operation(return_operation=ro, actor=actor)
    ro.refresh_from_db()

    result = propose_damage_loss_classification_lines(return_operation=ro)

    assert len(result.proposals) == 2
    assert result.return_operation_id == str(ro.id)
