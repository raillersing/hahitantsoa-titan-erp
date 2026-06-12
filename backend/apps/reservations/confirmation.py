"""Reservation draft confirmation helpers.

F121G keeps this module backend-internal. It persists the smallest durable
contract/deposit prerequisite markers on reservation drafts, exposes an
advisory preflight, and implements the first transactional confirmation write
with durable inventory blocking.
"""

from dataclasses import dataclass

from django.db import transaction

from apps.audit.services import record_audit_event_on_commit
from apps.inventory.models import (
    InventoryAvailability,
    InventoryAvailabilityStatus,
    InventoryItem,
)
from apps.reservations.attribution import (
    ReservationSensitiveActorAttribution,
    capture_reservation_sensitive_actor_attribution,
)
from apps.reservations.availability import (
    validate_reservation_item_availability_request,
)
from apps.reservations.models import (
    ReservationDraft,
    ReservationDraftLine,
    ReservationDraftStatus,
)

RESERVATION_CONFIRMATION_BLOCKER_MISSING_REQUIRED_DATA = "missing_required_data"
RESERVATION_CONFIRMATION_BLOCKER_ACTIVE_AVAILABILITY_CONFLICT = "active_availability_conflict"
RESERVATION_CONFIRMATION_BLOCKER_MISSING_SIGNED_CONTRACT = "missing_signed_contract"
RESERVATION_CONFIRMATION_BLOCKER_MISSING_REQUIRED_DEPOSIT = "missing_required_deposit"
RESERVATION_CONFIRMATION_BLOCKER_PERMISSION_DENIED = "permission_denied"
CONFIRMED_RESERVATION_AVAILABILITY_NOTE_TEMPLATE = "Confirmed reservation draft {public_reference}."


@dataclass(frozen=True)
class ReservationDraftConfirmationPreflight:
    can_confirm: bool
    blockers: tuple[str, ...]
    active_line_count: int
    attribution_ready: bool


@dataclass(frozen=True)
class ReservationDraftConfirmationResult:
    reservation_draft: ReservationDraft
    blocked_item_count: int


def _append_blocker(*, blockers: list[str], blocker: str) -> None:
    if blocker not in blockers:
        blockers.append(blocker)


def _is_contract_signed(*, reservation_draft: ReservationDraft) -> bool:
    return (
        reservation_draft.contract_signed_at is not None
        and reservation_draft.contract_signed_by_id is not None
    )


def _is_required_deposit_received(*, reservation_draft: ReservationDraft) -> bool:
    return (
        reservation_draft.required_deposit_received_at is not None
        and reservation_draft.required_deposit_received_by_id is not None
    )


def _is_confirmed(*, reservation_draft: ReservationDraft) -> bool:
    return (
        reservation_draft.status == ReservationDraftStatus.CONFIRMED
        and reservation_draft.confirmed_at is not None
        and reservation_draft.confirmed_by_id is not None
    )


def _active_reservation_draft_lines(
    *,
    reservation_draft: ReservationDraft,
) -> tuple[ReservationDraftLine, ...]:
    return tuple(
        reservation_draft.lines.filter(is_deleted=False)
        .select_related("inventory_item")
        .order_by(
            "created_at",
            "id",
        )
    )


def _locked_active_reservation_draft_lines(
    *,
    reservation_draft: ReservationDraft,
) -> tuple[ReservationDraftLine, ...]:
    return tuple(
        reservation_draft.lines.filter(is_deleted=False)
        .select_related("inventory_item")
        .select_for_update()
        .order_by("created_at", "id")
    )


def _availability_revalidation_failed(
    *,
    reservation_draft: ReservationDraft,
    active_lines: tuple[ReservationDraftLine, ...],
) -> bool:
    for line in active_lines:
        if not line.inventory_item.is_active or line.inventory_item.is_deleted:
            return True

        validation = validate_reservation_item_availability_request(
            inventory_item=line.inventory_item,
            inventory_item_kind=line.inventory_item.kind,
            start_at=reservation_draft.start_at,
            end_at=reservation_draft.end_at,
        )
        if not validation.valid or not validation.available:
            return True

    return False


def _get_locked_reservation_draft(
    *,
    reservation_draft: ReservationDraft,
) -> ReservationDraft:
    return ReservationDraft.objects.select_for_update().get(pk=reservation_draft.pk)


def _assert_active_draft_state(*, reservation_draft: ReservationDraft) -> None:
    if reservation_draft.is_deleted:
        raise ValueError("Reservation draft must not be soft-deleted.")

    if reservation_draft.status != ReservationDraftStatus.DRAFT:
        raise ValueError("Reservation draft must remain in draft state.")

    if reservation_draft.confirmed_at is not None or reservation_draft.confirmed_by_id is not None:
        raise ValueError("Reservation draft already carries confirmation metadata.")


def _lock_inventory_items_for_active_lines(
    *,
    active_lines: tuple[ReservationDraftLine, ...],
) -> tuple[InventoryItem, ...]:
    inventory_item_ids = sorted({line.inventory_item_id for line in active_lines})
    return tuple(
        InventoryItem.objects.select_for_update().filter(id__in=inventory_item_ids).order_by("id")
    )


def _persist_contract_signed_marker(
    *,
    reservation_draft: ReservationDraft,
    attribution: ReservationSensitiveActorAttribution,
) -> ReservationDraft:
    if _is_contract_signed(reservation_draft=reservation_draft):
        return reservation_draft

    reservation_draft.contract_signed_at = attribution.attributed_at
    reservation_draft.contract_signed_by_id = attribution.actor_id
    reservation_draft.save(update_fields=["contract_signed_at", "contract_signed_by"])
    return reservation_draft


def _persist_required_deposit_received_marker(
    *,
    reservation_draft: ReservationDraft,
    attribution: ReservationSensitiveActorAttribution,
) -> ReservationDraft:
    if _is_required_deposit_received(reservation_draft=reservation_draft):
        return reservation_draft

    reservation_draft.required_deposit_received_at = attribution.attributed_at
    reservation_draft.required_deposit_received_by_id = attribution.actor_id
    reservation_draft.save(
        update_fields=[
            "required_deposit_received_at",
            "required_deposit_received_by",
        ]
    )
    return reservation_draft


def _create_confirmation_inventory_blocks(
    *,
    reservation_draft: ReservationDraft,
    active_lines: tuple[ReservationDraftLine, ...],
) -> tuple[InventoryAvailability, ...]:
    blocked_periods: list[InventoryAvailability] = []

    for line in active_lines:
        blocked_periods.append(
            InventoryAvailability.objects.create(
                inventory_item=line.inventory_item,
                reservation_draft=reservation_draft,
                status=InventoryAvailabilityStatus.RESERVED,
                start_at=reservation_draft.start_at,
                end_at=reservation_draft.end_at,
                notes=CONFIRMED_RESERVATION_AVAILABILITY_NOTE_TEMPLATE.format(
                    public_reference=reservation_draft.public_reference
                ),
            )
        )

    return tuple(blocked_periods)


def _persist_reservation_draft_confirmation(
    *,
    reservation_draft: ReservationDraft,
    attribution: ReservationSensitiveActorAttribution,
) -> ReservationDraft:
    reservation_draft.status = ReservationDraftStatus.CONFIRMED
    reservation_draft.confirmed_at = attribution.attributed_at
    reservation_draft.confirmed_by_id = attribution.actor_id
    reservation_draft.save(update_fields=["status", "confirmed_at", "confirmed_by"])
    return reservation_draft


def _schedule_confirmation_success_audit(
    *,
    reservation_draft: ReservationDraft,
    actor: object | None,
    blocked_item_count: int,
) -> None:
    record_audit_event_on_commit(
        actor=actor,
        action="reservation.confirmed",
        target_type="reservation_draft",
        target_id=str(reservation_draft.id),
        metadata={
            "public_reference": reservation_draft.public_reference,
            "result": "confirmed",
            "blocked_item_count": blocked_item_count,
        },
    )


def mark_reservation_draft_contract_signed(
    *,
    reservation_draft: ReservationDraft,
    actor: object | None,
) -> ReservationDraft:
    attribution = capture_reservation_sensitive_actor_attribution(actor=actor)

    with transaction.atomic():
        locked_reservation_draft = _get_locked_reservation_draft(
            reservation_draft=reservation_draft
        )
        _assert_active_draft_state(reservation_draft=locked_reservation_draft)
        return _persist_contract_signed_marker(
            reservation_draft=locked_reservation_draft,
            attribution=attribution,
        )


def mark_reservation_draft_required_deposit_received(
    *,
    reservation_draft: ReservationDraft,
    actor: object | None,
) -> ReservationDraft:
    attribution = capture_reservation_sensitive_actor_attribution(actor=actor)

    with transaction.atomic():
        locked_reservation_draft = _get_locked_reservation_draft(
            reservation_draft=reservation_draft
        )
        _assert_active_draft_state(reservation_draft=locked_reservation_draft)
        return _persist_required_deposit_received_marker(
            reservation_draft=locked_reservation_draft,
            attribution=attribution,
        )


def confirm_reservation_draft(
    *,
    reservation_draft: ReservationDraft,
    actor: object | None,
) -> ReservationDraftConfirmationResult:
    attribution = capture_reservation_sensitive_actor_attribution(actor=actor)

    with transaction.atomic():
        locked_reservation_draft = _get_locked_reservation_draft(
            reservation_draft=reservation_draft
        )
        _assert_active_draft_state(reservation_draft=locked_reservation_draft)

        active_lines = _locked_active_reservation_draft_lines(
            reservation_draft=locked_reservation_draft
        )
        if not active_lines:
            raise ValueError("Reservation draft must have at least one active line.")

        _lock_inventory_items_for_active_lines(active_lines=active_lines)

        preflight = get_reservation_draft_confirmation_preflight(
            reservation_draft=locked_reservation_draft,
            actor=actor,
        )
        if not preflight.can_confirm:
            raise ValueError(
                "Reservation draft confirmation preflight failed: " + ", ".join(preflight.blockers)
            )

        blocked_periods = _create_confirmation_inventory_blocks(
            reservation_draft=locked_reservation_draft,
            active_lines=active_lines,
        )
        confirmed_reservation_draft = _persist_reservation_draft_confirmation(
            reservation_draft=locked_reservation_draft,
            attribution=attribution,
        )
        _schedule_confirmation_success_audit(
            reservation_draft=confirmed_reservation_draft,
            actor=actor,
            blocked_item_count=len(blocked_periods),
        )

        return ReservationDraftConfirmationResult(
            reservation_draft=confirmed_reservation_draft,
            blocked_item_count=len(blocked_periods),
        )


def get_reservation_draft_confirmation_preflight(
    *,
    reservation_draft: ReservationDraft,
    actor: object | None,
) -> ReservationDraftConfirmationPreflight:
    blockers: list[str] = []
    attribution_ready = False

    try:
        capture_reservation_sensitive_actor_attribution(actor=actor)
        attribution_ready = True
    except PermissionError:
        _append_blocker(
            blockers=blockers,
            blocker=RESERVATION_CONFIRMATION_BLOCKER_PERMISSION_DENIED,
        )
    except ValueError:
        _append_blocker(
            blockers=blockers,
            blocker=RESERVATION_CONFIRMATION_BLOCKER_MISSING_REQUIRED_DATA,
        )

    if reservation_draft.is_deleted:
        _append_blocker(
            blockers=blockers,
            blocker=RESERVATION_CONFIRMATION_BLOCKER_MISSING_REQUIRED_DATA,
        )

    if reservation_draft.status != ReservationDraftStatus.DRAFT:
        _append_blocker(
            blockers=blockers,
            blocker=RESERVATION_CONFIRMATION_BLOCKER_MISSING_REQUIRED_DATA,
        )

    active_lines = _active_reservation_draft_lines(reservation_draft=reservation_draft)
    if not active_lines:
        _append_blocker(
            blockers=blockers,
            blocker=RESERVATION_CONFIRMATION_BLOCKER_MISSING_REQUIRED_DATA,
        )
    elif not reservation_draft.is_deleted and _availability_revalidation_failed(
        reservation_draft=reservation_draft,
        active_lines=active_lines,
    ):
        _append_blocker(
            blockers=blockers,
            blocker=RESERVATION_CONFIRMATION_BLOCKER_ACTIVE_AVAILABILITY_CONFLICT,
        )

    # Contract and deposit prerequisites are required by accepted decisions but are not yet
    # sufficient for confirmation until both timestamp and actor are durable.
    if not _is_contract_signed(reservation_draft=reservation_draft):
        _append_blocker(
            blockers=blockers,
            blocker=RESERVATION_CONFIRMATION_BLOCKER_MISSING_SIGNED_CONTRACT,
        )
        if (
            reservation_draft.contract_signed_at is not None
            or reservation_draft.contract_signed_by_id is not None
        ):
            _append_blocker(
                blockers=blockers,
                blocker=RESERVATION_CONFIRMATION_BLOCKER_MISSING_REQUIRED_DATA,
            )

    if not _is_required_deposit_received(reservation_draft=reservation_draft):
        _append_blocker(
            blockers=blockers,
            blocker=RESERVATION_CONFIRMATION_BLOCKER_MISSING_REQUIRED_DEPOSIT,
        )
        if (
            reservation_draft.required_deposit_received_at is not None
            or reservation_draft.required_deposit_received_by_id is not None
        ):
            _append_blocker(
                blockers=blockers,
                blocker=RESERVATION_CONFIRMATION_BLOCKER_MISSING_REQUIRED_DATA,
            )

    return ReservationDraftConfirmationPreflight(
        can_confirm=not blockers,
        blockers=tuple(blockers),
        active_line_count=len(active_lines),
        attribution_ready=attribution_ready,
    )
