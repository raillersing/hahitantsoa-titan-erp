from datetime import timedelta

import pytest
from django.core.exceptions import ValidationError
from django.utils import timezone

from apps.customers.models import Customer
from apps.inventory.models import InventoryItem
from apps.logistics.models import LogisticsEvent, LogisticsEventStatus, LogisticsEventType
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
