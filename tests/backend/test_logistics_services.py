from dataclasses import dataclass
from datetime import timedelta

import pytest
from django.utils import timezone

from apps.customers.models import Customer
from apps.logistics.models import LogisticsEvent, LogisticsEventStatus, LogisticsEventType
from apps.logistics.services import (
    LogisticsServiceError,
    create_logistics_event,
    transition_logistics_event_status,
    update_logistics_event,
)
from apps.reservations.models import ReservationDraft

pytestmark = pytest.mark.django_db


@dataclass
class ActorStub:
    is_authenticated: bool = True
    is_staff: bool = True
    is_active: bool = True
    pk: int = 1


def _reservation_draft():
    start = timezone.now().replace(microsecond=0)
    customer = Customer.objects.create(display_name="Client")
    return ReservationDraft.objects.create(
        customer=customer,
        start_at=start,
        end_at=start + timedelta(hours=4),
    )


@pytest.fixture
def sample_event():
    draft = _reservation_draft()
    return LogisticsEvent.objects.create(
        reservation_draft=draft,
        event_type=LogisticsEventType.DELIVERY,
        status=LogisticsEventStatus.PLANNED,
    )


def test_create_logistics_event_requires_admin():
    actor = ActorStub(is_staff=False)
    draft = _reservation_draft()
    with pytest.raises(LogisticsServiceError, match="not authorized"):
        create_logistics_event(
            actor=actor, reservation_draft=draft, event_type=LogisticsEventType.DELIVERY
        )


def test_create_logistics_event_success():
    from django.contrib.auth import get_user_model

    User = get_user_model()
    actor = User.objects.create_user(username="staff", password="p", is_staff=True)
    draft = _reservation_draft()
    event = create_logistics_event(
        actor=actor,
        reservation_draft=draft,
        event_type=LogisticsEventType.DELIVERY,
        scheduled_at=timezone.now(),
        address="123 Main St",
    )
    assert event.reservation_draft == draft
    assert event.address == "123 Main St"
    assert event.created_by == actor


def test_update_logistics_event_requires_admin(sample_event):
    actor = ActorStub(is_staff=False)
    with pytest.raises(LogisticsServiceError, match="not authorized"):
        update_logistics_event(actor=actor, event=sample_event, address="New Address")


def test_update_completed_event_fails(sample_event):
    from django.contrib.auth import get_user_model

    User = get_user_model()
    actor = User.objects.create_user(username="staff2", password="p", is_staff=True)
    sample_event.status = LogisticsEventStatus.COMPLETED
    sample_event.save()
    with pytest.raises(LogisticsServiceError, match="completed or cancelled"):
        update_logistics_event(actor=actor, event=sample_event, address="New")


def test_transition_requires_admin(sample_event):
    actor = ActorStub(is_staff=False)
    with pytest.raises(LogisticsServiceError, match="not authorized"):
        transition_logistics_event_status(
            actor=actor, event=sample_event, new_status=LogisticsEventStatus.DISPATCHED
        )


def test_invalid_status_transition(sample_event):
    from django.contrib.auth import get_user_model

    User = get_user_model()
    actor = User.objects.create_user(username="staff3", password="p", is_staff=True)
    with pytest.raises(LogisticsServiceError, match="not allowed"):
        transition_logistics_event_status(
            actor=actor, event=sample_event, new_status=LogisticsEventStatus.COMPLETED
        )


@pytest.fixture
def preparation_event():
    draft = _reservation_draft()
    return LogisticsEvent.objects.create(
        reservation_draft=draft,
        event_type=LogisticsEventType.PREPARATION,
        status=LogisticsEventStatus.PLANNED,
    )


@pytest.fixture
def handover_event():
    draft = _reservation_draft()
    return LogisticsEvent.objects.create(
        reservation_draft=draft,
        event_type=LogisticsEventType.HANDOVER,
        status=LogisticsEventStatus.PLANNED,
    )


def test_create_preparation_event_success():
    from django.contrib.auth import get_user_model

    User = get_user_model()
    actor = User.objects.create_user(username="staff_prep", password="p", is_staff=True)
    draft = _reservation_draft()
    event = create_logistics_event(
        actor=actor,
        reservation_draft=draft,
        event_type=LogisticsEventType.PREPARATION,
    )
    assert event.event_type == LogisticsEventType.PREPARATION
    assert event.status == LogisticsEventStatus.PLANNED


def test_create_handover_event_success():
    from django.contrib.auth import get_user_model

    User = get_user_model()
    actor = User.objects.create_user(username="staff_hand", password="p", is_staff=True)
    draft = _reservation_draft()
    event = create_logistics_event(
        actor=actor,
        reservation_draft=draft,
        event_type=LogisticsEventType.HANDOVER,
    )
    assert event.event_type == LogisticsEventType.HANDOVER
    assert event.status == LogisticsEventStatus.PLANNED


def test_preparation_full_lifecycle():
    from django.contrib.auth import get_user_model

    User = get_user_model()
    actor = User.objects.create_user(username="staff_prep_lc", password="p", is_staff=True)
    draft = _reservation_draft()
    event = create_logistics_event(
        actor=actor, reservation_draft=draft, event_type=LogisticsEventType.PREPARATION
    )
    assert event.status == LogisticsEventStatus.PLANNED

    event = transition_logistics_event_status(
        actor=actor, event=event, new_status=LogisticsEventStatus.DISPATCHED
    )
    assert event.status == LogisticsEventStatus.DISPATCHED

    event = transition_logistics_event_status(
        actor=actor, event=event, new_status=LogisticsEventStatus.COMPLETED
    )
    assert event.status == LogisticsEventStatus.COMPLETED
    assert event.executed_at is not None


def test_handover_full_lifecycle():
    from django.contrib.auth import get_user_model

    User = get_user_model()
    actor = User.objects.create_user(username="staff_hand_lc", password="p", is_staff=True)
    draft = _reservation_draft()
    event = create_logistics_event(
        actor=actor, reservation_draft=draft, event_type=LogisticsEventType.HANDOVER
    )
    assert event.status == LogisticsEventStatus.PLANNED

    event = transition_logistics_event_status(
        actor=actor, event=event, new_status=LogisticsEventStatus.DISPATCHED
    )
    assert event.status == LogisticsEventStatus.DISPATCHED

    event = transition_logistics_event_status(
        actor=actor, event=event, new_status=LogisticsEventStatus.COMPLETED
    )
    assert event.status == LogisticsEventStatus.COMPLETED
    assert event.executed_at is not None


def test_preparation_cancel_lifecycle(preparation_event):
    from django.contrib.auth import get_user_model

    User = get_user_model()
    actor = User.objects.create_user(username="staff_prep_cx", password="p", is_staff=True)
    event = transition_logistics_event_status(
        actor=actor, event=preparation_event, new_status=LogisticsEventStatus.CANCELLED
    )
    assert event.status == LogisticsEventStatus.CANCELLED


def test_handover_cancel_lifecycle(handover_event):
    from django.contrib.auth import get_user_model

    User = get_user_model()
    actor = User.objects.create_user(username="staff_hand_cx", password="p", is_staff=True)
    event = transition_logistics_event_status(
        actor=actor, event=handover_event, new_status=LogisticsEventStatus.CANCELLED
    )
    assert event.status == LogisticsEventStatus.CANCELLED


def test_transition_to_completed_sets_executed_at(sample_event):
    from django.contrib.auth import get_user_model

    User = get_user_model()
    actor = User.objects.create_user(username="staff4", password="p", is_staff=True)
    sample_event.status = LogisticsEventStatus.DISPATCHED
    sample_event.save()
    event = transition_logistics_event_status(
        actor=actor, event=sample_event, new_status=LogisticsEventStatus.COMPLETED
    )
    assert event.status == LogisticsEventStatus.COMPLETED
    assert event.executed_at is not None


def test_transition_to_cancelled_clears_executed_at(sample_event):
    from django.contrib.auth import get_user_model

    User = get_user_model()
    actor = User.objects.create_user(username="staff5", password="p", is_staff=True)
    sample_event.status = LogisticsEventStatus.DISPATCHED
    sample_event.executed_at = timezone.now()
    sample_event.save()
    event = transition_logistics_event_status(
        actor=actor, event=sample_event, new_status=LogisticsEventStatus.CANCELLED
    )
    assert event.status == LogisticsEventStatus.CANCELLED
