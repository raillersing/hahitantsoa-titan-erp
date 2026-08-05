from __future__ import annotations

import csv
import hashlib
import io
from collections import defaultdict
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.audit.services import record_audit_event_on_commit
from apps.billing.models import BillingRefundObligationStatus
from apps.documents.models import DocumentInstance
from apps.documents.registry import get_document_template_definition
from apps.documents.runtime import generate_document_instance_html
from apps.finance.models import FinanceAccount, FinanceAccountKind, FinancialJournalDirection
from apps.finance.services import record_financial_journal_entry
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
from apps.payments.models import (
    Payment,
    PaymentKind,
    PaymentMethod,
    PaymentReconciliationAllocation,
    PaymentReconciliationImport,
    PaymentReconciliationImportStatus,
    PaymentReconciliationLine,
    PaymentReconciliationLineStatus,
    PaymentStatus,
)

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
INVALID_RECONCILIATION = "invalid_payment_reconciliation"


class PaymentReconciliationError(ValueError):
    def __init__(self, message: str, *, code: str = INVALID_RECONCILIATION) -> None:
        super().__init__(message)
        self.code = code


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


def _require_reconciliation_account(account: FinanceAccount) -> None:
    if account.kind not in {FinanceAccountKind.BANK, FinanceAccountKind.MOBILE_MONEY}:
        raise PaymentReconciliationError("Reconciliation requires a bank or mobile-money account.")
    if not account.is_active:
        raise PaymentReconciliationError("Reconciliation requires an active finance account.")


def _line_fingerprint(
    *, account_id, transaction_date: date, amount: Decimal, reference: str
) -> str:
    normalized = "|".join(
        (str(account_id), transaction_date.isoformat(), f"{amount:.2f}", reference.strip().upper())
    )
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


@transaction.atomic
def stage_reconciliation_csv(
    *, account: FinanceAccount, actor, csv_content: str
) -> PaymentReconciliationImport:
    """Validate CSV fully before persisting a private, reviewable staged import."""
    locked_account = FinanceAccount.objects.select_for_update().get(pk=account.pk)
    _require_reconciliation_account(locked_account)
    content_fingerprint = hashlib.sha256(csv_content.encode("utf-8")).hexdigest()
    existing = PaymentReconciliationImport.objects.filter(
        account=locked_account, content_fingerprint=content_fingerprint
    ).first()
    if existing is not None:
        return existing
    try:
        rows = list(csv.DictReader(io.StringIO(csv_content)))
    except csv.Error as exc:
        raise PaymentReconciliationError("CSV statement could not be parsed.") from exc
    required_columns = {"transaction_date", "amount", "reference", "description"}
    if not rows or not required_columns.issubset(set(rows[0])):
        raise PaymentReconciliationError(
            "CSV requires transaction_date, amount, reference and description columns."
        )
    normalized_rows: list[dict[str, object]] = []
    fingerprints: set[str] = set()
    for row in rows:
        try:
            transaction_date = date.fromisoformat((row.get("transaction_date") or "").strip())
            amount = Decimal((row.get("amount") or "").strip()).quantize(Decimal("0.01"))
        except Exception as exc:
            raise PaymentReconciliationError("CSV contains an invalid date or amount.") from exc
        reference = (row.get("reference") or "").strip()
        if amount <= 0 or not reference:
            raise PaymentReconciliationError(
                "CSV lines require a positive amount and external reference."
            )
        fingerprint = _line_fingerprint(
            account_id=locked_account.id,
            transaction_date=transaction_date,
            amount=amount,
            reference=reference,
        )
        if (
            fingerprint in fingerprints
            or PaymentReconciliationLine.objects.filter(
                account=locked_account, fingerprint=fingerprint
            ).exists()
        ):
            raise PaymentReconciliationError("CSV contains a duplicate external statement line.")
        fingerprints.add(fingerprint)
        normalized_rows.append(
            {
                "transaction_date": transaction_date,
                "amount": amount,
                "external_reference": reference,
                "description": (row.get("description") or "").strip(),
                "raw_data": {key: value or "" for key, value in row.items()},
                "fingerprint": fingerprint,
            }
        )
    reconciliation_import = PaymentReconciliationImport.objects.create(
        account=locked_account, content_fingerprint=content_fingerprint, created_by=actor
    )
    PaymentReconciliationLine.objects.bulk_create(
        [
            PaymentReconciliationLine(
                reconciliation_import=reconciliation_import, account=locked_account, **row
            )
            for row in normalized_rows
        ]
    )
    record_audit_event_on_commit(
        actor=actor,
        action="payment.reconciliation_import_staged",
        target_type="payment_reconciliation_import",
        target_id=str(reconciliation_import.id),
        metadata={"account_id": str(locked_account.id), "line_count": len(normalized_rows)},
    )
    return reconciliation_import


@transaction.atomic
def commit_reconciliation_import(
    *,
    reconciliation_import: PaymentReconciliationImport,
    actor,
    idempotency_key: str,
    allocations: list[dict],
) -> PaymentReconciliationImport:
    """Commit explicit allocations under deterministic locks; validated lines are append-only."""
    if not idempotency_key.strip():
        raise PaymentReconciliationError("An idempotency key is required to commit reconciliation.")
    locked_import = PaymentReconciliationImport.objects.select_for_update().get(
        pk=reconciliation_import.pk
    )
    if locked_import.status == PaymentReconciliationImportStatus.COMMITTED:
        if locked_import.idempotency_key == idempotency_key:
            return locked_import
        raise PaymentReconciliationError("A committed reconciliation import cannot be changed.")
    same_key = (
        PaymentReconciliationImport.objects.select_for_update()
        .filter(idempotency_key=idempotency_key)
        .first()
    )
    if same_key is not None and same_key.pk != locked_import.pk:
        raise PaymentReconciliationError(
            "Idempotency key belongs to another reconciliation import."
        )
    locked_account = FinanceAccount.objects.select_for_update().get(pk=locked_import.account_id)
    _require_reconciliation_account(locked_account)
    lines = list(
        PaymentReconciliationLine.objects.select_for_update()
        .filter(reconciliation_import=locked_import)
        .order_by("id")
    )
    line_by_id = {line.id: line for line in lines}
    by_line: dict[object, list[dict]] = defaultdict(list)
    payment_ids: set[object] = set()
    for allocation in allocations:
        line_id = allocation.get("line_id")
        payment_id = allocation.get("payment_id")
        if line_id not in line_by_id or payment_id is None:
            raise PaymentReconciliationError(
                "Allocations must reference staged lines and payments."
            )
        by_line[line_id].append(allocation)
        payment_ids.add(payment_id)
    if set(by_line) != set(line_by_id):
        raise PaymentReconciliationError(
            "Every staged statement line requires an explicit allocation decision."
        )
    payments = {
        payment.id: payment
        for payment in Payment.objects.select_for_update().filter(pk__in=payment_ids).order_by("id")
    }
    if len(payments) != len(payment_ids):
        raise PaymentReconciliationError("Allocated payment no longer exists.")
    actor_id = getattr(actor, "pk", None)
    allocated_payment_ids: set[object] = set()
    for line in lines:
        if line.status != PaymentReconciliationLineStatus.STAGED:
            raise PaymentReconciliationError("Only staged statement lines may be committed.")
        line_allocations = by_line[line.id]
        seen_payment_ids: set[object] = set()
        allocated_total = Decimal("0.00")
        fee_amount = Decimal(str(line_allocations[0].get("fee_amount", "0.00"))).quantize(
            Decimal("0.01")
        )
        variance_amount = Decimal(str(line_allocations[0].get("variance_amount", "0.00"))).quantize(
            Decimal("0.01")
        )
        variance_decision = str(line_allocations[0].get("variance_decision", "")).strip()
        if fee_amount < 0 or (variance_amount != 0 and not variance_decision):
            raise PaymentReconciliationError(
                "Fees must be non-negative and variances require an explicit decision."
            )
        for allocation in line_allocations:
            payment_id = allocation["payment_id"]
            if payment_id in seen_payment_ids or payment_id in allocated_payment_ids:
                raise PaymentReconciliationError(
                    "A payment can be allocated only once per reconciliation import."
                )
            seen_payment_ids.add(payment_id)
            allocated_payment_ids.add(payment_id)
            payment = payments[payment_id]
            amount = Decimal(str(allocation["amount"])).quantize(Decimal("0.01"))
            if (
                amount <= 0
                or payment.payment_status != PaymentStatus.CONFIRMED
                or payment.payment_method
                not in {PaymentMethod.BANK_TRANSFER, PaymentMethod.MOBILE_MONEY}
            ):
                raise PaymentReconciliationError(
                    "Only confirmed bank-transfer or mobile-money payments may be allocated."
                )
            if amount != payment.amount:
                raise PaymentReconciliationError(
                    "A payment must be fully allocated before it can be reconciled."
                )
            allocated_total += amount
            PaymentReconciliationAllocation.objects.create(
                statement_line=line, payment=payment, amount=amount
            )
        if line.amount != allocated_total - fee_amount + variance_amount:
            raise PaymentReconciliationError(
                "Statement amount does not match allocations, fee and variance decision."
            )
        line.fee_amount, line.variance_amount, line.variance_decision = (
            fee_amount,
            variance_amount,
            variance_decision,
        )
        line.status, line.committed_at, line.committed_by_id = (
            PaymentReconciliationLineStatus.RECONCILED,
            timezone.now(),
            actor_id,
        )
        line.save(
            update_fields=[
                "fee_amount",
                "variance_amount",
                "variance_decision",
                "status",
                "committed_at",
                "committed_by",
                "updated_at",
            ]
        )
        if fee_amount:
            record_financial_journal_entry(
                account=locked_account,
                direction=FinancialJournalDirection.OUTFLOW,
                amount=fee_amount,
                occurred_at=timezone.now(),
                actor=actor,
                source_label="Bank/mobile-money reconciliation fee",
                notes=f"Statement line {line.external_reference}",
            )
        record_audit_event_on_commit(
            actor=actor,
            action="payment.reconciliation_line_committed",
            target_type="payment_reconciliation_line",
            target_id=str(line.id),
            metadata={
                "fee_amount": str(fee_amount),
                "variance_amount": str(variance_amount),
                "variance_decision": variance_decision,
            },
        )
    for payment in payments.values():
        payment.payment_status, payment.updated_by_id = PaymentStatus.RECONCILED, actor_id
        payment.full_clean()
        payment.save(update_fields=["payment_status", "updated_by", "updated_at"])
        record_audit_event_on_commit(
            actor=actor,
            action="payment.reconciled",
            target_type="payment",
            target_id=str(payment.id),
            metadata={"source": "statement_reconciliation", "amount": str(payment.amount)},
        )
    (
        locked_import.status,
        locked_import.idempotency_key,
        locked_import.committed_at,
        locked_import.committed_by_id,
    ) = PaymentReconciliationImportStatus.COMMITTED, idempotency_key, timezone.now(), actor_id
    locked_import.save(
        update_fields=["status", "idempotency_key", "committed_at", "committed_by", "updated_at"]
    )
    record_audit_event_on_commit(
        actor=actor,
        action="payment.reconciliation_import_committed",
        target_type="payment_reconciliation_import",
        target_id=str(locked_import.id),
        metadata={
            "account_id": str(locked_account.id),
            "line_count": len(lines),
            "idempotency_key": idempotency_key,
        },
    )
    return locked_import
