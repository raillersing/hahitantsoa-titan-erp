from datetime import timedelta

import pytest
from django.utils import timezone

from apps.customers.models import Customer
from apps.inventory.models import InventoryItem
from apps.inventory.selectors import get_event_operations_summary
from apps.inventory.services import (
    check_event_operations_completeness,
    create_inventory_return_operation,
    validate_inventory_return_operation,
)
from apps.logistics.models import LogisticsEvent, LogisticsEventType
from apps.reservations.models import ReservationDraft

pytestmark = pytest.mark.django_db


def _inventory_item(name: str) -> InventoryItem:
    return InventoryItem.objects.create(
        name=name,
        kind="material",
        description=f"{name} description",
    )


def _customer() -> Customer:
    return Customer.objects.create(
        display_name="Consolidation customer",
        email="consolidation@example.test",
        phone="+26134000100",
        address="Antananarivo",
    )


def _reservation_draft() -> ReservationDraft:
    customer = _customer()
    start_at = timezone.now().replace(microsecond=0) + timedelta(days=2)
    end_at = start_at + timedelta(hours=4)
    return ReservationDraft.objects.create(
        customer=customer,
        start_at=start_at,
        end_at=end_at,
        notes="Consolidation draft",
    )


def _logistics_event(draft: ReservationDraft) -> LogisticsEvent:
    return LogisticsEvent.objects.create(
        reservation_draft=draft,
        event_type=LogisticsEventType.PICKUP,
        scheduled_at=timezone.now() + timedelta(days=1),
    )


def test_completeness_no_return_operation(django_user_model) -> None:
    draft = _reservation_draft()
    event = _logistics_event(draft)

    report = check_event_operations_completeness(event=event)

    assert not report.has_return_operation
    assert report.return_operation_id is None
    assert not report.return_operation_validated
    assert not report.has_classification_proposals
    assert not report.is_complete


def test_completeness_draft_return_operation(django_user_model) -> None:
    actor = django_user_model.objects.create_user(username="cons-draft", password="test-pass")
    item = _inventory_item("Draft return item")
    draft = _reservation_draft()
    event = _logistics_event(draft)
    create_inventory_return_operation(
        actor=actor,
        reservation_draft=draft,
        logistics_event=event,
        lines=[
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

    report = check_event_operations_completeness(event=event)

    assert report.has_return_operation
    assert report.return_operation_id is not None
    assert not report.return_operation_validated
    assert not report.is_complete


def test_completeness_validated_return_only_intact(django_user_model) -> None:
    actor = django_user_model.objects.create_user(username="cons-intact", password="test-pass")
    item = _inventory_item("Intact return item")
    draft = _reservation_draft()
    event = _logistics_event(draft)
    ro = create_inventory_return_operation(
        actor=actor,
        reservation_draft=draft,
        logistics_event=event,
        lines=[
            {
                "inventory_item": item,
                "expected_quantity": 3,
                "returned_quantity": 3,
                "damaged_quantity": 0,
                "missing_quantity": 0,
                "condition_status": "intact",
                "notes": "",
            },
        ],
    )
    validate_inventory_return_operation(return_operation=ro, actor=actor)

    report = check_event_operations_completeness(event=event)

    assert report.has_return_operation
    assert report.return_operation_validated
    assert not report.has_classification_proposals
    assert report.intact_line_count == 1
    assert report.all_lines_accounted
    assert report.is_complete


def test_completeness_validated_return_with_damage(django_user_model) -> None:
    actor = django_user_model.objects.create_user(username="cons-damage", password="test-pass")
    item = _inventory_item("Damaged return item")
    draft = _reservation_draft()
    event = _logistics_event(draft)
    ro = create_inventory_return_operation(
        actor=actor,
        reservation_draft=draft,
        logistics_event=event,
        lines=[
            {
                "inventory_item": item,
                "expected_quantity": 2,
                "returned_quantity": 2,
                "damaged_quantity": 2,
                "missing_quantity": 0,
                "condition_status": "damaged",
                "notes": "Scratched",
            },
        ],
    )
    validate_inventory_return_operation(return_operation=ro, actor=actor)

    report = check_event_operations_completeness(event=event)

    assert report.has_return_operation
    assert report.return_operation_validated
    assert report.has_classification_proposals
    assert report.proposal_count == 1
    assert report.is_complete


def test_completeness_validated_return_mixed_lines(django_user_model) -> None:
    actor = django_user_model.objects.create_user(username="cons-mixed", password="test-pass")
    item_a = _inventory_item("Item A")
    item_b = _inventory_item("Item B")
    draft = _reservation_draft()
    event = _logistics_event(draft)
    ro = create_inventory_return_operation(
        actor=actor,
        reservation_draft=draft,
        logistics_event=event,
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
        ],
    )
    validate_inventory_return_operation(return_operation=ro, actor=actor)

    report = check_event_operations_completeness(event=event)

    assert report.has_return_operation
    assert report.return_operation_validated
    assert report.has_classification_proposals
    assert report.proposal_count == 1
    assert report.intact_line_count == 1
    assert report.all_lines_accounted
    assert report.is_complete


def test_summary_no_return_operation(django_user_model) -> None:
    draft = _reservation_draft()
    event = _logistics_event(draft)

    summary = get_event_operations_summary(event=event)

    assert summary["event_id"] == str(event.id)
    assert summary["event_type"] == "pickup"
    assert not summary["has_return_operation"]
    assert summary["return_operation"] is None
    assert summary["classification"] is None
    assert summary["completeness"] is None


def test_summary_draft_return_operation(django_user_model) -> None:
    actor = django_user_model.objects.create_user(username="sum-draft", password="test-pass")
    item = _inventory_item("Summary draft item")
    draft = _reservation_draft()
    event = _logistics_event(draft)
    create_inventory_return_operation(
        actor=actor,
        reservation_draft=draft,
        logistics_event=event,
        lines=[
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

    summary = get_event_operations_summary(event=event)

    assert summary["has_return_operation"]
    assert summary["return_operation"]["status"] == "draft"
    assert not summary["return_operation"]["validated"]
    assert summary["return_operation"]["line_count"] == 1
    assert summary["classification"] is None


def test_summary_validated_return_full(django_user_model) -> None:
    actor = django_user_model.objects.create_user(username="sum-full", password="test-pass")
    item = _inventory_item("Summary full item")
    draft = _reservation_draft()
    event = _logistics_event(draft)
    ro = create_inventory_return_operation(
        actor=actor,
        reservation_draft=draft,
        logistics_event=event,
        lines=[
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
    validate_inventory_return_operation(return_operation=ro, actor=actor)

    summary = get_event_operations_summary(event=event)

    assert summary["has_return_operation"]
    assert summary["return_operation"]["validated"]
    assert summary["return_operation"]["validated_at"] is not None
    assert summary["classification"]["proposal_count"] == 2
    assert summary["classification"]["intact_line_count"] == 1
    assert summary["completeness"]["is_complete"]
    assert summary["completeness"]["has_classification_proposals"]


def test_summary_event_type_and_status(django_user_model) -> None:
    draft = _reservation_draft()
    event = LogisticsEvent.objects.create(
        reservation_draft=draft,
        event_type=LogisticsEventType.HANDOVER,
        scheduled_at=timezone.now() + timedelta(days=1),
    )

    summary = get_event_operations_summary(event=event)

    assert summary["event_type"] == "handover"
    assert summary["event_status"] == "planned"
    assert summary["scheduled_at"] is not None
