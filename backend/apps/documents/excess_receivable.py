from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from apps.documents.registry import (
    DocumentTemplateDefinition,
    get_document_template_definition,
)

if TYPE_CHECKING:
    from apps.inventory.models import InventoryDamageLossExcessReceivable


EXCESS_RECEIVABLE_INVOICE_TEMPLATE_KEY = "shared.damage_loss_excess_invoice.v1"
UNKNOWN_EXCESS_RECEIVABLE_INVOICE_TEMPLATE_KEY = "unknown_excess_receivable_invoice_template_key"


class ExcessReceivableInvoiceContextError(ValueError):
    def __init__(self, message: str, *, code: str) -> None:
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class ExcessReceivableInvoiceTemplateContext:
    key: str
    business_scope: str
    document_type: str
    label: str
    version: str
    status: str
    source_kind: str
    source_reference: str
    template_path: str
    preview_path: str
    validated_by_client: bool
    notes: str

    @classmethod
    def from_definition(
        cls,
        template_definition: DocumentTemplateDefinition,
    ) -> ExcessReceivableInvoiceTemplateContext:
        return cls(
            key=template_definition.key,
            business_scope=template_definition.business_scope,
            document_type=template_definition.document_type,
            label=template_definition.label,
            version=template_definition.version,
            status=template_definition.status,
            source_kind=template_definition.source_kind,
            source_reference=template_definition.source_reference,
            template_path=template_definition.template_path,
            preview_path=template_definition.preview_path,
            validated_by_client=template_definition.validated_by_client,
            notes=template_definition.notes,
        )


@dataclass(frozen=True)
class ExcessReceivableContext:
    reservation_public_reference: str
    reservation_status: str
    customer_display_name: str
    customer_email: str
    customer_phone: str
    customer_address: str


@dataclass(frozen=True)
class ExcessReceivableInvoiceContext:
    template: ExcessReceivableInvoiceTemplateContext
    excess_receivable: ExcessReceivableContext


def build_excess_receivable_invoice_context(
    *,
    excess_receivable: InventoryDamageLossExcessReceivable,
) -> ExcessReceivableInvoiceContext:
    template_definition = get_document_template_definition(
        EXCESS_RECEIVABLE_INVOICE_TEMPLATE_KEY,
    )
    if template_definition is None:
        raise ExcessReceivableInvoiceContextError(
            "Excess receivable invoice template definition is missing.",
            code=UNKNOWN_EXCESS_RECEIVABLE_INVOICE_TEMPLATE_KEY,
        )

    reservation_draft = (
        excess_receivable.settlement_execution.settlement.return_operation.reservation_draft
    )
    customer = reservation_draft.customer if reservation_draft is not None else None

    return ExcessReceivableInvoiceContext(
        template=ExcessReceivableInvoiceTemplateContext.from_definition(template_definition),
        excess_receivable=ExcessReceivableContext(
            reservation_public_reference=(
                reservation_draft.public_reference if reservation_draft is not None else ""
            ),
            reservation_status=(reservation_draft.status if reservation_draft is not None else ""),
            customer_display_name=(customer.display_name if customer is not None else ""),
            customer_email=customer.email if customer is not None else "",
            customer_phone=customer.phone if customer is not None else "",
            customer_address=customer.address if customer is not None else "",
        ),
    )
