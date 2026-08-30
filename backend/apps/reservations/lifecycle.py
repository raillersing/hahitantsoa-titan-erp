from __future__ import annotations

from dataclasses import dataclass

from apps.reservations.closeout import get_closeout_summary, validate_reservation_closeable
from apps.reservations.models import ReservationDraft


@dataclass(frozen=True)
class LifecycleStep:
    key: str
    label: str
    status: str
    occurred_at: str | None


@dataclass(frozen=True)
class LifecycleSummary:
    domain: str
    dossier_id: str
    public_reference: str
    status: str
    next_action: str
    blockers: list[str]
    owner_id: str | None
    steps: list[LifecycleStep]


def get_reservation_lifecycle_summary(*, reservation_draft: ReservationDraft) -> LifecycleSummary:
    closeout = get_closeout_summary(reservation_draft_id=str(reservation_draft.id))
    steps = [
        LifecycleStep(
            "contract",
            "Contrat signé",
            "done" if reservation_draft.contract_signed_at else "pending",
            reservation_draft.contract_signed_at.isoformat()
            if reservation_draft.contract_signed_at
            else None,
        ),
        LifecycleStep(
            "deposit",
            "Acompte reçu",
            "done" if reservation_draft.required_deposit_received_at else "pending",
            reservation_draft.required_deposit_received_at.isoformat()
            if reservation_draft.required_deposit_received_at
            else None,
        ),
        LifecycleStep(
            "confirmation",
            "Réservation confirmée",
            "done" if reservation_draft.confirmed_at else "pending",
            reservation_draft.confirmed_at.isoformat() if reservation_draft.confirmed_at else None,
        ),
        LifecycleStep(
            "closeout",
            "Dossier clôturé",
            "done" if closeout and closeout.closeout_status == "closed" else "pending",
            closeout.closed_at if closeout else None,
        ),
    ]
    blockers: list[str] = []
    if reservation_draft.status == "cancelled":
        next_action = "cancelled"
    elif not reservation_draft.contract_signed_at:
        next_action = "sign_contract"
        blockers.append("contract_signature_required")
    elif not reservation_draft.required_deposit_received_at:
        next_action = "record_deposit"
        blockers.append("deposit_required")
    elif reservation_draft.status != "confirmed":
        next_action = "confirm_reservation"
        blockers.append("confirmation_required")
    elif closeout and closeout.closeout_status == "closed":
        next_action = "closed"
    else:
        blockers = validate_reservation_closeable(reservation_draft=reservation_draft)
        next_action = "complete_operations" if blockers else "close_dossier"
    return LifecycleSummary(
        "titan",
        str(reservation_draft.id),
        reservation_draft.public_reference,
        reservation_draft.status,
        next_action,
        blockers,
        str(reservation_draft.confirmed_by_id) if reservation_draft.confirmed_by_id else None,
        steps,
    )
