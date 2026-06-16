from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import TYPE_CHECKING

from apps.documents.registry import (
    DocumentTemplateDefinition,
    get_document_template_definition,
)

if TYPE_CHECKING:
    from apps.payments.models import Payment


PAYMENT_RECEIPT_TEMPLATE_KEY = "shared.payment_receipt.v1"
UNKNOWN_PAYMENT_RECEIPT_TEMPLATE_KEY = "unknown_payment_receipt_template_key"


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
    paid_at: object | None
    external_reference: str
    source_label: str
    customer_display_name: str
    notes: str


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


def build_payment_receipt_context(*, payment: Payment) -> PaymentReceiptContext:
    template_definition = get_document_template_definition(PAYMENT_RECEIPT_TEMPLATE_KEY)
    if template_definition is None:
        raise PaymentReceiptContextError(
            "Payment receipt template definition is missing.",
            code=UNKNOWN_PAYMENT_RECEIPT_TEMPLATE_KEY,
        )

    reservation_draft = payment.reservation_draft
    customer_display_name = (
        reservation_draft.customer.display_name
        if reservation_draft is not None
        else (payment.source_label or "Generic payment source")
    )

    return PaymentReceiptContext(
        template=_template_context(template_definition),
        payment=PaymentReceiptPaymentContext(
            payment_id=payment.id,
            reservation_draft_id=payment.reservation_draft_id,
            reservation_public_reference=(
                reservation_draft.public_reference if reservation_draft is not None else ""
            ),
            payment_kind=payment.payment_kind,
            payment_method=payment.payment_method,
            payment_status=payment.payment_status,
            amount=payment.amount,
            paid_at=payment.paid_at,
            external_reference=payment.external_reference or "",
            source_label=payment.source_label or "",
            customer_display_name=customer_display_name,
            notes=payment.notes or "",
        ),
    )
