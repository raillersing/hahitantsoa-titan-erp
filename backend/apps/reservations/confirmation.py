"""Reservation draft confirmation preflight helpers.

F121F keeps this module backend-internal. It can persist the smallest durable
contract/deposit prerequisite markers on reservation drafts, and it reports
whether a draft is structurally ready for a future confirmation flow without
writing audit rows, mutating confirmation state, or creating inventory blocking
records.
"""

from dataclasses import dataclass

from django.db import transaction

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


@dataclass(frozen=True)
class ReservationDraftConfirmationPreflight:
    can_confirm: bool
    blockers: tuple[str, ...]
    active_line_count: int
    attribution_ready: bool


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
