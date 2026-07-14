from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.audit.services import record_audit_event_on_commit
from apps.billing.models import BillingRefundObligationStatus
from apps.documents.models import DocumentInstance
from apps.documents.registry import get_document_template_definition
from apps.documents.runtime import generate_document_instance_html
from apps.inventory.models import (
    InventoryCautionRefundObligation,
    InventoryCautionRefundObligationStatus,
)
from apps.payments.gateway import (
    CallbackValidationResult,
    GatewayInitiateResult,
    PaymentGatewayError,
    get_payment_gateway_adapter,
)
from apps.payments.models import Payment, PaymentKind, PaymentMethod, PaymentStatus

PAYMENT_RECEIPT_TEMPLATE_KEY = "shared.payment_receipt.v1"
PAYMENT_REFUND_RECEIPT_TEMPLATE_KEY = "shared.payment_refund_receipt.v1"


class PaymentLifecycleError(ValueError):
    def __init__(self, message: str, *, code: str) -> None:
        super().__init__(message)
        self.code = code


INVALID_PAYMENT_CONFIRMATION_STATE = "invalid_payment_confirmation_state"
INVALID_PAYMENT_CANCEL_STATE = "invalid_payment_cancel_state"
INVALID_PAYMENT_RECONCILE_STATE = "invalid_payment_reconcile_state"
INVALID_PAYMENT_REFUND_STATE = "invalid_payment_refund_state"
PAYMENT_RECEIPT_TEMPLATE_NOT_FOUND = "payment_receipt_template_not_found"
PAYMENT_REFUND_TEMPLATE_NOT_FOUND = "payment_refund_template_not_found"
REFUND_OBLIGATION_NOT_FOUND = "refund_obligation_not_found"
REFUND_OBLIGATION_NOT_PENDING = "refund_obligation_not_pending"
GATEWAY_SANDBOX_DISABLED = "gateway_sandbox_disabled"


@dataclass(frozen=True)
class PaymentConfirmationResult:
    payment: Payment
    receipt_document: DocumentInstance


@dataclass(frozen=True)
class PaymentRefundResult:
    payment: Payment
    receipt_document: DocumentInstance


def active_payments():
    return Payment.objects.select_related(
        "reservation_draft",
        "reservation_draft__customer",
        "hahitantsoa_event_draft",
        "hahitantsoa_event_draft__customer",
        "receipt_document",
        "confirmed_by",
        "refund_obligation",
        "billing_refund_obligation",
        "refund_obligation__settlement_execution",
        "billing_refund_obligation__invoice",
        "billing_refund_obligation__invoice__reservation_draft",
        "billing_refund_obligation__invoice__reservation_draft__customer",
    ).order_by("-created_at", "id")


def build_payment_receipt_document_instance_kwargs(
    *,
    payment: Payment,
    actor_id: object | None,
) -> dict[str, object]:
    template = get_document_template_definition(PAYMENT_RECEIPT_TEMPLATE_KEY)
    if template is None:
        raise PaymentLifecycleError(
            "Payment receipt template definition is missing.",
            code=PAYMENT_RECEIPT_TEMPLATE_NOT_FOUND,
        )

    reservation_draft = payment.reservation_draft
    hahitantsoa_event_draft = payment.hahitantsoa_event_draft
    customer = (
        reservation_draft.customer
        if reservation_draft is not None
        else (hahitantsoa_event_draft.customer if hahitantsoa_event_draft is not None else None)
    )
    customer_display_name = (
        customer.display_name
        if customer is not None
        else (payment.source_label or "Generic payment source")
    )

    return {
        "reservation_draft": reservation_draft,
        "hahitantsoa_event_draft": hahitantsoa_event_draft,
        "customer": customer,
        "template_key": template.key,
        "template_version": template.version,
        "template_label": template.label,
        "business_scope": template.business_scope,
        "document_type": template.document_type,
        "template_status": template.status,
        "template_source_kind": template.source_kind,
        "template_source_reference": template.source_reference,
        "template_path": template.template_path,
        "template_preview_path": template.preview_path,
        "template_validated_by_client": template.validated_by_client,
        "template_notes": template.notes,
        "reservation_public_reference": (
            reservation_draft.public_reference
            if reservation_draft is not None
            else (
                hahitantsoa_event_draft.public_reference
                if hahitantsoa_event_draft is not None
                else ""
            )
        ),
        "reservation_status": (
            reservation_draft.status
            if reservation_draft is not None
            else (hahitantsoa_event_draft.status if hahitantsoa_event_draft is not None else "")
        ),
        "customer_display_name": customer_display_name,
        "customer_email": customer.email if customer is not None else "",
        "customer_phone": customer.phone if customer is not None else "",
        "customer_address": customer.address if customer is not None else "",
        "status": "prepared",
        "prepared_at": timezone.now(),
        "prepared_by_id": actor_id,
        "notes": payment.notes,
    }


def build_refund_receipt_document_instance_kwargs(
    *,
    payment: Payment,
    actor_id: object | None,
) -> dict[str, object]:
    template = get_document_template_definition(PAYMENT_REFUND_RECEIPT_TEMPLATE_KEY)
    if template is None:
        raise PaymentLifecycleError(
            "Payment refund receipt template definition is missing.",
            code=PAYMENT_REFUND_TEMPLATE_NOT_FOUND,
        )

    obligation = payment.refund_obligation
    billing_obligation = payment.billing_refund_obligation
    settlement_execution = obligation.settlement_execution if obligation is not None else None
    reservation_draft = None
    customer = None
    if settlement_execution is not None:
        reservation_draft = settlement_execution.settlement.return_operation.reservation_draft
        customer = reservation_draft.customer if reservation_draft is not None else None
    elif billing_obligation is not None:
        reservation_draft = billing_obligation.invoice.reservation_draft
        customer = reservation_draft.customer if reservation_draft is not None else None
    customer_display_name = customer.display_name if customer is not None else "Refund recipient"

    return {
        "reservation_draft": reservation_draft,
        "customer": customer,
        "template_key": template.key,
        "template_version": template.version,
        "template_label": template.label,
        "business_scope": template.business_scope,
        "document_type": template.document_type,
        "template_status": template.status,
        "template_source_kind": template.source_kind,
        "template_source_reference": template.source_reference,
        "template_path": template.template_path,
        "template_preview_path": template.preview_path,
        "template_validated_by_client": template.validated_by_client,
        "template_notes": template.notes,
        "reservation_public_reference": (
            reservation_draft.public_reference if reservation_draft is not None else ""
        ),
        "reservation_status": (reservation_draft.status if reservation_draft is not None else ""),
        "customer_display_name": customer_display_name,
        "customer_email": customer.email if customer is not None else "",
        "customer_phone": customer.phone if customer is not None else "",
        "customer_address": customer.address if customer is not None else "",
        "status": "prepared",
        "prepared_at": timezone.now(),
        "prepared_by_id": actor_id,
        "notes": payment.notes,
    }


@transaction.atomic
def create_payment(
    *,
    actor: object | None = None,
    **validated_data,
) -> Payment:
    actor_id = getattr(actor, "pk", None)
    payment = Payment.objects.create(
        created_by_id=actor_id,
        updated_by_id=actor_id,
        **validated_data,
    )
    record_audit_event_on_commit(
        actor=actor,
        action="payment.created",
        target_type="payment",
        target_id=str(payment.id),
        metadata={
            "payment_kind": payment.payment_kind,
            "payment_status": payment.payment_status,
            "amount": str(payment.amount),
            "reservation_draft_id": (
                str(payment.reservation_draft_id) if payment.reservation_draft_id else None
            ),
            "hahitantsoa_event_draft_id": (
                str(payment.hahitantsoa_event_draft_id)
                if payment.hahitantsoa_event_draft_id
                else None
            ),
        },
    )
    return payment


@transaction.atomic
def confirm_payment(
    *,
    payment: Payment,
    actor: object | None = None,
    paid_at=None,
    external_reference: str | None = None,
    notes: str | None = None,
) -> PaymentConfirmationResult:
    payment = Payment.objects.select_for_update().get(pk=payment.pk)
    if payment.payment_status != PaymentStatus.PENDING:
        raise PaymentLifecycleError(
            f"Cannot confirm payment from status: {payment.payment_status}",
            code=INVALID_PAYMENT_CONFIRMATION_STATE,
        )

    actor_id = getattr(actor, "pk", None)
    receipt_document = DocumentInstance.objects.create(
        **build_payment_receipt_document_instance_kwargs(
            payment=payment,
            actor_id=actor_id,
        )
    )
    payment.receipt_document = receipt_document
    payment.updated_by_id = actor_id
    payment.save(update_fields=["receipt_document", "updated_by", "updated_at"])
    generate_document_instance_html(document_instance=receipt_document, actor=actor)

    payment.payment_status = PaymentStatus.CONFIRMED
    payment.paid_at = paid_at or timezone.now()
    if external_reference is not None:
        payment.external_reference = external_reference
    if notes is not None:
        payment.notes = notes
    payment.receipt_document = receipt_document
    payment.confirmed_at = timezone.now()
    payment.confirmed_by_id = actor_id
    payment.updated_by_id = actor_id
    payment.full_clean()
    payment.save()

    record_audit_event_on_commit(
        actor=actor,
        action="payment.confirmed",
        target_type="payment",
        target_id=str(payment.id),
        metadata={
            "receipt_document_id": str(receipt_document.id),
            "payment_kind": payment.payment_kind,
            "payment_method": payment.payment_method,
            "amount": str(payment.amount),
            "paid_at": payment.paid_at.isoformat(),
        },
    )
    record_audit_event_on_commit(
        actor=actor,
        action="document.instance_generated",
        target_type="document_instance",
        target_id=str(receipt_document.id),
        metadata={
            "template_key": receipt_document.template_key,
            "payment_id": str(payment.id),
            "status": receipt_document.status,
            "content_checksum": receipt_document.content_checksum,
        },
    )
    return PaymentConfirmationResult(
        payment=payment,
        receipt_document=receipt_document,
    )


@transaction.atomic
def cancel_payment(
    *,
    payment: Payment,
    actor: object | None = None,
    notes: str | None = None,
) -> Payment:
    payment = Payment.objects.select_for_update().get(pk=payment.pk)
    if payment.payment_status != PaymentStatus.PENDING:
        raise PaymentLifecycleError(
            f"Cannot cancel payment from status: {payment.payment_status}",
            code=INVALID_PAYMENT_CANCEL_STATE,
        )

    actor_id = getattr(actor, "pk", None)
    payment.payment_status = PaymentStatus.CANCELLED
    if notes is not None:
        payment.notes = notes
    payment.updated_by_id = actor_id
    payment.full_clean()
    payment.save()

    record_audit_event_on_commit(
        actor=actor,
        action="payment.cancelled",
        target_type="payment",
        target_id=str(payment.id),
        metadata={
            "payment_kind": payment.payment_kind,
            "payment_method": payment.payment_method,
            "amount": str(payment.amount),
        },
    )
    return payment


@transaction.atomic
def reconcile_payment(
    *,
    payment: Payment,
    actor: object | None = None,
    notes: str | None = None,
) -> Payment:
    payment = Payment.objects.select_for_update().get(pk=payment.pk)
    if payment.payment_status != PaymentStatus.CONFIRMED:
        raise PaymentLifecycleError(
            f"Cannot reconcile payment from status: {payment.payment_status}",
            code=INVALID_PAYMENT_RECONCILE_STATE,
        )

    actor_id = getattr(actor, "pk", None)
    payment.payment_status = PaymentStatus.RECONCILED
    if notes is not None:
        payment.notes = notes
    payment.updated_by_id = actor_id
    payment.full_clean()
    payment.save()

    record_audit_event_on_commit(
        actor=actor,
        action="payment.reconciled",
        target_type="payment",
        target_id=str(payment.id),
        metadata={
            "payment_kind": payment.payment_kind,
            "payment_method": payment.payment_method,
            "amount": str(payment.amount),
            "paid_at": payment.paid_at.isoformat() if payment.paid_at else None,
        },
    )
    return payment


@transaction.atomic
def create_refund_payment(
    *,
    refund_obligation: InventoryCautionRefundObligation,
    actor: object | None = None,
    notes: str | None = None,
) -> Payment:
    if refund_obligation.status != InventoryCautionRefundObligationStatus.PENDING:
        raise PaymentLifecycleError(
            "Refund obligation must be pending to create a refund payment.",
            code=REFUND_OBLIGATION_NOT_PENDING,
        )

    actor_id = getattr(actor, "pk", None)
    payment = Payment.objects.create(
        payment_kind="refund",
        payment_method="bank_transfer",
        payment_status=PaymentStatus.PENDING,
        amount=refund_obligation.amount,
        refund_obligation=refund_obligation,
        source_label="Caution refund",
        notes=notes or "",
        created_by_id=actor_id,
        updated_by_id=actor_id,
    )

    record_audit_event_on_commit(
        actor=actor,
        action="payment.refund.created",
        target_type="payment",
        target_id=str(payment.id),
        metadata={
            "payment_kind": payment.payment_kind,
            "amount": str(payment.amount),
            "refund_obligation_id": str(refund_obligation.id),
        },
    )
    return payment


@transaction.atomic
def confirm_refund_payment(
    *,
    payment: Payment,
    actor: object | None = None,
    paid_at=None,
    notes: str | None = None,
) -> PaymentRefundResult:
    if payment.payment_status != PaymentStatus.PENDING:
        raise PaymentLifecycleError(
            f"Cannot confirm refund payment from status: {payment.payment_status}",
            code=INVALID_PAYMENT_REFUND_STATE,
        )

    if payment.payment_kind != "refund":
        raise PaymentLifecycleError(
            "Only refund payments can be confirmed through the refund workflow.",
            code=INVALID_PAYMENT_REFUND_STATE,
        )

    if payment.refund_obligation_id is None and payment.billing_refund_obligation_id is None:
        raise PaymentLifecycleError(
            "Refund payment is not linked to an obligation.",
            code=REFUND_OBLIGATION_NOT_FOUND,
        )

    obligation = payment.refund_obligation
    billing_obligation = payment.billing_refund_obligation
    if (
        obligation is not None
        and obligation.status != InventoryCautionRefundObligationStatus.PENDING
    ):
        raise PaymentLifecycleError(
            "Refund obligation must be pending to confirm a refund payment.",
            code=REFUND_OBLIGATION_NOT_PENDING,
        )
    if (
        billing_obligation is not None
        and billing_obligation.status != BillingRefundObligationStatus.PENDING
    ):
        raise PaymentLifecycleError(
            "Refund obligation must be pending to confirm a refund payment.",
            code=REFUND_OBLIGATION_NOT_PENDING,
        )

    actor_id = getattr(actor, "pk", None)
    receipt_document = DocumentInstance.objects.create(
        **build_refund_receipt_document_instance_kwargs(
            payment=payment,
            actor_id=actor_id,
        )
    )
    payment.receipt_document = receipt_document
    payment.updated_by_id = actor_id
    payment.save(update_fields=["receipt_document", "updated_by", "updated_at"])
    generate_document_instance_html(document_instance=receipt_document, actor=actor)

    payment.payment_status = PaymentStatus.CONFIRMED
    payment.paid_at = paid_at or timezone.now()
    if notes is not None:
        payment.notes = notes
    payment.confirmed_at = timezone.now()
    payment.confirmed_by_id = actor_id
    payment.updated_by_id = actor_id
    payment.full_clean()
    payment.save()

    if obligation is not None:
        obligation.status = InventoryCautionRefundObligationStatus.SETTLED
        obligation.updated_by_id = actor_id
        obligation.save(update_fields=["status", "updated_by", "updated_at"])

    record_audit_event_on_commit(
        actor=actor,
        action="payment.refund.confirmed",
        target_type="payment",
        target_id=str(payment.id),
        metadata={
            "receipt_document_id": str(receipt_document.id),
            "payment_kind": payment.payment_kind,
            "amount": str(payment.amount),
            "paid_at": payment.paid_at.isoformat(),
            "refund_obligation_id": (
                str(obligation.id)
                if obligation is not None
                else str(billing_obligation.id)
                if billing_obligation is not None
                else None
            ),
        },
    )
    record_audit_event_on_commit(
        actor=actor,
        action="document.instance_generated",
        target_type="document_instance",
        target_id=str(receipt_document.id),
        metadata={
            "template_key": receipt_document.template_key,
            "payment_id": str(payment.id),
            "status": receipt_document.status,
            "content_checksum": receipt_document.content_checksum,
        },
    )
    return PaymentRefundResult(
        payment=payment,
        receipt_document=receipt_document,
    )


@dataclass(frozen=True)
class GatewayPaymentInitiateResult:
    payment: Payment
    gateway_result: GatewayInitiateResult


@dataclass(frozen=True)
class GatewayCallbackResult:
    payment: Payment
    callback_result: CallbackValidationResult


def _ensure_sandbox_gateway_enabled() -> None:
    if not settings.DEBUG:
        raise PaymentGatewayError(
            "The sandbox payment gateway is disabled in production.",
            code=GATEWAY_SANDBOX_DISABLED,
        )


@transaction.atomic
def initiate_mobile_money_payment(
    *,
    reservation_draft,
    amount: Decimal,
    actor: object | None = None,
    notes: str = "",
    currency: str = "MGA",
) -> GatewayPaymentInitiateResult:
    """Create a pending payment and initiate it via the configured mobile-money gateway."""
    _ensure_sandbox_gateway_enabled()
    if not isinstance(amount, Decimal) or not amount.is_finite() or amount <= Decimal("0.00"):
        raise PaymentGatewayError(
            "Payment amount must be a positive decimal.",
            code="gateway_invalid_amount",
        )
    adapter = get_payment_gateway_adapter(gateway_name="mvola")
    gateway_result = adapter.initiate_payment(
        amount=amount,
        currency=currency,
        description=notes or "Mobile money payment",
    )

    actor_id = getattr(actor, "pk", None)
    payment = Payment.objects.create(
        reservation_draft=reservation_draft,
        payment_kind=PaymentKind.BALANCE,
        payment_method=PaymentMethod.MOBILE_MONEY,
        payment_status=PaymentStatus.PENDING,
        amount=amount,
        external_reference=gateway_result.transaction_reference,
        source_label=adapter.gateway_name,
        notes=notes,
        created_by_id=actor_id,
        updated_by_id=actor_id,
    )

    record_audit_event_on_commit(
        actor=actor,
        action="payment.gateway_initiated",
        target_type="payment",
        target_id=str(payment.id),
        metadata={
            "gateway": adapter.gateway_name,
            "transaction_reference": gateway_result.transaction_reference,
            "amount": str(amount),
            "currency": currency,
        },
    )

    return GatewayPaymentInitiateResult(payment=payment, gateway_result=gateway_result)


@transaction.atomic
def process_gateway_callback(
    *,
    payload: dict,
    actor: object | None = None,
) -> GatewayCallbackResult:
    """Process an asynchronous gateway callback payload.

    Validates the payload, locates the matching payment by external_reference,
    and transitions the payment to the reported status.
    """
    _ensure_sandbox_gateway_enabled()
    adapter = get_payment_gateway_adapter(gateway_name="mvola")
    callback_result = adapter.validate_callback(payload)

    if not callback_result.valid:
        raise PaymentGatewayError(
            "Invalid gateway callback payload.",
            code="gateway_callback_invalid",
        )

    try:
        payment = Payment.objects.select_for_update().get(
            external_reference=callback_result.transaction_reference
        )
    except Payment.DoesNotExist:
        raise PaymentGatewayError(
            "Payment not found for transaction reference.",
            code="gateway_callback_payment_not_found",
        )
    except Payment.MultipleObjectsReturned:
        raise PaymentGatewayError(
            "Multiple payments use the callback transaction reference.",
            code="gateway_callback_reference_ambiguous",
        )

    if payment.payment_method != PaymentMethod.MOBILE_MONEY:
        raise PaymentGatewayError(
            "Callback payment method does not match mobile money.",
            code="gateway_callback_method_mismatch",
        )
    if payment.source_label != adapter.gateway_name:
        raise PaymentGatewayError(
            "Callback gateway does not match the payment source.",
            code="gateway_callback_source_mismatch",
        )
    if callback_result.amount is not None and callback_result.amount != payment.amount:
        raise PaymentGatewayError(
            "Callback amount does not match the payment amount.",
            code="gateway_callback_amount_mismatch",
        )

    if callback_result.status == payment.payment_status:
        return GatewayCallbackResult(payment=payment, callback_result=callback_result)
    if payment.payment_status != PaymentStatus.PENDING:
        raise PaymentGatewayError(
            "Callback status contradicts the current payment status.",
            code="gateway_callback_status_conflict",
        )

    if callback_result.status == "confirmed":
        confirmation = confirm_payment(
            payment=payment,
            actor=actor,
            paid_at=timezone.now(),
            external_reference=callback_result.transaction_reference,
            notes="Confirmed via gateway callback.",
        )
        payment = confirmation.payment
    elif callback_result.status == "failed":
        payment.payment_status = PaymentStatus.FAILED
        payment.updated_by_id = getattr(actor, "pk", None)
        payment.full_clean()
        payment.save(update_fields=["payment_status", "updated_by", "updated_at"])
        record_audit_event_on_commit(
            actor=actor,
            action="payment.gateway_failed",
            target_type="payment",
            target_id=str(payment.id),
            metadata={"gateway": adapter.gateway_name, "reason": "callback"},
        )
    elif callback_result.status == "cancelled":
        payment.payment_status = PaymentStatus.CANCELLED
        payment.updated_by_id = getattr(actor, "pk", None)
        payment.full_clean()
        payment.save(update_fields=["payment_status", "updated_by", "updated_at"])
        record_audit_event_on_commit(
            actor=actor,
            action="payment.gateway_cancelled",
            target_type="payment",
            target_id=str(payment.id),
            metadata={"gateway": adapter.gateway_name, "reason": "callback"},
        )

    return GatewayCallbackResult(payment=payment, callback_result=callback_result)
