"""Reservation draft confirmation preflight helpers.

F121E keeps this module read-only. It reports whether a draft is structurally
ready for a future confirmation flow without mutating reservation state,
writing audit rows, or creating inventory blocking records.
"""

from dataclasses import dataclass

from apps.reservations.attribution import (
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
    # modeled durably. Keep them explicit blockers rather than inventing state.
    _append_blocker(
        blockers=blockers,
        blocker=RESERVATION_CONFIRMATION_BLOCKER_MISSING_SIGNED_CONTRACT,
    )
    _append_blocker(
        blockers=blockers,
        blocker=RESERVATION_CONFIRMATION_BLOCKER_MISSING_REQUIRED_DEPOSIT,
    )

    return ReservationDraftConfirmationPreflight(
        can_confirm=not blockers,
        blockers=tuple(blockers),
        active_line_count=len(active_lines),
        attribution_ready=attribution_ready,
    )
