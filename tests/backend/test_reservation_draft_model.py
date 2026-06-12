from datetime import timedelta

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.customers.models import Customer
from apps.inventory.models import InventoryItem
from apps.reservations.models import (
    ReservationDraft,
    ReservationDraftLine,
    ReservationDraftStatus,
)

pytestmark = pytest.mark.django_db


def _customer() -> Customer:
    return Customer.objects.create(display_name="Client Demo")


def _item(name: str = "Projecteur LED", kind: str = "article") -> InventoryItem:
    return InventoryItem.objects.create(name=name, kind=kind)


def _period():
    start_at = timezone.now().replace(microsecond=0)
    return start_at, start_at + timedelta(hours=2)


def _actor(*, django_user_model, username: str = "reservation-prereq-actor"):
    return django_user_model.objects.create_user(username=username, password="test-password")


def test_reservation_draft_can_be_persisted() -> None:
    start_at, end_at = _period()
    draft = ReservationDraft(
        customer=_customer(),
        start_at=start_at,
        end_at=end_at,
        notes="Draft notes.",
    )

    draft.full_clean()
    draft.save()

    assert draft.status == ReservationDraftStatus.DRAFT
    assert draft.public_reference.startswith("RD-")
    assert draft.is_deleted is False


def test_reservation_draft_rejects_invalid_period() -> None:
    start_at, _ = _period()
    draft = ReservationDraft(customer=_customer(), start_at=start_at, end_at=start_at)

    with pytest.raises(ValidationError):
        draft.full_clean()


def test_reservation_draft_rejects_inactive_customer() -> None:
    start_at, end_at = _period()
    customer = Customer.objects.create(display_name="Inactive", is_active=False)
    draft = ReservationDraft(customer=customer, start_at=start_at, end_at=end_at)

    with pytest.raises(ValidationError):
        draft.full_clean()


def test_reservation_draft_line_can_be_persisted() -> None:
    start_at, end_at = _period()
    draft = ReservationDraft.objects.create(
        customer=_customer(),
        start_at=start_at,
        end_at=end_at,
    )
    line = ReservationDraftLine(
        reservation_draft=draft,
        inventory_item=_item(),
        quantity=2,
    )

    line.full_clean()
    line.save()

    assert line.quantity == 2


def test_reservation_draft_line_rejects_zero_quantity() -> None:
    start_at, end_at = _period()
    draft = ReservationDraft.objects.create(
        customer=_customer(),
        start_at=start_at,
        end_at=end_at,
    )
    line = ReservationDraftLine(
        reservation_draft=draft,
        inventory_item=_item(),
        quantity=0,
    )

    with pytest.raises(ValidationError):
        line.full_clean()


@pytest.mark.django_db(transaction=True)
def test_reservation_draft_line_rejects_duplicate_item_per_draft() -> None:
    start_at, end_at = _period()
    draft = ReservationDraft.objects.create(
        customer=_customer(),
        start_at=start_at,
        end_at=end_at,
    )
    item = _item()
    ReservationDraftLine.objects.create(
        reservation_draft=draft,
        inventory_item=item,
        quantity=1,
    )

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            ReservationDraftLine.objects.create(
                reservation_draft=draft,
                inventory_item=item,
                quantity=1,
            )


def test_reservation_draft_accepts_empty_contract_marker() -> None:
    start_at, end_at = _period()

    draft = ReservationDraft(
        customer=_customer(),
        start_at=start_at,
        end_at=end_at,
        contract_signed_at=None,
        contract_signed_by=None,
    )

    draft.full_clean()
    draft.save()

    assert draft.contract_signed_at is None
    assert draft.contract_signed_by_id is None


def test_reservation_draft_accepts_complete_contract_marker(django_user_model) -> None:
    start_at, end_at = _period()
    actor = _actor(django_user_model=django_user_model, username="contract-complete")

    draft = ReservationDraft(
        customer=_customer(),
        start_at=start_at,
        end_at=end_at,
        contract_signed_at=timezone.now(),
        contract_signed_by=actor,
    )

    draft.full_clean()
    draft.save()

    assert draft.contract_signed_at is not None
    assert draft.contract_signed_by_id == actor.pk


@pytest.mark.django_db(transaction=True)
def test_reservation_draft_rejects_contract_timestamp_without_actor_at_db_level() -> None:
    start_at, end_at = _period()

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            ReservationDraft.objects.create(
                customer=_customer(),
                start_at=start_at,
                end_at=end_at,
                contract_signed_at=timezone.now(),
            )


@pytest.mark.django_db(transaction=True)
def test_reservation_draft_rejects_contract_actor_without_timestamp_at_db_level(
    django_user_model,
) -> None:
    start_at, end_at = _period()
    actor = _actor(django_user_model=django_user_model, username="contract-actor-only")

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            ReservationDraft.objects.create(
                customer=_customer(),
                start_at=start_at,
                end_at=end_at,
                contract_signed_by=actor,
            )


def test_reservation_draft_accepts_empty_required_deposit_marker() -> None:
    start_at, end_at = _period()

    draft = ReservationDraft(
        customer=_customer(),
        start_at=start_at,
        end_at=end_at,
        required_deposit_received_at=None,
        required_deposit_received_by=None,
    )

    draft.full_clean()
    draft.save()

    assert draft.required_deposit_received_at is None
    assert draft.required_deposit_received_by_id is None


def test_reservation_draft_accepts_complete_required_deposit_marker(
    django_user_model,
) -> None:
    start_at, end_at = _period()
    actor = _actor(django_user_model=django_user_model, username="deposit-complete")

    draft = ReservationDraft(
        customer=_customer(),
        start_at=start_at,
        end_at=end_at,
        required_deposit_received_at=timezone.now(),
        required_deposit_received_by=actor,
    )

    draft.full_clean()
    draft.save()

    assert draft.required_deposit_received_at is not None
    assert draft.required_deposit_received_by_id == actor.pk


@pytest.mark.django_db(transaction=True)
def test_reservation_draft_rejects_required_deposit_timestamp_without_actor_at_db_level() -> None:
    start_at, end_at = _period()

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            ReservationDraft.objects.create(
                customer=_customer(),
                start_at=start_at,
                end_at=end_at,
                required_deposit_received_at=timezone.now(),
            )


@pytest.mark.django_db(transaction=True)
def test_reservation_draft_rejects_required_deposit_actor_without_timestamp_at_db_level(
    django_user_model,
) -> None:
    start_at, end_at = _period()
    actor = _actor(django_user_model=django_user_model, username="deposit-actor-only")

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            ReservationDraft.objects.create(
                customer=_customer(),
                start_at=start_at,
                end_at=end_at,
                required_deposit_received_by=actor,
            )
