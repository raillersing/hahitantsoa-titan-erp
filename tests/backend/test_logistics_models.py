from datetime import timedelta

import pytest
from django.core.exceptions import ValidationError
from django.utils import timezone

from apps.customers.models import Customer
from apps.inventory.models import InventoryItem
from apps.logistics.models import (
    LogisticsEvent,
    LogisticsEventItemLine,
    LogisticsEventStatus,
    LogisticsEventType,
)
from apps.reservations.models import ReservationDraft

pytestmark = pytest.mark.django_db


def _customer():
    return Customer.objects.create(display_name="Logistics Client")


def _item():
    return InventoryItem.objects.create(name="Chair", kind="article")


def _reservation_draft():
    start = timezone.now().replace(microsecond=0)
    return ReservationDraft.objects.create(
        customer=_customer(),
        start_at=start,
        end_at=start + timedelta(hours=4),
    )


def test_logistics_event_creation():
    draft = _reservation_draft()
    event = LogisticsEvent.objects.create(
        reservation_draft=draft,
        event_type=LogisticsEventType.DELIVERY,
        status=LogisticsEventStatus.PLANNED,
    )
    assert event.status == LogisticsEventStatus.PLANNED
    assert event.event_type == LogisticsEventType.DELIVERY


def test_preparation_event_creation():
    draft = _reservation_draft()
    event = LogisticsEvent.objects.create(
        reservation_draft=draft,
        event_type=LogisticsEventType.PREPARATION,
        status=LogisticsEventStatus.PLANNED,
    )
    assert event.status == LogisticsEventStatus.PLANNED
    assert event.event_type == LogisticsEventType.PREPARATION


def test_handover_event_creation():
    draft = _reservation_draft()
    event = LogisticsEvent.objects.create(
        reservation_draft=draft,
        event_type=LogisticsEventType.HANDOVER,
        status=LogisticsEventStatus.PLANNED,
    )
    assert event.status == LogisticsEventStatus.PLANNED
    assert event.event_type == LogisticsEventType.HANDOVER


def test_completed_event_requires_executed_at():
    draft = _reservation_draft()
    event = LogisticsEvent(
        reservation_draft=draft,
        event_type=LogisticsEventType.DELIVERY,
        status=LogisticsEventStatus.COMPLETED,
    )
    with pytest.raises(ValidationError, match="executed_at"):
        event.full_clean()


def test_cancelled_event_cannot_have_executed_at():
    draft = _reservation_draft()
    event = LogisticsEvent(
        reservation_draft=draft,
        event_type=LogisticsEventType.PICKUP,
        status=LogisticsEventStatus.CANCELLED,
        executed_at=timezone.now(),
    )
    with pytest.raises(ValidationError, match="cancelled"):
        event.full_clean()


def test_executed_at_requires_scheduled_at():
    draft = _reservation_draft()
    event = LogisticsEvent(
        reservation_draft=draft,
        event_type=LogisticsEventType.DELIVERY,
        executed_at=timezone.now(),
    )
    with pytest.raises(ValidationError, match="scheduled at"):
        event.full_clean()


# Passation signature validation


def test_signature_received_requires_signed_at():
    draft = _reservation_draft()
    event = LogisticsEvent(
        reservation_draft=draft,
        event_type=LogisticsEventType.HANDOVER,
        status=LogisticsEventStatus.COMPLETED,
        executed_at=timezone.now(),
        scheduled_at=timezone.now(),
        signature_required=True,
        signature_received=True,
        signed_at=None,
    )
    with pytest.raises(ValidationError, match="signed_at"):
        event.full_clean()


def test_signed_at_requires_signed_by():
    draft = _reservation_draft()
    event = LogisticsEvent(
        reservation_draft=draft,
        event_type=LogisticsEventType.HANDOVER,
        status=LogisticsEventStatus.COMPLETED,
        executed_at=timezone.now(),
        scheduled_at=timezone.now(),
        signature_required=True,
        signature_received=True,
        signed_at=timezone.now(),
        signed_by=None,
    )
    with pytest.raises(ValidationError, match="signed_by"):
        event.full_clean()


def test_signature_only_for_handover(django_user_model):
    actor = django_user_model.objects.create_user(username="handover_sig", password="p")
    draft = _reservation_draft()
    event = LogisticsEvent(
        reservation_draft=draft,
        event_type=LogisticsEventType.DELIVERY,
        status=LogisticsEventStatus.COMPLETED,
        executed_at=timezone.now(),
        scheduled_at=timezone.now(),
        signature_required=True,
        signature_received=True,
        signed_by=actor,
        signed_at=timezone.now(),
    )
    with pytest.raises(ValidationError, match="handover"):
        event.full_clean()


# LogisticsEventItemLine


def test_item_line_creation():
    draft = _reservation_draft()
    event = LogisticsEvent.objects.create(
        reservation_draft=draft,
        event_type=LogisticsEventType.DELIVERY,
        status=LogisticsEventStatus.PLANNED,
    )
    item = _item()
    line = LogisticsEventItemLine.objects.create(
        logistics_event=event,
        inventory_item=item,
        quantity=5,
        notes="Fragile",
    )
    assert line.quantity == 5
    assert line.inventory_item == item


def test_item_line_unique_per_event_and_item():
    from django.db import IntegrityError

    draft = _reservation_draft()
    event = LogisticsEvent.objects.create(
        reservation_draft=draft,
        event_type=LogisticsEventType.DELIVERY,
        status=LogisticsEventStatus.PLANNED,
    )
    item = _item()
    LogisticsEventItemLine.objects.create(
        logistics_event=event,
        inventory_item=item,
        quantity=2,
    )
    with pytest.raises(IntegrityError):
        LogisticsEventItemLine.objects.create(
            logistics_event=event,
            inventory_item=item,
            quantity=3,
        )


def test_item_line_cascade_delete_on_event():
    draft = _reservation_draft()
    event = LogisticsEvent.objects.create(
        reservation_draft=draft,
        event_type=LogisticsEventType.DELIVERY,
        status=LogisticsEventStatus.PLANNED,
    )
    item = _item()
    line = LogisticsEventItemLine.objects.create(
        logistics_event=event,
        inventory_item=item,
        quantity=2,
    )
    line_id = line.id
    event.delete()
    assert not LogisticsEventItemLine.objects.filter(id=line_id).exists()
