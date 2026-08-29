from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from decimal import Decimal
from typing import Any
from uuid import uuid4

from django.db import transaction
from django.utils import timezone

from apps.billing.services import ReservationFinancialCloseoutSummary
from apps.reservations.models import ReservationCloseout, ReservationDraft


class CloseoutValidationError(ValueError):
    def __init__(self, message: str, *, code: str) -> None:
        super().__init__(message)
        self.code = code


@dataclass
class BillingCloseoutSummary:
    invoice_count: int = 0
    total_amount: Decimal = Decimal("0.00")
    open_amount: Decimal = Decimal("0.00")
    settled_amount: Decimal = Decimal("0.00")


@dataclass
class PaymentCloseoutSummary:
    payment_count: int = 0
    total_received: Decimal = Decimal("0.00")


@dataclass
class LogisticsCloseoutSummary:
    event_count: int = 0
    planned_count: int = 0
    dispatched_count: int = 0
    completed_count: int = 0
    cancelled_count: int = 0
    delivery_count: int = 0
    pickup_count: int = 0
    preparation_count: int = 0
    handover_count: int = 0


@dataclass
class ReturnCloseoutSummary:
    return_count: int = 0
    settlement_count: int = 0
    settlement_draft_count: int = 0
    settlement_validated_count: int = 0
    total_damage_loss: Decimal = Decimal("0.00")
    total_excess_due: Decimal = Decimal("0.00")
    total_refund_due: Decimal = Decimal("0.00")


@dataclass
class CloseoutSummary:
    reservation_draft_id: str = ""
    status: str = ""
    contract_signed: bool = False
    deposit_received: bool = False
    confirmed: bool = False
    cancelled: bool = False
    billing: BillingCloseoutSummary = field(default_factory=BillingCloseoutSummary)
    payments: PaymentCloseoutSummary = field(default_factory=PaymentCloseoutSummary)
    logistics: LogisticsCloseoutSummary = field(default_factory=LogisticsCloseoutSummary)
    returns: ReturnCloseoutSummary = field(default_factory=ReturnCloseoutSummary)
    financial: ReservationFinancialCloseoutSummary | None = None
    closeout_id: str | None = None
    closeout_status: str = "open"
    closed_at: str | None = None
    replayed: bool = False


def _decimal(value: Any) -> Decimal:
    return Decimal(str(value))


def _summary_from_snapshot(snapshot: dict[str, Any], *, replayed: bool = False) -> CloseoutSummary:
    billing = snapshot.get("billing", {})
    payments = snapshot.get("payments", {})
    logistics = snapshot.get("logistics", {})
    returns = snapshot.get("returns", {})
    financial = snapshot.get("financial")
    return CloseoutSummary(
        reservation_draft_id=snapshot.get("reservation_draft_id", ""),
        status=snapshot.get("status", ""),
        contract_signed=snapshot.get("contract_signed", False),
        deposit_received=snapshot.get("deposit_received", False),
        confirmed=snapshot.get("confirmed", False),
        cancelled=snapshot.get("cancelled", False),
        billing=BillingCloseoutSummary(
            invoice_count=billing.get("invoice_count", 0),
            total_amount=_decimal(billing.get("total_amount", "0.00")),
            open_amount=_decimal(billing.get("open_amount", "0.00")),
            settled_amount=_decimal(billing.get("settled_amount", "0.00")),
        ),
        payments=PaymentCloseoutSummary(
            payment_count=payments.get("payment_count", 0),
            total_received=_decimal(payments.get("total_received", "0.00")),
        ),
        logistics=LogisticsCloseoutSummary(**logistics),
        returns=ReturnCloseoutSummary(
            return_count=returns.get("return_count", 0),
            settlement_count=returns.get("settlement_count", 0),
            settlement_draft_count=returns.get("settlement_draft_count", 0),
            settlement_validated_count=returns.get("settlement_validated_count", 0),
            total_damage_loss=_decimal(returns.get("total_damage_loss", "0.00")),
            total_excess_due=_decimal(returns.get("total_excess_due", "0.00")),
            total_refund_due=_decimal(returns.get("total_refund_due", "0.00")),
        ),
        financial=(
            ReservationFinancialCloseoutSummary(
                total_invoiced=_decimal(financial.get("total_invoiced", "0.00")),
                total_paid=_decimal(financial.get("total_paid", "0.00")),
                total_settled=_decimal(financial.get("total_settled", "0.00")),
                total_refunded=_decimal(financial.get("total_refunded", "0.00")),
                total_cashbox_in=_decimal(financial.get("total_cashbox_in", "0.00")),
                total_cashbox_out=_decimal(financial.get("total_cashbox_out", "0.00")),
                net_balance=_decimal(financial.get("net_balance", "0.00")),
                coherence_status=financial.get("coherence_status", "incoherent"),
                coherence_detail=financial.get("coherence_detail", "snapshot incomplete"),
            )
            if financial is not None
            else None
        ),
        closeout_id=snapshot.get("closeout_id"),
        closeout_status=snapshot.get("closeout_status", "closed"),
        closed_at=snapshot.get("closed_at"),
        replayed=replayed,
    )


def get_closeout_summary(*, reservation_draft_id: str) -> CloseoutSummary | None:
    draft = (
        ReservationDraft.objects.filter(id=reservation_draft_id)
        .prefetch_related(
            "billing_invoices",
            "payments",
            "logistics_events",
            "return_operations__damage_loss_settlement",
        )
        .first()
    )
    if draft is None:
        return None

    existing_closeout = ReservationCloseout.objects.filter(reservation_draft=draft).first()
    if existing_closeout is not None:
        return _summary_from_snapshot(existing_closeout.summary_snapshot)

    summary = CloseoutSummary(
        reservation_draft_id=str(draft.id),
        status=draft.status,
        contract_signed=draft.contract_signed_at is not None,
        deposit_received=draft.required_deposit_received_at is not None,
        confirmed=draft.confirmed_at is not None,
        cancelled=draft.cancelled_at is not None,
    )

    # Billing
    invoices = list(draft.billing_invoices.all())
    billing = BillingCloseoutSummary(
        invoice_count=len(invoices),
        total_amount=sum((inv.amount for inv in invoices), Decimal("0.00")),
        open_amount=sum(
            (inv.amount for inv in invoices if inv.invoice_status == "open"),
            Decimal("0.00"),
        ),
        settled_amount=sum(
            (inv.amount for inv in invoices if inv.invoice_status == "settled"),
            Decimal("0.00"),
        ),
    )
    summary.billing = billing

    # Payments
    payment_list = list(draft.payments.all())
    summary.payments = PaymentCloseoutSummary(
        payment_count=len(payment_list),
        total_received=sum(
            (p.amount for p in payment_list if p.paid_at is not None),
            Decimal("0.00"),
        ),
    )

    # Logistics
    events = list(draft.logistics_events.all())
    summary.logistics = LogisticsCloseoutSummary(
        event_count=len(events),
        planned_count=sum(1 for e in events if e.status == "planned"),
        dispatched_count=sum(1 for e in events if e.status == "dispatched"),
        completed_count=sum(1 for e in events if e.status == "completed"),
        cancelled_count=sum(1 for e in events if e.status == "cancelled"),
        delivery_count=sum(1 for e in events if e.event_type == "delivery"),
        pickup_count=sum(1 for e in events if e.event_type == "pickup"),
        preparation_count=sum(1 for e in events if e.event_type == "preparation"),
        handover_count=sum(1 for e in events if e.event_type == "handover"),
    )

    # Returns and damage/loss
    return_ops = list(draft.return_operations.all())
    settlements = [
        op.damage_loss_settlement for op in return_ops if hasattr(op, "damage_loss_settlement")
    ]
    summary.returns = ReturnCloseoutSummary(
        return_count=len(return_ops),
        settlement_count=len(settlements),
        settlement_draft_count=sum(1 for s in settlements if s.settlement_status == "draft"),
        settlement_validated_count=sum(
            1 for s in settlements if s.settlement_status == "validated"
        ),
        total_damage_loss=sum(
            (s.damage_loss_total for s in settlements),
            Decimal("0.00"),
        ),
        total_excess_due=sum(
            (s.excess_due for s in settlements),
            Decimal("0.00"),
        ),
        total_refund_due=sum(
            (s.refund_due for s in settlements),
            Decimal("0.00"),
        ),
    )

    from apps.billing.services import compute_reservation_financial_closeout_summary

    summary.financial = compute_reservation_financial_closeout_summary(draft)

    return summary


def validate_reservation_closeable(*, reservation_draft: ReservationDraft) -> list[str]:
    """Return a list of blocker messages if the reservation is not ready for closeout.

    A reservation is considered closeable when:
    - It is confirmed (not draft or cancelled)
    - All logistics events are completed or cancelled
    - All billing invoices are settled or cancelled
    - All return operations have validated and executed settlements
    - Damage/loss refund and excess-receivable obligations are resolved
    - External payment confirmations have been reconciled
    """
    blockers: list[str] = []

    if not reservation_draft.confirmed_at:
        blockers.append("reservation_not_confirmed")

    # Logistics events
    events = list(reservation_draft.logistics_events.all())
    incomplete_events = [e for e in events if e.status not in {"completed", "cancelled"}]
    if incomplete_events:
        blockers.append(f"logistics_events_incomplete:{len(incomplete_events)}")

    # Billing invoices
    invoices = list(reservation_draft.billing_invoices.all())
    open_invoices = [inv for inv in invoices if inv.invoice_status == "open"]
    if open_invoices:
        blockers.append(f"billing_invoices_open:{len(open_invoices)}")

    # Returns
    return_ops = list(reservation_draft.return_operations.all())
    from apps.billing.models import BillingInvoiceStatus
    from apps.inventory.models import (
        InventoryCautionRefundObligationStatus,
        InventoryDamageLossExcessReceivableStatus,
        InventoryDamageLossSettlementExecutionStatus,
    )
    from apps.payments.models import PaymentMethod, PaymentStatus

    for op in return_ops:
        if op.status != "validated":
            blockers.append(f"return_operation_not_validated:{op.id}")
        settlement = getattr(op, "damage_loss_settlement", None)
        if settlement is not None and settlement.settlement_status != "validated":
            blockers.append(f"return_settlement_not_validated:{op.id}")
            continue
        if settlement is None:
            continue

        execution = getattr(settlement, "execution", None)
        if execution is None:
            blockers.append(f"return_settlement_execution_missing:{op.id}")
            continue
        if execution.status != InventoryDamageLossSettlementExecutionStatus.EXECUTED:
            blockers.append(f"return_settlement_execution_not_executed:{op.id}")
            continue

        refund_obligation = getattr(execution, "refund_obligation", None)
        if refund_obligation is not None and refund_obligation.status not in {
            InventoryCautionRefundObligationStatus.SETTLED,
            InventoryCautionRefundObligationStatus.CANCELLED,
        }:
            blockers.append(f"caution_refund_obligation_unresolved:{op.id}")

        excess_receivable = getattr(execution, "excess_receivable", None)
        if excess_receivable is None:
            continue
        if excess_receivable.status == InventoryDamageLossExcessReceivableStatus.PENDING_INVOICE:
            blockers.append(f"damage_loss_excess_receivable_not_invoiced:{op.id}")
            continue
        if excess_receivable.status == InventoryDamageLossExcessReceivableStatus.CANCELLED:
            continue

        invoice = getattr(excess_receivable, "billing_invoice", None)
        if invoice is None or invoice.invoice_status != BillingInvoiceStatus.SETTLED:
            blockers.append(f"damage_loss_excess_receivable_not_settled:{op.id}")

    external_payment_methods = {
        PaymentMethod.BANK_TRANSFER,
        PaymentMethod.MOBILE_MONEY,
        PaymentMethod.CHEQUE,
    }
    unreconciled_external_payments = reservation_draft.payments.filter(
        payment_method__in=external_payment_methods,
        payment_status=PaymentStatus.CONFIRMED,
    )
    if unreconciled_external_payments.exists():
        blockers.append(f"external_payments_unreconciled:{unreconciled_external_payments.count()}")

    if reservation_draft.lines.filter(is_deleted=False).exists():
        outbound_events = [e for e in events if e.operation == "outbound"]
        if not outbound_events:
            blockers.append("logistics_outbound_operation_missing")
        if not return_ops:
            blockers.append("return_operation_missing")

    from apps.billing.services import (
        RESERVATION_FINANCIAL_CLOSEOUT_COHERENT,
        compute_reservation_financial_closeout_summary,
    )

    financial = compute_reservation_financial_closeout_summary(reservation_draft)
    if financial.coherence_status != RESERVATION_FINANCIAL_CLOSEOUT_COHERENT:
        blockers.append(f"financial_closeout_incoherent:{financial.coherence_detail}")

    return blockers


@transaction.atomic
def closeout_reservation_draft(
    *,
    reservation_draft: ReservationDraft,
    actor: object | None = None,
    idempotency_key: str = "",
) -> CloseoutSummary:
    """Validate and record closeout for a reservation draft.

    Raises CloseoutValidationError if prerequisites are not met.
    """
    from apps.audit.services import record_audit_event_on_commit

    if len(idempotency_key) > 128:
        raise CloseoutValidationError(
            "Closeout idempotency key must be at most 128 characters.",
            code="closeout_idempotency_key_too_long",
        )

    locked_draft = ReservationDraft.objects.select_for_update().get(pk=reservation_draft.pk)
    existing_closeout = ReservationCloseout.objects.filter(
        reservation_draft=locked_draft,
    ).first()
    if existing_closeout is not None:
        if (
            idempotency_key
            and existing_closeout.idempotency_key
            and idempotency_key != existing_closeout.idempotency_key
        ):
            raise CloseoutValidationError(
                "Closeout already exists with a different idempotency key.",
                code="closeout_idempotency_key_mismatch",
            )
        return _summary_from_snapshot(existing_closeout.summary_snapshot, replayed=True)

    # ponytail: lock only the dependent rows that can change closeout eligibility.
    from apps.billing.models import BillingInvoice
    from apps.inventory.models import (
        InventoryCautionRefundObligation,
        InventoryDamageLossExcessReceivable,
        InventoryDamageLossSettlement,
        InventoryDamageLossSettlementExecution,
    )
    from apps.payments.models import Payment

    InventoryDamageLossSettlement.objects.select_for_update().filter(
        return_operation__reservation_draft=locked_draft
    ).exists()
    InventoryDamageLossSettlementExecution.objects.select_for_update().filter(
        settlement__return_operation__reservation_draft=locked_draft
    ).exists()
    InventoryCautionRefundObligation.objects.select_for_update().filter(
        settlement_execution__settlement__return_operation__reservation_draft=locked_draft
    ).exists()
    InventoryDamageLossExcessReceivable.objects.select_for_update().filter(
        settlement_execution__settlement__return_operation__reservation_draft=locked_draft
    ).exists()
    BillingInvoice.objects.select_for_update().filter(reservation_draft=locked_draft).exists()
    Payment.objects.select_for_update().filter(reservation_draft=locked_draft).exists()

    blockers = validate_reservation_closeable(reservation_draft=locked_draft)
    if blockers:
        raise CloseoutValidationError(
            "Reservation draft is not ready for closeout: " + ", ".join(blockers),
            code="reservation_not_closeable",
        )

    summary = get_closeout_summary(reservation_draft_id=str(locked_draft.id))
    if summary is None:
        raise CloseoutValidationError(
            "Unable to compute closeout summary.",
            code="closeout_summary_unavailable",
        )

    closeout_id = uuid4()
    closed_at = timezone.now()
    summary.closeout_id = str(closeout_id)
    summary.closeout_status = ReservationCloseout.Status.CLOSED
    summary.closed_at = closed_at.isoformat()
    summary_snapshot = json.loads(json.dumps(asdict(summary), default=str))
    ReservationCloseout.objects.create(
        id=closeout_id,
        reservation_draft=locked_draft,
        closed_at=closed_at,
        closed_by_id=getattr(actor, "pk", None),
        idempotency_key=idempotency_key[:128],
        summary_snapshot=summary_snapshot,
    )

    record_audit_event_on_commit(
        actor=actor,
        action="reservation.closeout_executed",
        target_type="reservation_draft",
        target_id=str(reservation_draft.id),
        metadata={
            "public_reference": locked_draft.public_reference,
            "billing_total": str(summary.billing.total_amount),
            "payments_total": str(summary.payments.total_received),
            "logistics_completed": summary.logistics.completed_count,
            "returns_settled": summary.returns.settlement_validated_count,
        },
    )

    return summary
