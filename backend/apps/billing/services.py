from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from apps.audit.services import record_audit_event_on_commit
from apps.inventory.models import (
    InventoryDamageLossExcessReceivable,
    InventoryDamageLossExcessReceivableStatus,
)
from apps.inventory.services import generate_excess_receivable_invoice_document
from apps.payments.models import CONFIRMED_PAYMENT_STATUS_VALUES, Payment
from apps.payments.services import confirm_refund_payment

from .models import (
    BillingInstallmentAllocation,
    BillingInstallmentStatus,
    BillingInvoice,
    BillingInvoiceInstallment,
    BillingInvoiceSettlement,
    BillingInvoiceSourceKind,
    BillingInvoiceStatus,
    BillingRefundObligation,
    BillingRefundObligationStatus,
)

INVALID_BILLING_INVOICE_SOURCE_STATE = "invalid_billing_invoice_source_state"
INVALID_BILLING_INVOICE_STATUS = "invalid_billing_invoice_status"
INVALID_BILLING_SETTLEMENT_PAYMENT = "invalid_billing_settlement_payment"
INVALID_BILLING_INVOICE_CANCEL_STATE = "invalid_billing_invoice_cancel_state"
BILLING_INVOICE_ALREADY_EXISTS = "billing_invoice_already_exists"
BILLING_SETTLEMENT_PAYMENT_ALREADY_USED = "billing_settlement_payment_already_used"
BILLING_INSTALLMENT_TOTAL_MISMATCH = "billing_installment_total_mismatch"
BILLING_INSTALLMENT_SCHEDULE_EXISTS = "billing_installment_schedule_exists"
BILLING_INVOICE_HAS_INSTALLMENTS = "billing_invoice_has_installments"
BILLING_INVOICE_SETTLEMENT_EXISTS = "billing_invoice_settlement_exists"
BILLING_INSTALLMENT_ALREADY_PAID = "billing_installment_already_paid"
BILLING_INSTALLMENT_PAYMENT_ALREADY_USED = "billing_installment_payment_already_used"
INVALID_BILLING_INSTALLMENT_ALLOCATION = "invalid_billing_installment_allocation"
INVALID_BILLING_INSTALLMENT_ITEM = "invalid_billing_installment_item"
BILLING_INVOICE_HAS_INSTALLMENT_PAYMENTS = "billing_invoice_has_installment_payments"
BILLING_INVOICE_ALREADY_CORRECTED = "billing_invoice_already_corrected"
BILLING_INVOICE_CORRECTION_NOT_APPLICABLE = "billing_invoice_correction_not_applicable"


class BillingLifecycleError(ValueError):
    def __init__(self, message: str, *, code: str) -> None:
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class BillingInvoiceSettlementResult:
    invoice: BillingInvoice
    settlement: BillingInvoiceSettlement


@dataclass(frozen=True)
class BillingInstallmentItem:
    amount: Decimal
    due_at: object


@dataclass(frozen=True)
class BillingInstallmentAllocationResult:
    installment: BillingInvoiceInstallment
    allocation: BillingInstallmentAllocation


@dataclass(frozen=True)
class BillingInstallmentDueDatePresets:
    j30: object
    j10: object


@dataclass(frozen=True)
class BillingRefundExecutionResult:
    obligation: BillingRefundObligation
    payment: Payment


@dataclass(frozen=True)
class BillingInvoiceCloseoutSummary:
    closeout_status: str
    amount_settled: Decimal
    amount_refunded: Decimal
    remaining_balance: Decimal


BILLING_INSTALLMENT_LIFECYCLE_OPEN = "open"
BILLING_INSTALLMENT_LIFECYCLE_PARTIALLY_PAID = "partially_paid"
BILLING_INSTALLMENT_LIFECYCLE_PAID = "paid"
BILLING_INSTALLMENT_LIFECYCLE_OVERDUE = "overdue"

BILLING_CLOSEOUT_STATUS_OUTSTANDING = "outstanding"
BILLING_CLOSEOUT_STATUS_PARTIALLY_COLLECTED = "partially_collected"
BILLING_CLOSEOUT_STATUS_SETTLED = "settled"
BILLING_CLOSEOUT_STATUS_REFUND_PENDING = "refund_pending"
BILLING_CLOSEOUT_STATUS_REFUNDED = "refunded"
BILLING_CLOSEOUT_STATUS_CANCELLED = "cancelled"


def billing_installment_due_date_presets(*, start_at):
    if start_at is None:
        return None
    return BillingInstallmentDueDatePresets(
        j30=start_at - timedelta(days=30),
        j10=start_at - timedelta(days=10),
    )


def installment_is_overdue(installment, *, now=None):
    if installment.status == BillingInstallmentStatus.PAID:
        return False
    now = now or timezone.now()
    return installment.due_at is not None and installment.due_at < now


def compute_billing_invoice_installment_lifecycle(invoice, *, now=None):
    if invoice.invoice_status == BillingInvoiceStatus.CANCELLED:
        return None
    installments = list(invoice.installments.all())
    if not installments:
        return None
    now = now or timezone.now()
    if all(i.status == BillingInstallmentStatus.PAID for i in installments):
        return BILLING_INSTALLMENT_LIFECYCLE_PAID
    if any(installment_is_overdue(i, now=now) for i in installments):
        return BILLING_INSTALLMENT_LIFECYCLE_OVERDUE
    if any(i.paid_amount > 0 for i in installments):
        return BILLING_INSTALLMENT_LIFECYCLE_PARTIALLY_PAID
    return BILLING_INSTALLMENT_LIFECYCLE_OPEN


def _billing_invoice_settlement_or_none(invoice):
    try:
        return invoice.settlement
    except BillingInvoiceSettlement.DoesNotExist:
        return None


def _billing_invoice_refund_obligation_or_none(invoice):
    try:
        return invoice.refund_obligation
    except BillingRefundObligation.DoesNotExist:
        return None


def _billing_invoice_refund_payment_or_none(obligation):
    payments = list(obligation.refund_payments.all()[:1])
    return payments[0] if payments else None


def compute_billing_invoice_closeout_summary(invoice) -> BillingInvoiceCloseoutSummary:
    cached = getattr(invoice, "_billing_closeout_summary_cache", None)
    if cached is not None:
        return cached

    settlement = _billing_invoice_settlement_or_none(invoice)
    if settlement is not None:
        amount_settled = settlement.amount
    else:
        amount_settled = sum(
            (installment.paid_amount for installment in invoice.installments.all()),
            Decimal("0.00"),
        )

    obligation = _billing_invoice_refund_obligation_or_none(invoice)
    amount_refunded = Decimal("0.00")
    closeout_status = BILLING_CLOSEOUT_STATUS_OUTSTANDING
    if obligation is not None:
        if obligation.status == BillingRefundObligationStatus.EXECUTED:
            payment = _billing_invoice_refund_payment_or_none(obligation)
            if payment is not None:
                amount_refunded = payment.amount
            closeout_status = BILLING_CLOSEOUT_STATUS_REFUNDED
        else:
            closeout_status = BILLING_CLOSEOUT_STATUS_REFUND_PENDING
    elif invoice.invoice_status == BillingInvoiceStatus.SETTLED:
        closeout_status = BILLING_CLOSEOUT_STATUS_SETTLED
    elif invoice.invoice_status == BillingInvoiceStatus.CANCELLED:
        closeout_status = BILLING_CLOSEOUT_STATUS_CANCELLED
    elif amount_settled > Decimal("0.00"):
        closeout_status = BILLING_CLOSEOUT_STATUS_PARTIALLY_COLLECTED

    if invoice.invoice_status == BillingInvoiceStatus.OPEN:
        remaining_balance = invoice.amount - amount_settled
        if remaining_balance < Decimal("0.00"):
            remaining_balance = Decimal("0.00")
    else:
        remaining_balance = Decimal("0.00")

    summary = BillingInvoiceCloseoutSummary(
        closeout_status=closeout_status,
        amount_settled=amount_settled,
        amount_refunded=amount_refunded,
        remaining_balance=remaining_balance,
    )
    setattr(invoice, "_billing_closeout_summary_cache", summary)
    return summary


def compute_billing_invoice_amount_settled(invoice) -> Decimal:
    return compute_billing_invoice_closeout_summary(invoice).amount_settled


def compute_billing_invoice_amount_refunded(invoice) -> Decimal:
    return compute_billing_invoice_closeout_summary(invoice).amount_refunded


def compute_billing_invoice_remaining_balance(invoice) -> Decimal:
    return compute_billing_invoice_closeout_summary(invoice).remaining_balance


def compute_billing_invoice_closeout_status(invoice) -> str:
    return compute_billing_invoice_closeout_summary(invoice).closeout_status


def active_billing_invoices():
    return (
        BillingInvoice.objects.select_related(
            "excess_receivable",
            "excess_receivable__settlement_execution",
            "excess_receivable__settlement_execution__settlement",
            "excess_receivable__settlement_execution__settlement__return_operation",
            "excess_receivable__settlement_execution__settlement__return_operation__reservation_draft",
            "document_instance",
            "reservation_draft",
            "reservation_draft__customer",
            "settled_by",
            "settlement",
            "settlement__payment",
            "settlement__payment__receipt_document",
            "settlement__settled_by",
            "refund_obligation",
            "refund_obligation__document_instance",
            "refund_obligation__executed_by",
        )
        .prefetch_related(
            "installments",
            "installments__allocations",
            "refund_obligation__refund_payments",
            "refund_obligation__refund_payments__receipt_document",
        )
        .order_by("-issued_at", "-created_at", "id")
    )


@transaction.atomic
def issue_billing_invoice_for_excess_receivable(
    *,
    excess_receivable: InventoryDamageLossExcessReceivable,
    actor: object | None = None,
    notes: str = "",
) -> BillingInvoice:
    locked_receivable = InventoryDamageLossExcessReceivable.objects.select_for_update().get(
        pk=excess_receivable.pk
    )
    locked_receivable = InventoryDamageLossExcessReceivable.objects.select_related(
        "settlement_execution",
        "settlement_execution__settlement",
        "settlement_execution__settlement__return_operation",
        "settlement_execution__settlement__return_operation__reservation_draft",
    ).get(pk=locked_receivable.pk)

    if hasattr(locked_receivable, "billing_invoice"):
        raise BillingLifecycleError(
            "A billing invoice already exists for this excess receivable.",
            code=BILLING_INVOICE_ALREADY_EXISTS,
        )

    if locked_receivable.status != InventoryDamageLossExcessReceivableStatus.PENDING_INVOICE:
        raise BillingLifecycleError(
            "Excess receivable must be pending invoice before billing issuance.",
            code=INVALID_BILLING_INVOICE_SOURCE_STATE,
        )

    document_instance = generate_excess_receivable_invoice_document(
        excess_receivable=locked_receivable,
        actor=actor,
        notes=notes,
    )
    reservation_draft = (
        locked_receivable.settlement_execution.settlement.return_operation.reservation_draft
    )
    actor_id = getattr(actor, "pk", None)
    invoice = BillingInvoice.objects.create(
        excess_receivable=locked_receivable,
        document_instance=document_instance,
        reservation_draft=reservation_draft,
        source_kind=BillingInvoiceSourceKind.INVENTORY_DAMAGE_LOSS_EXCESS_RECEIVABLE,
        invoice_status=BillingInvoiceStatus.OPEN,
        amount=locked_receivable.amount,
        issued_at=timezone.now(),
        notes=notes,
        created_by_id=actor_id,
        updated_by_id=actor_id,
    )

    record_audit_event_on_commit(
        actor=actor,
        action="billing.invoice_issued",
        target_type="billing_invoice",
        target_id=str(invoice.id),
        metadata={
            "excess_receivable_id": str(locked_receivable.id),
            "document_instance_id": str(document_instance.id),
            "amount": str(invoice.amount),
            "source_kind": invoice.source_kind,
        },
    )
    return invoice


@transaction.atomic
def settle_billing_invoice(
    *,
    invoice: BillingInvoice,
    payment: Payment,
    actor: object | None = None,
    notes: str = "",
) -> BillingInvoiceSettlementResult:
    locked_invoice = BillingInvoice.objects.select_for_update().get(pk=invoice.pk)
    locked_invoice = BillingInvoice.objects.select_related("settlement", "reservation_draft").get(
        pk=locked_invoice.pk
    )
    locked_payment = Payment.objects.select_for_update().get(pk=payment.pk)
    locked_payment = Payment.objects.select_related("reservation_draft").get(pk=locked_payment.pk)

    if locked_invoice.invoice_status != BillingInvoiceStatus.OPEN:
        raise BillingLifecycleError(
            "Billing invoice must be open before settlement.",
            code=INVALID_BILLING_INVOICE_STATUS,
        )

    if hasattr(locked_invoice, "settlement"):
        raise BillingLifecycleError(
            "Billing invoice is already settled.",
            code=INVALID_BILLING_INVOICE_STATUS,
        )

    if locked_invoice.installments.exists():
        raise BillingLifecycleError(
            "Billing invoices with an installment schedule cannot be settled via a single payment.",
            code=BILLING_INVOICE_HAS_INSTALLMENTS,
        )

    if hasattr(locked_payment, "billing_invoice_settlement"):
        raise BillingLifecycleError(
            "Billing settlements cannot reuse a payment already linked to a settlement.",
            code=BILLING_SETTLEMENT_PAYMENT_ALREADY_USED,
        )

    if hasattr(locked_payment, "billing_installment_allocation"):
        raise BillingLifecycleError(
            ("Billing settlements cannot reuse a payment already allocated to an installment."),
            code=BILLING_SETTLEMENT_PAYMENT_ALREADY_USED,
        )

    if locked_payment.payment_status not in CONFIRMED_PAYMENT_STATUS_VALUES:
        raise BillingLifecycleError(
            "Billing settlements require a confirmed or reconciled payment.",
            code=INVALID_BILLING_SETTLEMENT_PAYMENT,
        )

    if locked_payment.amount != locked_invoice.amount:
        raise BillingLifecycleError(
            "Billing settlements currently require an exact payment amount match.",
            code=INVALID_BILLING_SETTLEMENT_PAYMENT,
        )

    if locked_invoice.reservation_draft_id is not None:
        if locked_payment.reservation_draft_id != locked_invoice.reservation_draft_id:
            raise BillingLifecycleError(
                "Billing settlements require a payment linked to the same reservation draft.",
                code=INVALID_BILLING_SETTLEMENT_PAYMENT,
            )

    actor_id = getattr(actor, "pk", None)
    settled_at = timezone.now()
    settlement = BillingInvoiceSettlement.objects.create(
        invoice=locked_invoice,
        payment=locked_payment,
        amount=locked_invoice.amount,
        settled_at=settled_at,
        settled_by_id=actor_id,
        notes=notes,
        created_by_id=actor_id,
        updated_by_id=actor_id,
    )

    locked_invoice.invoice_status = BillingInvoiceStatus.SETTLED
    locked_invoice.settled_at = settled_at
    locked_invoice.settled_by_id = actor_id
    locked_invoice.notes = notes or locked_invoice.notes
    locked_invoice.updated_by_id = actor_id
    locked_invoice.full_clean()
    locked_invoice.save()

    record_audit_event_on_commit(
        actor=actor,
        action="billing.invoice_settled",
        target_type="billing_invoice",
        target_id=str(locked_invoice.id),
        metadata={
            "payment_id": str(locked_payment.id),
            "settlement_id": str(settlement.id),
            "amount": str(settlement.amount),
        },
    )
    return BillingInvoiceSettlementResult(invoice=locked_invoice, settlement=settlement)


@transaction.atomic
def cancel_billing_invoice(
    *,
    invoice: BillingInvoice,
    actor: object | None = None,
    notes: str = "",
) -> BillingInvoice:
    locked_invoice = BillingInvoice.objects.select_for_update().get(pk=invoice.pk)
    locked_invoice = BillingInvoice.objects.select_related("settlement").get(pk=locked_invoice.pk)

    if locked_invoice.invoice_status != BillingInvoiceStatus.OPEN:
        raise BillingLifecycleError(
            "Billing invoice must be open before cancellation.",
            code=INVALID_BILLING_INVOICE_CANCEL_STATE,
        )

    if hasattr(locked_invoice, "settlement"):
        raise BillingLifecycleError(
            "Billing invoice is already settled.",
            code=INVALID_BILLING_INVOICE_STATUS,
        )

    if locked_invoice.installments.filter(paid_amount__gt=Decimal("0.00")).exists():
        raise BillingLifecycleError(
            (
                "Billing invoices with installment payments cannot be cancelled"
                " directly; cancellation requires the future credit-note/refund"
                " workflow."
            ),
            code=BILLING_INVOICE_HAS_INSTALLMENT_PAYMENTS,
        )

    actor_id = getattr(actor, "pk", None)
    locked_invoice.invoice_status = BillingInvoiceStatus.CANCELLED
    if notes:
        locked_invoice.notes = notes
    locked_invoice.updated_by_id = actor_id
    locked_invoice.full_clean()
    locked_invoice.save()

    record_audit_event_on_commit(
        actor=actor,
        action="billing.invoice_cancelled",
        target_type="billing_invoice",
        target_id=str(locked_invoice.id),
        metadata={
            "amount": str(locked_invoice.amount),
            "source_kind": locked_invoice.source_kind,
        },
    )
    return locked_invoice


def active_billing_invoice_installments():
    return BillingInvoiceInstallment.objects.select_related(
        "invoice",
        "invoice__reservation_draft",
        "created_by",
        "updated_by",
    ).order_by("due_at", "created_at", "id")


@transaction.atomic
def create_billing_invoice_installments(
    *,
    invoice: BillingInvoice,
    installments: list[BillingInstallmentItem],
    actor: object | None = None,
    notes: str = "",
) -> list[BillingInvoiceInstallment]:
    if not installments:
        raise BillingLifecycleError(
            "At least one installment is required.",
            code=INVALID_BILLING_INSTALLMENT_ITEM,
        )

    locked_invoice = BillingInvoice.objects.select_for_update().get(pk=invoice.pk)

    if locked_invoice.invoice_status != BillingInvoiceStatus.OPEN:
        raise BillingLifecycleError(
            "Billing invoice must be open before creating an installment schedule.",
            code=INVALID_BILLING_INVOICE_STATUS,
        )

    if hasattr(locked_invoice, "settlement"):
        raise BillingLifecycleError(
            (
                "Billing invoices with a single-payment settlement cannot take"
                " an installment schedule."
            ),
            code=BILLING_INVOICE_SETTLEMENT_EXISTS,
        )

    if locked_invoice.installments.exists():
        raise BillingLifecycleError(
            "Billing invoice already has an installment schedule.",
            code=BILLING_INSTALLMENT_SCHEDULE_EXISTS,
        )

    total = Decimal("0.00")
    for item in installments:
        if item.amount is None or item.amount <= 0:
            raise BillingLifecycleError(
                "Installment amounts must be greater than zero.",
                code=INVALID_BILLING_INSTALLMENT_ITEM,
            )
        if item.due_at is None:
            raise BillingLifecycleError(
                "Installment due dates are required.",
                code=INVALID_BILLING_INSTALLMENT_ITEM,
            )
        total += item.amount

    if total != locked_invoice.amount:
        raise BillingLifecycleError(
            "Installment totals must match the invoice amount.",
            code=BILLING_INSTALLMENT_TOTAL_MISMATCH,
        )

    actor_id = getattr(actor, "pk", None)
    created = []
    for item in installments:
        installment = BillingInvoiceInstallment.objects.create(
            invoice=locked_invoice,
            amount=item.amount,
            paid_amount=Decimal("0.00"),
            due_at=item.due_at,
            status=BillingInstallmentStatus.UNPAID,
            notes=notes,
            created_by_id=actor_id,
            updated_by_id=actor_id,
        )
        created.append(installment)

    record_audit_event_on_commit(
        actor=actor,
        action="billing.installment_schedule_created",
        target_type="billing_invoice",
        target_id=str(locked_invoice.id),
        metadata={
            "installment_count": len(created),
            "invoice_amount": str(locked_invoice.amount),
            "installment_total": str(total),
        },
    )
    return created


@transaction.atomic
def allocate_payment_to_installment(
    *,
    installment: BillingInvoiceInstallment,
    payment: Payment,
    actor: object | None = None,
    notes: str = "",
) -> BillingInstallmentAllocationResult:
    locked_installment = BillingInvoiceInstallment.objects.select_for_update().get(
        pk=installment.pk
    )
    locked_installment = BillingInvoiceInstallment.objects.select_related(
        "invoice",
        "invoice__reservation_draft",
    ).get(pk=locked_installment.pk)
    locked_payment = Payment.objects.select_for_update().get(pk=payment.pk)
    locked_payment = Payment.objects.select_related("reservation_draft").get(pk=locked_payment.pk)
    locked_invoice = BillingInvoice.objects.select_for_update().get(
        pk=locked_installment.invoice_id
    )

    if locked_invoice.invoice_status != BillingInvoiceStatus.OPEN:
        raise BillingLifecycleError(
            "Billing invoice must be open before allocating a payment to an installment.",
            code=INVALID_BILLING_INVOICE_STATUS,
        )

    if hasattr(locked_invoice, "settlement"):
        raise BillingLifecycleError(
            (
                "Billing invoices with a single-payment settlement cannot take"
                " installment allocations."
            ),
            code=BILLING_INVOICE_SETTLEMENT_EXISTS,
        )

    if locked_installment.status == BillingInstallmentStatus.PAID:
        raise BillingLifecycleError(
            "Billing installment is already fully paid.",
            code=BILLING_INSTALLMENT_ALREADY_PAID,
        )

    if hasattr(locked_payment, "billing_installment_allocation"):
        raise BillingLifecycleError(
            "Installment allocations cannot reuse a payment already linked to an allocation.",
            code=BILLING_INSTALLMENT_PAYMENT_ALREADY_USED,
        )

    if hasattr(locked_payment, "billing_invoice_settlement"):
        raise BillingLifecycleError(
            (
                "Installment allocations cannot reuse a payment already linked to"
                " a billing settlement."
            ),
            code=BILLING_INSTALLMENT_PAYMENT_ALREADY_USED,
        )

    if locked_payment.payment_status not in CONFIRMED_PAYMENT_STATUS_VALUES:
        raise BillingLifecycleError(
            "Installment allocations require a confirmed or reconciled payment.",
            code=INVALID_BILLING_INSTALLMENT_ALLOCATION,
        )

    remaining = locked_installment.amount - locked_installment.paid_amount
    if locked_payment.amount > remaining:
        raise BillingLifecycleError(
            "Payment amount exceeds the remaining installment balance.",
            code=INVALID_BILLING_INSTALLMENT_ALLOCATION,
        )

    if locked_invoice.reservation_draft_id is not None:
        if locked_payment.reservation_draft_id != locked_invoice.reservation_draft_id:
            raise BillingLifecycleError(
                "Installment allocations require a payment linked to the same reservation draft.",
                code=INVALID_BILLING_INSTALLMENT_ALLOCATION,
            )

    actor_id = getattr(actor, "pk", None)
    new_paid = locked_installment.paid_amount + locked_payment.amount
    if new_paid == locked_installment.amount:
        locked_installment.status = BillingInstallmentStatus.PAID
    else:
        locked_installment.status = BillingInstallmentStatus.PARTIALLY_PAID
    locked_installment.paid_amount = new_paid
    locked_installment.notes = notes or locked_installment.notes
    locked_installment.updated_by_id = actor_id
    locked_installment.full_clean()
    locked_installment.save()

    allocated_at = timezone.now()
    allocation = BillingInstallmentAllocation.objects.create(
        installment=locked_installment,
        payment=locked_payment,
        amount=locked_payment.amount,
        allocated_at=allocated_at,
        allocated_by_id=actor_id,
        notes=notes,
        created_by_id=actor_id,
        updated_by_id=actor_id,
    )

    record_audit_event_on_commit(
        actor=actor,
        action="billing.installment_payment_allocated",
        target_type="billing_invoice_installment",
        target_id=str(locked_installment.id),
        metadata={
            "payment_id": str(locked_payment.id),
            "allocation_id": str(allocation.id),
            "amount": str(allocation.amount),
            "installment_status": locked_installment.status,
        },
    )

    all_installments = list(locked_invoice.installments.all())
    if all_installments and all(
        i.status == BillingInstallmentStatus.PAID for i in all_installments
    ):
        locked_invoice.invoice_status = BillingInvoiceStatus.SETTLED
        locked_invoice.settled_at = allocated_at
        locked_invoice.settled_by_id = actor_id
        locked_invoice.updated_by_id = actor_id
        locked_invoice.full_clean()
        locked_invoice.save()
        record_audit_event_on_commit(
            actor=actor,
            action="billing.invoice_auto_settled",
            target_type="billing_invoice",
            target_id=str(locked_invoice.id),
            metadata={
                "amount": str(locked_invoice.amount),
                "final_installment_id": str(locked_installment.id),
            },
        )
    return BillingInstallmentAllocationResult(installment=locked_installment, allocation=allocation)


@transaction.atomic
def create_billing_invoice_refund_obligation(
    *,
    invoice: BillingInvoice,
    actor: object | None = None,
    notes: str = "",
) -> BillingRefundObligation:
    locked_invoice = BillingInvoice.objects.select_for_update().get(pk=invoice.pk)
    locked_invoice = BillingInvoice.objects.select_related("refund_obligation").get(
        pk=locked_invoice.pk
    )

    if locked_invoice.invoice_status != BillingInvoiceStatus.OPEN:
        raise BillingLifecycleError(
            "Billing invoice must be open before creating a refund obligation.",
            code=INVALID_BILLING_INVOICE_STATUS,
        )

    if hasattr(locked_invoice, "refund_obligation"):
        raise BillingLifecycleError(
            "Billing invoice already has a refund obligation.",
            code=BILLING_INVOICE_ALREADY_CORRECTED,
        )

    has_allocations = locked_invoice.installments.filter(paid_amount__gt=Decimal("0.00")).exists()
    if not has_allocations:
        raise BillingLifecycleError(
            (
                "Billing invoice correction requires applied installment payments;"
                " use cancel for unpaid schedules."
            ),
            code=BILLING_INVOICE_CORRECTION_NOT_APPLICABLE,
        )

    refund_amount = locked_invoice.installments.aggregate(total=Sum("paid_amount"))[
        "total"
    ] or Decimal("0.00")

    actor_id = getattr(actor, "pk", None)
    locked_invoice.invoice_status = BillingInvoiceStatus.CANCELLED
    if notes:
        locked_invoice.notes = notes
    locked_invoice.updated_by_id = actor_id
    locked_invoice.full_clean()
    locked_invoice.save()

    obligation = BillingRefundObligation.objects.create(
        invoice=locked_invoice,
        refund_amount=refund_amount,
        status=BillingRefundObligationStatus.PENDING,
        notes=notes,
        created_by_id=actor_id,
        updated_by_id=actor_id,
    )

    record_audit_event_on_commit(
        actor=actor,
        action="billing.invoice_cancelled",
        target_type="billing_invoice",
        target_id=str(locked_invoice.id),
        metadata={
            "amount": str(locked_invoice.amount),
            "source_kind": locked_invoice.source_kind,
            "reason": "correction",
        },
    )
    record_audit_event_on_commit(
        actor=actor,
        action="billing.invoice_refund_obligation_created",
        target_type="billing_refund_obligation",
        target_id=str(obligation.id),
        metadata={
            "invoice_id": str(locked_invoice.id),
            "refund_amount": str(refund_amount),
            "status": obligation.status,
        },
    )
    return obligation


@transaction.atomic
def execute_billing_refund_obligation(
    *,
    obligation: BillingRefundObligation,
    actor: object | None = None,
    notes: str | None = None,
) -> BillingRefundExecutionResult:
    locked_obligation = BillingRefundObligation.objects.select_for_update().get(pk=obligation.pk)
    locked_obligation = BillingRefundObligation.objects.select_related(
        "invoice",
        "invoice__reservation_draft",
        "invoice__reservation_draft__customer",
        "document_instance",
        "executed_by",
    ).get(pk=locked_obligation.pk)

    existing_payment = (
        Payment.objects.select_for_update()
        .filter(billing_refund_obligation=locked_obligation)
        .first()
    )
    if existing_payment is not None:
        existing_payment = Payment.objects.select_related(
            "receipt_document", "billing_refund_obligation"
        ).get(pk=existing_payment.pk)
    if locked_obligation.status == BillingRefundObligationStatus.EXECUTED:
        if existing_payment is None:
            raise BillingLifecycleError(
                "Executed billing refund obligation is missing its refund payment link.",
                code=BILLING_INVOICE_ALREADY_CORRECTED,
            )
        return BillingRefundExecutionResult(obligation=locked_obligation, payment=existing_payment)

    actor_id = getattr(actor, "pk", None)
    payment_notes = notes if notes is not None else locked_obligation.notes
    payment = existing_payment or Payment.objects.create(
        reservation_draft=locked_obligation.invoice.reservation_draft,
        payment_kind="refund",
        payment_method="bank_transfer",
        payment_status="pending",
        amount=locked_obligation.refund_amount,
        billing_refund_obligation=locked_obligation,
        source_label="Billing invoice refund",
        notes=payment_notes or "",
        created_by_id=actor_id,
        updated_by_id=actor_id,
    )

    if payment.payment_status == "pending":
        refund_result = confirm_refund_payment(
            payment=payment,
            actor=actor,
            notes=payment_notes,
        )
        payment = refund_result.payment
        document_instance = refund_result.receipt_document
    else:
        document_instance = payment.receipt_document

    executed_at = payment.paid_at or timezone.now()
    locked_obligation.status = BillingRefundObligationStatus.EXECUTED
    locked_obligation.document_instance = document_instance
    locked_obligation.executed_at = executed_at
    locked_obligation.executed_by_id = actor_id
    if notes is not None:
        locked_obligation.notes = notes
    locked_obligation.updated_by_id = actor_id
    locked_obligation.full_clean()
    locked_obligation.save()

    record_audit_event_on_commit(
        actor=actor,
        action="billing.refund_obligation_executed",
        target_type="billing_refund_obligation",
        target_id=str(locked_obligation.id),
        metadata={
            "invoice_id": str(locked_obligation.invoice_id),
            "payment_id": str(payment.id),
            "document_instance_id": str(document_instance.id) if document_instance else None,
            "refund_amount": str(locked_obligation.refund_amount),
            "status": locked_obligation.status,
        },
    )
    return BillingRefundExecutionResult(obligation=locked_obligation, payment=payment)
