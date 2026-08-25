from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from math import ceil
from typing import TYPE_CHECKING

from apps.documents.registry import (
    DocumentTemplateDefinition,
    get_document_template_definition,
)

if TYPE_CHECKING:
    from apps.payments.models import Payment


PAYMENT_RECEIPT_TEMPLATE_KEY = "titan.payment_receipt.v1"
TITAN_PAYMENT_RECEIPT_TEMPLATE_KEY = "titan.payment_receipt.v1"
HAHITANTSOA_PAYMENT_RECEIPT_TEMPLATE_KEY = "hahitantsoa.payment_receipt.v1"
UNKNOWN_PAYMENT_RECEIPT_TEMPLATE_KEY = "unknown_payment_receipt_template_key"
PAYMENT_METHOD_LABELS = {
    "cash": "Espèces",
    "bank_transfer": "Virement",
    "mobile_money": "Mvola",
    "cheque": "Chèque",
    "other": "Autre",
}


class PaymentReceiptContextError(ValueError):
    def __init__(self, message: str, *, code: str) -> None:
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class PaymentReceiptTemplateContext:
    key: str
    business_scope: str
    document_type: str
    label: str
    version: str


@dataclass(frozen=True)
class PaymentReceiptPaymentContext:
    payment_id: object
    reservation_draft_id: object | None
    reservation_public_reference: str
    payment_kind: str
    payment_method: str
    payment_status: str
    amount: Decimal
    amount_label: str
    paid_at: object | None
    external_reference: str
    source_label: str
    customer_display_name: str
    notes: str
    event_date: object | None
    event_date_label: str
    payment_date_label: str
    payment_method_label: str
    transaction_reference: str
    history: tuple[dict[str, object], ...]
    total_deposit_label: str
    proforma_reference: str
    proforma_amount_label: str
    remaining_balance_label: str
    receipt_page_height_mm: int


@dataclass(frozen=True)
class PaymentReceiptContext:
    template: PaymentReceiptTemplateContext
    payment: PaymentReceiptPaymentContext


def _template_context(definition: DocumentTemplateDefinition) -> PaymentReceiptTemplateContext:
    return PaymentReceiptTemplateContext(
        key=definition.key,
        business_scope=definition.business_scope,
        document_type=definition.document_type,
        label=definition.label,
        version=definition.version,
    )


def payment_receipt_template_key(*, payment: Payment) -> str:
    """Select the Hahitantsoa receipt for Hahitantsoa event payments, Titan receipt for Titan."""

    if payment.hahitantsoa_event_draft_id is not None:
        return HAHITANTSOA_PAYMENT_RECEIPT_TEMPLATE_KEY
    return TITAN_PAYMENT_RECEIPT_TEMPLATE_KEY


def _format_amount(value: Decimal | None) -> str:
    if value is None:
        return ""
    return f"{value:,.0f}".replace(",", " ")


def _date_label(value: object | None) -> str:
    if value is None:
        return ""
    from django.utils import timezone

    return timezone.localtime(value).strftime("%d/%m/%Y")


def _payment_method_label(payment) -> str:
    return PAYMENT_METHOD_LABELS.get(payment.payment_method, payment.payment_method)


def build_payment_receipt_context(
    *, payment: Payment, template_key: str | None = None
) -> PaymentReceiptContext:
    template_definition = get_document_template_definition(
        template_key or payment_receipt_template_key(payment=payment)
    )
    if template_definition is None:
        raise PaymentReceiptContextError(
            "Payment receipt template definition is missing.",
            code=UNKNOWN_PAYMENT_RECEIPT_TEMPLATE_KEY,
        )

    reservation_draft = payment.reservation_draft
    event_draft = payment.hahitantsoa_event_draft
    customer = (
        reservation_draft.customer
        if reservation_draft is not None
        else event_draft.customer
        if event_draft is not None
        else None
    )
    scoped_payments = (
        event_draft.payments.all()
        if event_draft is not None
        else reservation_draft.payments.all()
        if reservation_draft is not None
        else None
    )
    from apps.payments.models import CONFIRMED_PAYMENT_STATUS_VALUES, PaymentKind

    confirmed_payments = tuple(
        scoped_payments.filter(payment_status__in=CONFIRMED_PAYMENT_STATUS_VALUES).order_by(
            "paid_at", "created_at", "id"
        )
        if scoped_payments is not None
        else ()
    )
    history = tuple(
        {
            "date_label": _date_label(item.paid_at),
            "amount_label": _format_amount(item.amount),
            "method_label": _payment_method_label(item),
            "reference": item.external_reference or "",
            "kind": item.get_payment_kind_display(),
        }
        for item in confirmed_payments
    )
    deposit_total = sum(
        (item.amount for item in confirmed_payments if item.payment_kind == PaymentKind.DEPOSIT),
        Decimal("0"),
    )
    event_date = (
        event_draft.start_at
        if event_draft is not None
        else (reservation_draft.start_at if reservation_draft is not None else None)
    )
    proforma_document = (
        event_draft.document_instances.filter(document_type="proforma")
        .order_by("-created_at", "-id")
        .first()
        if event_draft is not None
        else reservation_draft.document_instances.filter(document_type="proforma")
        .order_by("-created_at", "-id")
        .first()
        if reservation_draft is not None
        else None
    )
    customer_display_name = (
        customer.display_name
        if customer is not None
        else payment.source_label or "Generic payment source"
    )
    # Thermal PDF engines need a concrete page height; ``auto`` falls back to
    # A4 in WeasyPrint. Keep the source receipt height for four history rows and
    # grow only for data that genuinely needs additional lines.
    history_extra_rows = max(0, len(history) - 4)
    customer_extra_lines = max(0, ceil(len(customer_display_name) / 26) - 1)
    receipt_page_height_mm = 120 + (history_extra_rows * 5) + (customer_extra_lines * 4)

    return PaymentReceiptContext(
        template=_template_context(template_definition),
        payment=PaymentReceiptPaymentContext(
            payment_id=payment.id,
            reservation_draft_id=payment.reservation_draft_id,
            reservation_public_reference=(
                reservation_draft.public_reference
                if reservation_draft is not None
                else event_draft.public_reference
                if event_draft is not None
                else ""
            ),
            payment_kind=payment.payment_kind,
            payment_method=payment.payment_method,
            payment_status=payment.payment_status,
            amount=payment.amount,
            amount_label=_format_amount(payment.amount),
            paid_at=payment.paid_at,
            external_reference=payment.external_reference or "",
            source_label=payment.source_label or "",
            customer_display_name=customer_display_name,
            notes=payment.notes or "",
            event_date=event_date,
            event_date_label=_date_label(event_date),
            payment_date_label=_date_label(payment.paid_at),
            payment_method_label=_payment_method_label(payment),
            transaction_reference=payment.external_reference or "",
            history=history,
            total_deposit_label=_format_amount(deposit_total),
            proforma_reference=(
                proforma_document.reservation_public_reference if proforma_document else ""
            ),
            proforma_amount_label="",
            remaining_balance_label="",
            receipt_page_height_mm=receipt_page_height_mm,
        ),
    )
