from __future__ import annotations

from dataclasses import dataclass

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
    BillingInvoice,
    BillingInvoiceSettlement,
    BillingInvoiceSourceKind,
    BillingInvoiceStatus,
)

INVALID_BILLING_INVOICE_SOURCE_STATE = "invalid_billing_invoice_source_state"
INVALID_BILLING_INVOICE_STATUS = "invalid_billing_invoice_status"
INVALID_BILLING_SETTLEMENT_PAYMENT = "invalid_billing_settlement_payment"
BILLING_INVOICE_ALREADY_EXISTS = "billing_invoice_already_exists"


class BillingLifecycleError(ValueError):
    def __init__(self, message: str, *, code: str) -> None:
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class BillingInvoiceSettlementResult:
    invoice: BillingInvoice
    settlement: BillingInvoiceSettlement


def active_billing_invoices():
    return BillingInvoice.objects.select_related(
        "excess_receivable",
        "excess_receivable__settlement_execution",
        "excess_receivable__settlement_execution__settlement",
        "excess_receivable__settlement_execution__settlement__return_operation",
        "excess_receivable__settlement_execution__settlement__return_operation__reservation_draft",
        "document_instance",
        "reservation_draft",
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
