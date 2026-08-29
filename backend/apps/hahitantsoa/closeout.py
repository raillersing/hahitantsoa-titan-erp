from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from typing import Any
from uuid import uuid4

from django.db import transaction
from django.utils import timezone

from apps.hahitantsoa.models import (
    HahitantsoaEventCloseout,
    HahitantsoaEventDraft,
    HahitantsoaEventDraftLine,
)


class HahitantsoaCloseoutValidationError(ValueError):
    def __init__(self, message: str, *, code: str) -> None:
        super().__init__(message)
        self.code = code


@dataclass
class HahitantsoaCloseoutSummary:
    event_draft_id: str = ""
    status: str = ""
    confirmed: bool = False
    billing_invoice_count: int = 0
    open_invoice_count: int = 0
    payment_count: int = 0
    unreconciled_external_payment_count: int = 0
    logistics_event_count: int = 0
    incomplete_logistics_event_count: int = 0
    return_count: int = 0
    unresolved_return_count: int = 0
    signature_exception_required: bool = False
    signature_exception_reason: str = ""
    closeout_id: str | None = None
    closeout_status: str = "open"
    closed_at: str | None = None
    replayed: bool = False


def _summary_from_snapshot(
    snapshot: dict[str, Any], *, replayed: bool = False
) -> HahitantsoaCloseoutSummary:
    return HahitantsoaCloseoutSummary(
        event_draft_id=snapshot.get("event_draft_id", ""),
        status=snapshot.get("status", ""),
        confirmed=snapshot.get("confirmed", False),
        billing_invoice_count=snapshot.get("billing_invoice_count", 0),
        open_invoice_count=snapshot.get("open_invoice_count", 0),
        payment_count=snapshot.get("payment_count", 0),
        unreconciled_external_payment_count=snapshot.get("unreconciled_external_payment_count", 0),
        logistics_event_count=snapshot.get("logistics_event_count", 0),
        incomplete_logistics_event_count=snapshot.get("incomplete_logistics_event_count", 0),
        return_count=snapshot.get("return_count", 0),
        unresolved_return_count=snapshot.get("unresolved_return_count", 0),
        signature_exception_required=snapshot.get("signature_exception_required", False),
        signature_exception_reason=snapshot.get("signature_exception_reason", ""),
        closeout_id=snapshot.get("closeout_id"),
        closeout_status=snapshot.get("closeout_status", "closed"),
        closed_at=snapshot.get("closed_at"),
        replayed=replayed,
    )


def get_hahitantsoa_closeout_summary(*, event_draft_id: str) -> HahitantsoaCloseoutSummary | None:
    event_draft = HahitantsoaEventDraft.objects.filter(id=event_draft_id).first()
    if event_draft is None:
        return None

    existing = HahitantsoaEventCloseout.objects.filter(event_draft=event_draft).first()
    if existing is not None:
        return _summary_from_snapshot(existing.summary_snapshot)

    from apps.billing.models import BillingInvoiceStatus
    from apps.inventory.models import (
        InventoryDamageLossSettlementExecutionStatus,
        InventoryReturnOperationStatus,
    )
    from apps.payments.models import PaymentMethod, PaymentStatus

    invoices = list(event_draft.billing_invoices.all())
    payments = list(event_draft.payments.all())
    events = list(event_draft.logistics_events.all())
    returns = list(event_draft.return_operations.all())
    unresolved_returns = 0
    for return_operation in returns:
        settlement = getattr(return_operation, "damage_loss_settlement", None)
        execution = getattr(settlement, "execution", None) if settlement is not None else None
        if return_operation.status != InventoryReturnOperationStatus.VALIDATED or (
            settlement is not None
            and (
                settlement.settlement_status != "validated"
                or execution is None
                or execution.status != InventoryDamageLossSettlementExecutionStatus.EXECUTED
            )
        ):
            unresolved_returns += 1

    external_methods = {
        PaymentMethod.BANK_TRANSFER,
        PaymentMethod.MOBILE_MONEY,
        PaymentMethod.CHEQUE,
    }
    unreconciled_external_payment_count = sum(
        1
        for payment in payments
        if payment.payment_method in external_methods
        and payment.payment_status == PaymentStatus.CONFIRMED
    )
    signature_exception_required = any(
        event.signature_required
        and not event.signature_received
        and event.signature_status != "exception"
        for event in events
    )
    return HahitantsoaCloseoutSummary(
        event_draft_id=str(event_draft.id),
        status=event_draft.status,
        confirmed=event_draft.status == "confirmed" and event_draft.confirmed_at is not None,
        billing_invoice_count=len(invoices),
        open_invoice_count=sum(
            1 for invoice in invoices if invoice.invoice_status == BillingInvoiceStatus.OPEN
        ),
        payment_count=len(payments),
        unreconciled_external_payment_count=unreconciled_external_payment_count,
        logistics_event_count=len(events),
        incomplete_logistics_event_count=sum(
            1 for event in events if event.status not in {"completed", "cancelled"}
        ),
        return_count=len(returns),
        unresolved_return_count=unresolved_returns,
        signature_exception_required=signature_exception_required,
    )


def validate_hahitantsoa_event_closeable(
    *, event_draft: HahitantsoaEventDraft, signature_exception_reason: str = ""
) -> list[str]:
    """Return closeout blockers using only facts directly owned by the event."""
    from apps.billing.models import BillingInvoiceStatus
    from apps.billing.services import compute_hahitantsoa_financial_closeout_summary
    from apps.inventory.models import (
        InventoryCautionRefundObligationStatus,
        InventoryDamageLossExcessReceivableStatus,
        InventoryDamageLossSettlementExecutionStatus,
        InventoryReturnOperationStatus,
    )
    from apps.payments.models import PaymentMethod, PaymentStatus

    blockers: list[str] = []
    if event_draft.is_deleted:
        blockers.append("event_draft_deleted")
    if event_draft.status != "confirmed" or event_draft.confirmed_at is None:
        blockers.append("event_draft_not_confirmed")

    events = list(event_draft.logistics_events.all())
    incomplete_events = [
        event for event in events if event.status not in {"completed", "cancelled"}
    ]
    if incomplete_events:
        blockers.append(f"logistics_events_incomplete:{len(incomplete_events)}")

    returns = list(event_draft.return_operations.all())
    for return_operation in returns:
        if return_operation.status != InventoryReturnOperationStatus.VALIDATED:
            blockers.append(f"return_operation_not_validated:{return_operation.id}")
            continue
        settlement = getattr(return_operation, "damage_loss_settlement", None)
        if settlement is None:
            continue
        if settlement.settlement_status != "validated":
            blockers.append(f"return_settlement_not_validated:{return_operation.id}")
            continue
        execution = getattr(settlement, "execution", None)
        if execution is None:
            blockers.append(f"return_settlement_execution_missing:{return_operation.id}")
            continue
        if execution.status != InventoryDamageLossSettlementExecutionStatus.EXECUTED:
            blockers.append(f"return_settlement_execution_not_executed:{return_operation.id}")
            continue
        refund_obligation = getattr(execution, "refund_obligation", None)
        if refund_obligation is not None and refund_obligation.status not in {
            InventoryCautionRefundObligationStatus.SETTLED,
            InventoryCautionRefundObligationStatus.CANCELLED,
        }:
            blockers.append(f"caution_refund_obligation_unresolved:{return_operation.id}")
        excess_receivable = getattr(execution, "excess_receivable", None)
        if excess_receivable is None:
            continue
        if excess_receivable.status == InventoryDamageLossExcessReceivableStatus.PENDING_INVOICE:
            blockers.append(f"damage_loss_excess_receivable_not_invoiced:{return_operation.id}")
        elif excess_receivable.status != InventoryDamageLossExcessReceivableStatus.CANCELLED:
            invoice = getattr(excess_receivable, "billing_invoice", None)
            if invoice is None or invoice.invoice_status != BillingInvoiceStatus.SETTLED:
                blockers.append(f"damage_loss_excess_receivable_not_settled:{return_operation.id}")

    if event_draft.lines.filter(is_deleted=False).exists():
        if not any(event.operation == "outbound" for event in events):
            blockers.append("logistics_outbound_operation_missing")
        if not returns:
            blockers.append("return_operation_missing")

    missing_signature = any(
        event.signature_required
        and not event.signature_received
        and event.signature_status != "exception"
        for event in events
    )
    if missing_signature and not signature_exception_reason.strip():
        blockers.append("handover_signature_or_exception_required")

    external_methods = {
        PaymentMethod.BANK_TRANSFER,
        PaymentMethod.MOBILE_MONEY,
        PaymentMethod.CHEQUE,
    }
    unreconciled = event_draft.payments.filter(
        payment_method__in=external_methods,
        payment_status=PaymentStatus.CONFIRMED,
    )
    if unreconciled.exists():
        blockers.append(f"external_payments_unreconciled:{unreconciled.count()}")

    if event_draft.billing_invoices.filter(invoice_status=BillingInvoiceStatus.OPEN).exists():
        blockers.append("billing_invoices_open")

    financial = compute_hahitantsoa_financial_closeout_summary(event_draft)
    if financial.coherence_status != "coherent":
        blockers.append(f"financial_closeout_incoherent:{financial.coherence_detail}")
    return blockers


@transaction.atomic
def closeout_hahitantsoa_event_draft(
    *,
    event_draft: HahitantsoaEventDraft,
    actor: object | None,
    idempotency_key: str = "",
    signature_exception_reason: str = "",
) -> HahitantsoaCloseoutSummary:
    """Validate and persist one immutable Hahitantsoa closeout proof."""
    from apps.audit.services import record_audit_event_on_commit
    from apps.billing.models import BillingInvoice
    from apps.inventory.models import (
        InventoryCautionRefundObligation,
        InventoryDamageLossExcessReceivable,
        InventoryDamageLossSettlement,
        InventoryDamageLossSettlementExecution,
        InventoryReturnOperation,
    )
    from apps.logistics.models import LogisticsEvent
    from apps.payments.models import Payment
    from apps.reservations.attribution import capture_reservation_sensitive_actor_attribution

    if len(idempotency_key) > 128:
        raise HahitantsoaCloseoutValidationError(
            "Closeout idempotency key must be at most 128 characters.",
            code="closeout_idempotency_key_too_long",
        )
    attribution = capture_reservation_sensitive_actor_attribution(actor=actor)
    locked_event = HahitantsoaEventDraft.objects.select_for_update().get(pk=event_draft.pk)
    existing = HahitantsoaEventCloseout.objects.filter(event_draft=locked_event).first()
    if existing is not None:
        if (
            idempotency_key
            and existing.idempotency_key
            and idempotency_key != existing.idempotency_key
        ):
            raise HahitantsoaCloseoutValidationError(
                "Closeout already exists with a different idempotency key.",
                code="closeout_idempotency_key_mismatch",
            )
        return _summary_from_snapshot(existing.summary_snapshot, replayed=True)

    # ponytail: lock only facts that can alter the eligibility decision.
    HahitantsoaEventDraftLine.objects.select_for_update().filter(
        event_draft=locked_event,
        is_deleted=False,
    ).exists()
    LogisticsEvent.objects.select_for_update().filter(hahitantsoa_event_draft=locked_event).exists()
    InventoryReturnOperation.objects.select_for_update().filter(
        hahitantsoa_event_draft=locked_event
    ).exists()
    InventoryDamageLossSettlement.objects.select_for_update().filter(
        return_operation__hahitantsoa_event_draft=locked_event
    ).exists()
    InventoryDamageLossSettlementExecution.objects.select_for_update().filter(
        settlement__return_operation__hahitantsoa_event_draft=locked_event
    ).exists()
    InventoryCautionRefundObligation.objects.select_for_update().filter(
        settlement_execution__settlement__return_operation__hahitantsoa_event_draft=locked_event
    ).exists()
    InventoryDamageLossExcessReceivable.objects.select_for_update().filter(
        settlement_execution__settlement__return_operation__hahitantsoa_event_draft=locked_event
    ).exists()
    BillingInvoice.objects.select_for_update().filter(hahitantsoa_event_draft=locked_event).exists()
    Payment.objects.select_for_update().filter(hahitantsoa_event_draft=locked_event).exists()

    normalized_signature_exception = signature_exception_reason.strip()
    blockers = validate_hahitantsoa_event_closeable(
        event_draft=locked_event,
        signature_exception_reason=normalized_signature_exception,
    )
    if blockers:
        raise HahitantsoaCloseoutValidationError(
            "Hahitantsoa event draft is not ready for closeout: " + ", ".join(blockers),
            code="hahitantsoa_event_not_closeable",
        )

    summary = get_hahitantsoa_closeout_summary(event_draft_id=str(locked_event.id))
    if summary is None:
        raise HahitantsoaCloseoutValidationError(
            "Unable to compute Hahitantsoa closeout summary.",
            code="closeout_summary_unavailable",
        )
    closeout_id = uuid4()
    closed_at = timezone.now()
    summary.closeout_id = str(closeout_id)
    summary.closeout_status = HahitantsoaEventCloseout.Status.CLOSED
    summary.closed_at = closed_at.isoformat()
    summary.signature_exception_reason = normalized_signature_exception
    snapshot = json.loads(json.dumps(asdict(summary), default=str))
    HahitantsoaEventCloseout.objects.create(
        id=closeout_id,
        event_draft=locked_event,
        closed_at=closed_at,
        closed_by_id=attribution.actor_id,
        idempotency_key=idempotency_key,
        signature_exception_reason=normalized_signature_exception,
        summary_snapshot=snapshot,
    )
    record_audit_event_on_commit(
        actor=actor,
        action="hahitantsoa.event_draft.closeout_executed",
        target_type="hahitantsoa_event_draft",
        target_id=str(locked_event.id),
        metadata={
            "public_reference": locked_event.public_reference,
            "closeout_id": str(closeout_id),
            "signature_exception_used": bool(normalized_signature_exception),
        },
    )
    return summary
