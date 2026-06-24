from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal

from apps.reservations.models import ReservationDraft


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

    return summary


def validate_reservation_closeable(*, reservation_draft: ReservationDraft) -> list[str]:
    """Return a list of blocker messages if the reservation is not ready for closeout.

    A reservation is considered closeable when:
    - It is confirmed (not draft or cancelled)
    - All logistics events are completed or cancelled
    - All billing invoices are settled or cancelled
    - All return operations have validated settlements
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
    for op in return_ops:
        settlement = getattr(op, "damage_loss_settlement", None)
        if settlement is not None and settlement.settlement_status != "validated":
            blockers.append(f"return_settlement_not_validated:{op.id}")

    return blockers


def closeout_reservation_draft(
    *,
    reservation_draft: ReservationDraft,
    actor: object | None = None,
) -> CloseoutSummary:
    """Validate and record closeout for a reservation draft.

    Raises CloseoutValidationError if prerequisites are not met.
    """
    from apps.audit.services import record_audit_event_on_commit

    blockers = validate_reservation_closeable(reservation_draft=reservation_draft)
    if blockers:
        raise CloseoutValidationError(
            "Reservation draft is not ready for closeout: " + ", ".join(blockers),
            code="reservation_not_closeable",
        )

    summary = get_closeout_summary(reservation_draft_id=str(reservation_draft.id))
    if summary is None:
        raise CloseoutValidationError(
            "Unable to compute closeout summary.",
            code="closeout_summary_unavailable",
        )

    record_audit_event_on_commit(
        actor=actor,
        action="reservation.closeout_executed",
        target_type="reservation_draft",
        target_id=str(reservation_draft.id),
        metadata={
            "public_reference": reservation_draft.public_reference,
            "billing_total": str(summary.billing.total_amount),
            "payments_total": str(summary.payments.total_received),
            "logistics_completed": summary.logistics.completed_count,
            "returns_settled": summary.returns.settlement_validated_count,
        },
    )

    return summary
