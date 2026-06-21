from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from apps.audit.services import record_audit_event_on_commit
from apps.inventory.models import (
    InventoryDamageLossExcessReceivable,
    InventoryDamageLossExcessReceivableStatus,
)
from apps.inventory.services import generate_excess_receivable_invoice_document
from apps.payments.models import CONFIRMED_PAYMENT_STATUS_VALUES, Payment

from .models import (
    BillingInstallmentAllocation,
    BillingInstallmentStatus,
    BillingInvoice,
    BillingInvoiceInstallment,
    BillingInvoiceSettlement,
    BillingInvoiceSourceKind,
    BillingInvoiceStatus,
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


def active_billing_invoices():
    return BillingInvoice.objects.select_related(
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
    ).order_by("-issued_at", "-created_at", "id")


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
    return BillingInstallmentAllocationResult(installment=locked_installment, allocation=allocation)
