from dataclasses import FrozenInstanceError, fields, is_dataclass
from datetime import timedelta
from decimal import Decimal

import pytest
from django.db import transaction
from django.utils import timezone

from apps.audit.models import AuditEvent
from apps.customers.models import Customer
from apps.inventory.availability import is_inventory_item_available
from apps.inventory.models import InventoryAvailability, InventoryAvailabilityStatus
from apps.payments.models import PaymentKind, PaymentMethod, PaymentStatus
from apps.payments.services import confirm_payment, create_payment
from apps.reservations.confirmation import (
    CANCELLED_RESERVATION_AVAILABILITY_NOTE_TEMPLATE,
    CONFIRMED_RESERVATION_AVAILABILITY_NOTE_TEMPLATE,
    REQUIRED_DEPOSIT_PAYMENT_TRUTH_MISSING,
    ReservationConfirmationPreflightError,
    ReservationDraftCancellationResult,
    ReservationDraftConfirmationResult,
    ReservationLifecycleError,
    ReservationLifecycleStateError,
    cancel_confirmed_reservation_draft,
    confirm_reservation_draft,
    get_reservation_draft_confirmation_preflight,
    mark_reservation_draft_contract_signed,
    mark_reservation_draft_required_deposit_received,
)
from apps.reservations.models import ReservationDraft, ReservationDraftLine, ReservationDraftStatus

pytestmark = pytest.mark.django_db


def _period():
    start_at = timezone.now().replace(microsecond=0)
    return start_at, start_at + timedelta(hours=2)


def _customer() -> Customer:
    return Customer.objects.create(display_name="Client Demo")


def _draft() -> ReservationDraft:
    start_at, end_at = _period()
    return ReservationDraft.objects.create(
        customer=_customer(),
        start_at=start_at,
        end_at=end_at,
    )


def _line(
    *,
    reservation_draft: ReservationDraft,
    inventory_item=None,
) -> ReservationDraftLine:
    item = inventory_item or InventoryItemFactory.create()
    return ReservationDraftLine.objects.create(
        reservation_draft=reservation_draft,
        inventory_item=item,
        quantity=1,
    )


class ActorFactory:
    counter = 0


def _actor(*, django_user_model, username: str = "confirmation-staff", is_staff: bool = True):
    ActorFactory.counter += 1
    return django_user_model.objects.create_user(
        username=f"{username}-{ActorFactory.counter}",
        password="test-password",
        is_staff=is_staff,
    )


class InventoryItemFactory:
    counter = 0

    @classmethod
    def create(cls):
        from apps.inventory.models import InventoryItem

        cls.counter += 1
        return InventoryItem.objects.create(
            name=f"Confirmation Item {cls.counter}",
            kind="material",
        )


def _confirmed_deposit_payment(*, reservation_draft: ReservationDraft, actor) -> None:
    payment = create_payment(
        actor=actor,
        reservation_draft=reservation_draft,
        payment_kind=PaymentKind.DEPOSIT,
        payment_method=PaymentMethod.CASH,
        payment_status=PaymentStatus.PENDING,
        amount=Decimal("500000.00"),
        source_label="Reservation deposit",
    )
    confirm_payment(payment=payment, actor=actor)


def _prepare_confirmable_draft(*, django_user_model):
    draft = _draft()
    actor = _actor(django_user_model=django_user_model)
    _line(reservation_draft=draft)
    mark_reservation_draft_contract_signed(reservation_draft=draft, actor=actor)
    _confirmed_deposit_payment(reservation_draft=draft, actor=actor)
    mark_reservation_draft_required_deposit_received(
        reservation_draft=draft,
        actor=actor,
    )
    draft.refresh_from_db()
    return draft, actor


def test_mark_contract_signed_persists_timestamp_and_actor(django_user_model) -> None:
    draft = _draft()
    actor = _actor(django_user_model=django_user_model)

    updated_draft = mark_reservation_draft_contract_signed(
        reservation_draft=draft,
        actor=actor,
    )

    draft.refresh_from_db()
    assert updated_draft.id == draft.id
    assert draft.contract_signed_at is not None
    assert draft.contract_signed_by_id == actor.pk


def test_mark_required_deposit_received_persists_timestamp_and_actor(
    django_user_model,
) -> None:
    draft = _draft()
    actor = _actor(django_user_model=django_user_model)
    _confirmed_deposit_payment(reservation_draft=draft, actor=actor)

    updated_draft = mark_reservation_draft_required_deposit_received(
        reservation_draft=draft,
        actor=actor,
    )

    draft.refresh_from_db()
    assert updated_draft.id == draft.id
    assert draft.required_deposit_received_at is not None
    assert draft.required_deposit_received_by_id == actor.pk


def test_lifecycle_exceptions_subclass_value_error() -> None:
    assert issubclass(ReservationLifecycleError, ValueError)
    assert issubclass(ReservationLifecycleStateError, ReservationLifecycleError)
    assert issubclass(ReservationConfirmationPreflightError, ReservationLifecycleError)


def test_confirmation_result_dataclasses_are_frozen_with_stable_fields() -> None:
    assert is_dataclass(ReservationDraftConfirmationResult)
    assert ReservationDraftConfirmationResult.__dataclass_params__.frozen is True
    assert tuple(field.name for field in fields(ReservationDraftConfirmationResult)) == (
        "reservation_draft",
        "blocked_item_count",
    )

    assert is_dataclass(ReservationDraftCancellationResult)
    assert ReservationDraftCancellationResult.__dataclass_params__.frozen is True
    assert tuple(field.name for field in fields(ReservationDraftCancellationResult)) == (
        "reservation_draft",
        "released_block_count",
    )

    result = ReservationDraftConfirmationResult(reservation_draft=object(), blocked_item_count=1)
    with pytest.raises(FrozenInstanceError):
        result.blocked_item_count = 2  # type: ignore[misc]


def test_prerequisite_marker_write_denies_unauthorized_actor() -> None:
    draft = _draft()

    with pytest.raises(PermissionError):
        mark_reservation_draft_contract_signed(
            reservation_draft=draft,
            actor=None,
        )


def test_prerequisite_marker_write_denies_actor_without_persistent_identifier() -> None:
    draft = _draft()

    class StaffLikeActor:
        is_authenticated = True
        is_active = True
        is_staff = True

    with pytest.raises(ValueError):
        mark_reservation_draft_required_deposit_received(
            reservation_draft=draft,
            actor=StaffLikeActor(),
        )


def test_prerequisite_marker_write_refuses_soft_deleted_draft(django_user_model) -> None:
    draft = _draft()
    actor = _actor(django_user_model=django_user_model)
    _confirmed_deposit_payment(reservation_draft=draft, actor=actor)
    draft.is_deleted = True
    draft.deleted_at = timezone.now()
    draft.save(update_fields=["is_deleted", "deleted_at"])

    with pytest.raises(ValueError):
        mark_reservation_draft_contract_signed(
            reservation_draft=draft,
            actor=actor,
        )

    with pytest.raises(ReservationLifecycleStateError) as error_info:
        mark_reservation_draft_required_deposit_received(
            reservation_draft=draft,
            actor=actor,
        )

    assert error_info.value.code == "soft_deleted_draft"


def test_prerequisite_marker_write_refuses_draft_with_cancellation_metadata(
    django_user_model,
) -> None:
    draft = _draft()
    actor = _actor(django_user_model=django_user_model)
    _confirmed_deposit_payment(reservation_draft=draft, actor=actor)
    draft.cancelled_at = timezone.now()
    draft.cancelled_by = actor
    draft.save(update_fields=["cancelled_at", "cancelled_by"])

    with pytest.raises(ValueError):
        mark_reservation_draft_contract_signed(
            reservation_draft=draft,
            actor=actor,
        )

    with pytest.raises(ReservationLifecycleStateError) as error_info:
        mark_reservation_draft_required_deposit_received(
            reservation_draft=draft,
            actor=actor,
        )

    assert error_info.value.code == "draft_has_cancellation_metadata"


def test_prerequisite_marker_write_refuses_draft_with_confirmation_metadata(
    django_user_model,
) -> None:
    draft = _draft()
    actor = _actor(django_user_model=django_user_model)
    _confirmed_deposit_payment(reservation_draft=draft, actor=actor)
    draft.confirmed_at = timezone.now()
    draft.confirmed_by = actor
    draft.save(update_fields=["confirmed_at", "confirmed_by"])

    with pytest.raises(ReservationLifecycleStateError) as error_info:
        mark_reservation_draft_contract_signed(
            reservation_draft=draft,
            actor=actor,
        )

    assert error_info.value.code == "draft_has_confirmation_metadata"


@pytest.mark.django_db(transaction=True)
def test_prerequisite_marker_write_rolls_back_with_outer_transaction(
    django_user_model,
) -> None:
    draft = _draft()
    actor = _actor(django_user_model=django_user_model)
    _confirmed_deposit_payment(reservation_draft=draft, actor=actor)

    with pytest.raises(RuntimeError):
        with transaction.atomic():
            mark_reservation_draft_contract_signed(
                reservation_draft=draft,
                actor=actor,
            )
            raise RuntimeError("rollback")

    draft.refresh_from_db()
    assert draft.contract_signed_at is None
    assert draft.contract_signed_by_id is None


def test_mark_required_deposit_received_requires_confirmed_deposit_payment_truth(
    django_user_model,
) -> None:
    draft = _draft()
    actor = _actor(django_user_model=django_user_model)

    with pytest.raises(ReservationLifecycleError) as error_info:
        mark_reservation_draft_required_deposit_received(
            reservation_draft=draft,
            actor=actor,
        )

    assert error_info.value.code == REQUIRED_DEPOSIT_PAYMENT_TRUTH_MISSING
    draft.refresh_from_db()
    assert draft.required_deposit_received_at is None
    assert draft.required_deposit_received_by_id is None


def test_confirmation_succeeds_and_persists_state_blocks_and_audit(
    django_user_model, django_capture_on_commit_callbacks
) -> None:
    draft, actor = _prepare_confirmable_draft(django_user_model=django_user_model)

    with django_capture_on_commit_callbacks(execute=True):
        result = confirm_reservation_draft(reservation_draft=draft, actor=actor)

    draft.refresh_from_db()
    assert result == ReservationDraftConfirmationResult(
        reservation_draft=draft,
        blocked_item_count=1,
    )
    assert draft.status == ReservationDraftStatus.CONFIRMED
    assert draft.confirmed_at is not None
    assert draft.confirmed_by_id == actor.pk

    blocked_period = InventoryAvailability.objects.get(reservation_draft=draft)
    assert blocked_period.status == InventoryAvailabilityStatus.RESERVED
    assert blocked_period.notes == CONFIRMED_RESERVATION_AVAILABILITY_NOTE_TEMPLATE.format(
        public_reference=draft.public_reference
    )

    audit_event = AuditEvent.objects.get()
    assert audit_event.action == "reservation.confirmed"
    assert audit_event.target_id == str(draft.id)
    assert audit_event.metadata["blocked_item_count"] == 1


def test_confirmation_denies_unauthorized_actor(django_user_model) -> None:
    draft, _actor_user = _prepare_confirmable_draft(django_user_model=django_user_model)

    with pytest.raises(PermissionError):
        confirm_reservation_draft(reservation_draft=draft, actor=None)


def test_confirmation_denies_actor_without_persistent_identifier(django_user_model) -> None:
    draft, _actor_user = _prepare_confirmable_draft(django_user_model=django_user_model)

    class StaffLikeActor:
        is_authenticated = True
        is_active = True
        is_staff = True

    with pytest.raises(ValueError):
        confirm_reservation_draft(reservation_draft=draft, actor=StaffLikeActor())


def test_confirmation_refuses_soft_deleted_draft(django_user_model) -> None:
    draft, actor = _prepare_confirmable_draft(django_user_model=django_user_model)
    draft.is_deleted = True
    draft.deleted_at = timezone.now()
    draft.save(update_fields=["is_deleted", "deleted_at"])

    with pytest.raises(ValueError):
        confirm_reservation_draft(reservation_draft=draft, actor=actor)


def test_confirmation_refuses_non_draft_state(django_user_model) -> None:
    draft, actor = _prepare_confirmable_draft(django_user_model=django_user_model)
    draft.status = ReservationDraftStatus.CONFIRMED
    draft.save(update_fields=["status"])

    with pytest.raises(ValueError):
        confirm_reservation_draft(reservation_draft=draft, actor=actor)

    with pytest.raises(ReservationLifecycleStateError) as error_info:
        confirm_reservation_draft(reservation_draft=draft, actor=actor)

    assert error_info.value.code == "draft_not_in_draft_state"


def test_confirmation_refuses_draft_with_cancellation_metadata(django_user_model) -> None:
    draft, actor = _prepare_confirmable_draft(django_user_model=django_user_model)
    draft.cancelled_at = timezone.now()
    draft.cancelled_by = actor
    draft.save(update_fields=["cancelled_at", "cancelled_by"])

    with pytest.raises(ValueError):
        confirm_reservation_draft(reservation_draft=draft, actor=actor)

    assert AuditEvent.objects.filter(action="reservation.confirmed").count() == 0


def test_confirmation_refuses_draft_with_confirmation_metadata(django_user_model) -> None:
    draft, actor = _prepare_confirmable_draft(django_user_model=django_user_model)
    draft.confirmed_at = timezone.now()
    draft.confirmed_by = actor
    draft.save(update_fields=["confirmed_at", "confirmed_by"])

    with pytest.raises(ReservationLifecycleStateError) as error_info:
        confirm_reservation_draft(reservation_draft=draft, actor=actor)

    assert error_info.value.code == "draft_has_confirmation_metadata"


def test_confirmation_refuses_no_active_lines(django_user_model) -> None:
    draft = _draft()
    actor = _actor(django_user_model=django_user_model)
    _confirmed_deposit_payment(reservation_draft=draft, actor=actor)
    mark_reservation_draft_contract_signed(reservation_draft=draft, actor=actor)
    mark_reservation_draft_required_deposit_received(
        reservation_draft=draft,
        actor=actor,
    )

    with pytest.raises(ReservationLifecycleStateError) as error_info:
        confirm_reservation_draft(reservation_draft=draft, actor=actor)

    assert error_info.value.code == "draft_has_no_active_lines"


def test_confirmation_refuses_missing_contract_marker(django_user_model) -> None:
    draft = _draft()
    actor = _actor(django_user_model=django_user_model)
    _line(reservation_draft=draft)
    _confirmed_deposit_payment(reservation_draft=draft, actor=actor)
    mark_reservation_draft_required_deposit_received(
        reservation_draft=draft,
        actor=actor,
    )

    with pytest.raises(ReservationConfirmationPreflightError) as error_info:
        confirm_reservation_draft(reservation_draft=draft, actor=actor)

    assert error_info.value.code == "confirmation_preflight_failed"
    assert error_info.value.blockers == ("missing_signed_contract",)


def test_confirmation_refuses_missing_deposit_marker(django_user_model) -> None:
    draft = _draft()
    actor = _actor(django_user_model=django_user_model)
    _line(reservation_draft=draft)
    mark_reservation_draft_contract_signed(reservation_draft=draft, actor=actor)

    with pytest.raises(ReservationConfirmationPreflightError) as error_info:
        confirm_reservation_draft(reservation_draft=draft, actor=actor)

    assert error_info.value.code == "confirmation_preflight_failed"
    assert error_info.value.blockers == ("missing_required_deposit",)


def test_confirmation_refuses_manual_deposit_marker_without_confirmed_payment_truth(
    django_user_model,
) -> None:
    draft = _draft()
    actor = _actor(django_user_model=django_user_model)
    _line(reservation_draft=draft)
    mark_reservation_draft_contract_signed(reservation_draft=draft, actor=actor)
    draft.required_deposit_received_at = timezone.now()
    draft.required_deposit_received_by = actor
    draft.save(update_fields=["required_deposit_received_at", "required_deposit_received_by"])

    with pytest.raises(ReservationConfirmationPreflightError) as error_info:
        confirm_reservation_draft(reservation_draft=draft, actor=actor)

    assert error_info.value.code == "confirmation_preflight_failed"
    assert error_info.value.blockers == ("missing_required_deposit",)


def test_confirmation_refuses_availability_conflict(django_user_model) -> None:
    draft = _draft()
    actor = _actor(django_user_model=django_user_model)
    line = _line(reservation_draft=draft)
    mark_reservation_draft_contract_signed(reservation_draft=draft, actor=actor)
    _confirmed_deposit_payment(reservation_draft=draft, actor=actor)
    mark_reservation_draft_required_deposit_received(
        reservation_draft=draft,
        actor=actor,
    )
    InventoryAvailability.objects.create(
        inventory_item=line.inventory_item,
        status=InventoryAvailabilityStatus.RESERVED,
        start_at=draft.start_at,
        end_at=draft.end_at,
    )

    with pytest.raises(ReservationConfirmationPreflightError) as error_info:
        confirm_reservation_draft(reservation_draft=draft, actor=actor)

    assert error_info.value.code == "confirmation_preflight_failed"
    assert error_info.value.blockers == ("active_availability_conflict",)


def test_confirmation_refuses_inactive_or_soft_deleted_inventory_item(django_user_model) -> None:
    draft = _draft()
    actor = _actor(django_user_model=django_user_model)
    line = _line(reservation_draft=draft)
    mark_reservation_draft_contract_signed(reservation_draft=draft, actor=actor)
    _confirmed_deposit_payment(reservation_draft=draft, actor=actor)
    mark_reservation_draft_required_deposit_received(
        reservation_draft=draft,
        actor=actor,
    )
    line.inventory_item.is_active = False
    line.inventory_item.is_deleted = True
    line.inventory_item.deleted_at = timezone.now()
    line.inventory_item.save(update_fields=["is_active", "is_deleted", "deleted_at"])

    with pytest.raises(ReservationConfirmationPreflightError) as error_info:
        confirm_reservation_draft(reservation_draft=draft, actor=actor)

    assert error_info.value.code == "confirmation_preflight_failed"
    assert error_info.value.blockers == ("active_availability_conflict",)


def test_confirmation_revalidates_inside_transaction_and_blocks_stale_double_booking(
    django_user_model,
) -> None:
    item = InventoryItemFactory.create()
    actor = _actor(django_user_model=django_user_model)

    first_draft = _draft()
    _line(reservation_draft=first_draft, inventory_item=item)
    mark_reservation_draft_contract_signed(reservation_draft=first_draft, actor=actor)
    _confirmed_deposit_payment(reservation_draft=first_draft, actor=actor)
    mark_reservation_draft_required_deposit_received(
        reservation_draft=first_draft,
        actor=actor,
    )

    second_draft = _draft()
    second_draft.start_at = first_draft.start_at
    second_draft.end_at = first_draft.end_at
    second_draft.save(update_fields=["start_at", "end_at"])
    _line(reservation_draft=second_draft, inventory_item=item)
    mark_reservation_draft_contract_signed(reservation_draft=second_draft, actor=actor)
    _confirmed_deposit_payment(reservation_draft=second_draft, actor=actor)
    mark_reservation_draft_required_deposit_received(
        reservation_draft=second_draft,
        actor=actor,
    )
    second_draft.refresh_from_db()

    preflight = get_reservation_draft_confirmation_preflight(
        reservation_draft=second_draft,
        actor=actor,
    )
    assert preflight.can_confirm is True

    confirm_reservation_draft(reservation_draft=first_draft, actor=actor)

    with pytest.raises(ReservationConfirmationPreflightError) as error_info:
        confirm_reservation_draft(reservation_draft=second_draft, actor=actor)

    assert error_info.value.blockers == ("active_availability_conflict",)


@pytest.mark.django_db(transaction=True)
def test_confirmation_rolls_back_blocks_when_state_persist_fails(
    django_user_model, monkeypatch: pytest.MonkeyPatch
) -> None:
    from apps.reservations import confirmation as reservation_confirmation

    draft, actor = _prepare_confirmable_draft(django_user_model=django_user_model)

    def raise_after_blocking(**kwargs):
        raise RuntimeError("boom after blocking")

    monkeypatch.setattr(
        reservation_confirmation,
        "_persist_reservation_draft_confirmation",
        raise_after_blocking,
    )
    initial_audit_count = AuditEvent.objects.count()

    with pytest.raises(RuntimeError):
        confirm_reservation_draft(reservation_draft=draft, actor=actor)

    draft.refresh_from_db()
    assert draft.status == ReservationDraftStatus.DRAFT
    assert draft.confirmed_at is None
    assert draft.confirmed_by_id is None
    assert InventoryAvailability.objects.filter(reservation_draft=draft).count() == 0
    assert AuditEvent.objects.count() == initial_audit_count


@pytest.mark.django_db(transaction=True)
def test_confirmation_rolls_back_state_when_audit_schedule_fails(
    django_user_model, monkeypatch: pytest.MonkeyPatch
) -> None:
    from apps.reservations import confirmation as reservation_confirmation

    draft, actor = _prepare_confirmable_draft(django_user_model=django_user_model)

    def raise_before_commit(**kwargs):
        raise RuntimeError("boom before commit")

    monkeypatch.setattr(
        reservation_confirmation,
        "_schedule_confirmation_success_audit",
        raise_before_commit,
    )
    initial_audit_count = AuditEvent.objects.count()

    with pytest.raises(RuntimeError):
        confirm_reservation_draft(reservation_draft=draft, actor=actor)

    draft.refresh_from_db()
    assert draft.status == ReservationDraftStatus.DRAFT
    assert draft.confirmed_at is None
    assert draft.confirmed_by_id is None
    assert InventoryAvailability.objects.filter(reservation_draft=draft).count() == 0
    assert AuditEvent.objects.count() == initial_audit_count


def test_cancellation_succeeds_releases_blocks_and_persists_state_and_audit(
    django_user_model, django_capture_on_commit_callbacks
) -> None:
    draft, actor = _prepare_confirmable_draft(django_user_model=django_user_model)
    line = draft.lines.select_related("inventory_item").get()
    confirm_reservation_draft(reservation_draft=draft, actor=actor)
    draft.refresh_from_db()

    with django_capture_on_commit_callbacks(execute=True):
        result = cancel_confirmed_reservation_draft(reservation_draft=draft, actor=actor)

    draft.refresh_from_db()
    assert result == ReservationDraftCancellationResult(
        reservation_draft=draft,
        released_block_count=1,
    )
    assert draft.status == ReservationDraftStatus.CANCELLED
    assert draft.cancelled_at is not None
    assert draft.cancelled_by_id == actor.pk

    blocked_period = InventoryAvailability.objects.get(reservation_draft=draft)
    assert blocked_period.is_deleted is True
    assert blocked_period.deleted_at is not None
    assert blocked_period.notes == CANCELLED_RESERVATION_AVAILABILITY_NOTE_TEMPLATE.format(
        public_reference=draft.public_reference
    )
    assert (
        is_inventory_item_available(
            inventory_item=line.inventory_item,
            start_at=draft.start_at,
            end_at=draft.end_at,
        )
        is True
    )

    audit_event = AuditEvent.objects.filter(action="reservation.cancelled").get()
    assert audit_event.target_id == str(draft.id)
    assert audit_event.metadata["released_block_count"] == 1


def test_cancellation_releases_only_linked_confirmation_blocks(django_user_model) -> None:
    first_draft, actor = _prepare_confirmable_draft(django_user_model=django_user_model)
    second_draft, second_actor = _prepare_confirmable_draft(django_user_model=django_user_model)
    confirm_reservation_draft(reservation_draft=first_draft, actor=actor)
    confirm_reservation_draft(reservation_draft=second_draft, actor=second_actor)

    cancel_confirmed_reservation_draft(reservation_draft=first_draft, actor=actor)

    assert (
        InventoryAvailability.objects.filter(
            reservation_draft=first_draft,
            is_deleted=False,
        ).count()
        == 0
    )
    assert (
        InventoryAvailability.objects.filter(
            reservation_draft=first_draft,
            is_deleted=True,
        ).count()
        == 1
    )
    assert (
        InventoryAvailability.objects.filter(
            reservation_draft=second_draft,
            is_deleted=False,
        ).count()
        == 1
    )


def test_cancellation_does_not_modify_unrelated_or_soft_deleted_blocks(
    django_user_model,
) -> None:
    draft, actor = _prepare_confirmable_draft(django_user_model=django_user_model)
    confirm_reservation_draft(reservation_draft=draft, actor=actor)
    draft.refresh_from_db()

    own_active_block = InventoryAvailability.objects.get(
        reservation_draft=draft,
        is_deleted=False,
    )
    unrelated_block = InventoryAvailability.objects.create(
        inventory_item=own_active_block.inventory_item,
        status=InventoryAvailabilityStatus.BLOCKED,
        start_at=draft.start_at,
        end_at=draft.end_at,
        notes="Unrelated block",
    )
    other_draft, other_actor = _prepare_confirmable_draft(django_user_model=django_user_model)
    confirm_reservation_draft(reservation_draft=other_draft, actor=other_actor)
    other_block = InventoryAvailability.objects.get(
        reservation_draft=other_draft,
        is_deleted=False,
    )
    soft_deleted_linked_block = InventoryAvailability.objects.create(
        inventory_item=own_active_block.inventory_item,
        reservation_draft=draft,
        status=InventoryAvailabilityStatus.RESERVED,
        start_at=draft.start_at,
        end_at=draft.end_at,
        notes="Already released",
        is_deleted=True,
        deleted_at=timezone.now(),
    )

    cancel_confirmed_reservation_draft(reservation_draft=draft, actor=actor)

    own_active_block.refresh_from_db()
    unrelated_block.refresh_from_db()
    other_block.refresh_from_db()
    soft_deleted_linked_block.refresh_from_db()

    assert own_active_block.is_deleted is True
    assert unrelated_block.is_deleted is False
    assert unrelated_block.notes == "Unrelated block"
    assert other_block.is_deleted is False
    assert soft_deleted_linked_block.is_deleted is True
    assert soft_deleted_linked_block.notes == "Already released"


def test_cancellation_refuses_draft_unconfirmed_reservation(django_user_model) -> None:
    draft = _draft()
    actor = _actor(django_user_model=django_user_model)

    with pytest.raises(ReservationLifecycleStateError) as error_info:
        cancel_confirmed_reservation_draft(reservation_draft=draft, actor=actor)

    assert error_info.value.code == "draft_not_confirmed"


def test_cancellation_refuses_confirmed_status_without_confirmed_at(django_user_model) -> None:
    draft, actor = _prepare_confirmable_draft(django_user_model=django_user_model)
    confirm_reservation_draft(reservation_draft=draft, actor=actor)
    draft.confirmed_at = None
    draft.save(update_fields=["confirmed_at"])

    with pytest.raises(ReservationLifecycleStateError) as error_info:
        cancel_confirmed_reservation_draft(reservation_draft=draft, actor=actor)

    assert error_info.value.code == "incomplete_confirmation_metadata"

    assert AuditEvent.objects.filter(action="reservation.cancelled").count() == 0


def test_cancellation_refuses_confirmed_status_without_confirmed_by(django_user_model) -> None:
    draft, actor = _prepare_confirmable_draft(django_user_model=django_user_model)
    confirm_reservation_draft(reservation_draft=draft, actor=actor)
    draft.confirmed_by = None
    draft.save(update_fields=["confirmed_by"])

    with pytest.raises(ReservationLifecycleStateError) as error_info:
        cancel_confirmed_reservation_draft(reservation_draft=draft, actor=actor)

    assert error_info.value.code == "incomplete_confirmation_metadata"

    assert AuditEvent.objects.filter(action="reservation.cancelled").count() == 0


def test_cancellation_refuses_partial_cancellation_metadata_on_confirmed_draft(
    django_user_model,
) -> None:
    draft, actor = _prepare_confirmable_draft(django_user_model=django_user_model)
    confirm_reservation_draft(reservation_draft=draft, actor=actor)
    draft.cancelled_at = timezone.now()
    draft.save(update_fields=["cancelled_at"])

    with pytest.raises(ReservationLifecycleStateError) as error_info:
        cancel_confirmed_reservation_draft(reservation_draft=draft, actor=actor)

    assert error_info.value.code == "partial_cancellation_metadata"

    assert AuditEvent.objects.filter(action="reservation.cancelled").count() == 0


def test_cancellation_refuses_already_cancelled_reservation(django_user_model) -> None:
    draft, actor = _prepare_confirmable_draft(django_user_model=django_user_model)
    confirm_reservation_draft(reservation_draft=draft, actor=actor)
    cancel_confirmed_reservation_draft(reservation_draft=draft, actor=actor)

    with pytest.raises(ReservationLifecycleStateError) as error_info:
        cancel_confirmed_reservation_draft(reservation_draft=draft, actor=actor)

    assert error_info.value.code == "draft_already_cancelled"


def test_cancellation_refuses_unauthorized_actor(django_user_model) -> None:
    draft, actor = _prepare_confirmable_draft(django_user_model=django_user_model)
    confirm_reservation_draft(reservation_draft=draft, actor=actor)

    with pytest.raises(PermissionError):
        cancel_confirmed_reservation_draft(reservation_draft=draft, actor=None)


def test_cancellation_refuses_actor_without_persistent_identifier(django_user_model) -> None:
    draft, actor = _prepare_confirmable_draft(django_user_model=django_user_model)
    confirm_reservation_draft(reservation_draft=draft, actor=actor)

    class StaffLikeActor:
        is_authenticated = True
        is_active = True
        is_staff = True

    with pytest.raises(ValueError):
        cancel_confirmed_reservation_draft(
            reservation_draft=draft,
            actor=StaffLikeActor(),
        )


def test_cancellation_refuses_soft_deleted_reservation_draft(django_user_model) -> None:
    draft, actor = _prepare_confirmable_draft(django_user_model=django_user_model)
    confirm_reservation_draft(reservation_draft=draft, actor=actor)
    draft.is_deleted = True
    draft.deleted_at = timezone.now()
    draft.save(update_fields=["is_deleted", "deleted_at"])

    with pytest.raises(ValueError):
        cancel_confirmed_reservation_draft(reservation_draft=draft, actor=actor)

    assert AuditEvent.objects.filter(action="reservation.cancelled").count() == 0


@pytest.mark.django_db(transaction=True)
def test_cancellation_rolls_back_when_release_fails(
    django_user_model, monkeypatch: pytest.MonkeyPatch
) -> None:
    from apps.reservations import confirmation as reservation_confirmation

    draft, actor = _prepare_confirmable_draft(django_user_model=django_user_model)
    confirm_reservation_draft(reservation_draft=draft, actor=actor)

    def raise_during_release(**kwargs):
        raise RuntimeError("boom during release")

    monkeypatch.setattr(
        reservation_confirmation,
        "_release_confirmation_inventory_blocks",
        raise_during_release,
    )

    with pytest.raises(RuntimeError):
        cancel_confirmed_reservation_draft(reservation_draft=draft, actor=actor)

    draft.refresh_from_db()
    assert draft.status == ReservationDraftStatus.CONFIRMED
    assert (
        InventoryAvailability.objects.filter(
            reservation_draft=draft,
            is_deleted=False,
        ).count()
        == 1
    )
    assert AuditEvent.objects.filter(action="reservation.cancelled").count() == 0


@pytest.mark.django_db(transaction=True)
def test_cancellation_rolls_back_when_status_persist_fails(
    django_user_model, monkeypatch: pytest.MonkeyPatch
) -> None:
    from apps.reservations import confirmation as reservation_confirmation

    draft, actor = _prepare_confirmable_draft(django_user_model=django_user_model)
    confirm_reservation_draft(reservation_draft=draft, actor=actor)

    def raise_before_status(**kwargs):
        raise RuntimeError("boom before cancelled state")

    monkeypatch.setattr(
        reservation_confirmation,
        "_persist_reservation_draft_cancellation",
        raise_before_status,
    )

    with pytest.raises(RuntimeError):
        cancel_confirmed_reservation_draft(reservation_draft=draft, actor=actor)

    draft.refresh_from_db()
    assert draft.status == ReservationDraftStatus.CONFIRMED
    assert draft.cancelled_at is None
    assert draft.cancelled_by_id is None
    assert (
        InventoryAvailability.objects.filter(
            reservation_draft=draft,
            is_deleted=False,
        ).count()
        == 1
    )
    assert AuditEvent.objects.filter(action="reservation.cancelled").count() == 0


@pytest.mark.django_db(transaction=True)
def test_cancellation_rolls_back_when_audit_schedule_fails(
    django_user_model, monkeypatch: pytest.MonkeyPatch
) -> None:
    from apps.reservations import confirmation as reservation_confirmation

    draft, actor = _prepare_confirmable_draft(django_user_model=django_user_model)
    confirm_reservation_draft(reservation_draft=draft, actor=actor)

    def raise_before_commit(**kwargs):
        raise RuntimeError("boom before cancellation audit")

    monkeypatch.setattr(
        reservation_confirmation,
        "_schedule_cancellation_success_audit",
        raise_before_commit,
    )

    with pytest.raises(RuntimeError):
        cancel_confirmed_reservation_draft(reservation_draft=draft, actor=actor)

    draft.refresh_from_db()
    assert draft.status == ReservationDraftStatus.CONFIRMED
    assert draft.cancelled_at is None
    assert draft.cancelled_by_id is None
    assert (
        InventoryAvailability.objects.filter(
            reservation_draft=draft,
            is_deleted=False,
        ).count()
        == 1
    )
    assert AuditEvent.objects.filter(action="reservation.cancelled").count() == 0
