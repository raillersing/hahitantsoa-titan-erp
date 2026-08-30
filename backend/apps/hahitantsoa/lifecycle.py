from __future__ import annotations

from apps.hahitantsoa.closeout import (
    get_hahitantsoa_closeout_summary,
    validate_hahitantsoa_event_closeable,
)
from apps.hahitantsoa.models import HahitantsoaEventDraft
from apps.reservations.lifecycle import LifecycleStep, LifecycleSummary


def get_hahitantsoa_lifecycle_summary(*, event_draft: HahitantsoaEventDraft) -> LifecycleSummary:
    closeout = get_hahitantsoa_closeout_summary(event_draft_id=str(event_draft.id))
    steps = [
        LifecycleStep(
            "contract",
            "Contrat signé",
            "done" if event_draft.contract_signed_at else "pending",
            event_draft.contract_signed_at.isoformat() if event_draft.contract_signed_at else None,
        ),
        LifecycleStep(
            "deposit",
            "Acompte reçu",
            "done" if event_draft.required_deposit_received_at else "pending",
            event_draft.required_deposit_received_at.isoformat()
            if event_draft.required_deposit_received_at
            else None,
        ),
        LifecycleStep(
            "confirmation",
            "Événement confirmé",
            "done" if event_draft.confirmed_at else "pending",
            event_draft.confirmed_at.isoformat() if event_draft.confirmed_at else None,
        ),
        LifecycleStep(
            "closeout",
            "Dossier clôturé",
            "done" if closeout and closeout.closeout_status == "closed" else "pending",
            closeout.closed_at if closeout else None,
        ),
    ]
    blockers: list[str] = []
    if not event_draft.contract_signed_at:
        next_action = "sign_contract"
        blockers.append("contract_signature_required")
    elif not event_draft.required_deposit_received_at:
        next_action = "record_deposit"
        blockers.append("deposit_required")
    elif event_draft.status != "confirmed":
        next_action = "confirm_event"
        blockers.append("confirmation_required")
    elif closeout and closeout.closeout_status == "closed":
        next_action = "closed"
    else:
        blockers = validate_hahitantsoa_event_closeable(event_draft=event_draft)
        next_action = "complete_operations" if blockers else "close_dossier"
    return LifecycleSummary(
        "hahitantsoa",
        str(event_draft.id),
        event_draft.public_reference,
        event_draft.status,
        next_action,
        blockers,
        str(event_draft.confirmed_by_id) if event_draft.confirmed_by_id else None,
        steps,
    )
