from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from apps.documents.registry import (
    DocumentTemplateDefinition,
    get_document_template_definition,
)

if TYPE_CHECKING:
    from apps.inventory.models import InventoryDamageLossExcessReceivable


EXCESS_RECEIVABLE_INVOICE_TEMPLATE_KEY = "titan.breakage_repair_invoice.v1"
HAHITANTSOA_EXCESS_RECEIVABLE_INVOICE_TEMPLATE_KEY = "hahitantsoa.breakage_repair_invoice.v1"
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
class ExcessReceivableLineContext:
    quantity: int
    inventory_item_name: str
    notes: str = ""
    unit: str = "Pcs"
    unit_price: str = "0,00"
    total_price: str = "0,00"


@dataclass(frozen=True)
class ExcessReceivableContext:
    reservation_public_reference: str
    reservation_status: str
    customer_display_name: str
    customer_email: str
    customer_phone: str
    customer_address: str
    start_at: object = None
    lines: tuple[ExcessReceivableLineContext, ...] = ()
    total_amount: str = "0,00"
    caution_amount: str = "0,00"
    remaining_due: str = "0,00"
    due_date: object = None
    total_amount_in_words: str = ""


@dataclass(frozen=True)
class ExcessReceivableInvoiceContext:
    template: ExcessReceivableInvoiceTemplateContext
    excess_receivable: ExcessReceivableContext
    reservation_draft: object = None
    event_draft: object = None


def build_excess_receivable_invoice_context(
    *,
    excess_receivable: InventoryDamageLossExcessReceivable,
) -> ExcessReceivableInvoiceContext:
    settlement = excess_receivable.settlement_execution.settlement
    return_operation = settlement.return_operation

    is_hahitantsoa = return_operation.hahitantsoa_event_draft_id is not None
    template_key = (
        HAHITANTSOA_EXCESS_RECEIVABLE_INVOICE_TEMPLATE_KEY
        if is_hahitantsoa
        else EXCESS_RECEIVABLE_INVOICE_TEMPLATE_KEY
    )

    template_definition = get_document_template_definition(template_key)
    if template_definition is None:
        raise ExcessReceivableInvoiceContextError(
            "Excess receivable invoice template definition is missing.",
            code=UNKNOWN_EXCESS_RECEIVABLE_INVOICE_TEMPLATE_KEY,
        )

    from apps.documents.formatting import format_ariary_amount, format_ariary_amount_in_words

    if is_hahitantsoa:
        source_draft = return_operation.hahitantsoa_event_draft
    else:
        source_draft = return_operation.reservation_draft

    customer = source_draft.customer if source_draft is not None else None
    public_ref = source_draft.public_reference if source_draft is not None else ""
    status_val = source_draft.status if source_draft is not None else ""
    start_at = getattr(source_draft, "start_at", None)

    lines_context: list[ExcessReceivableLineContext] = []
    settlement_lines = settlement.lines.select_related(
        "return_operation_line__inventory_item"
    ).order_by("created_at", "id")

    for line in settlement_lines:
        item_name = (line.manual_label or "").strip()
        if (
            not item_name
            and line.return_operation_line is not None
            and line.return_operation_line.inventory_item is not None
        ):
            item_name = line.return_operation_line.inventory_item.name
        if not item_name:
            item_name = "Article"

        notes_str = (line.notes or "").strip()
        if (
            not notes_str
            and line.return_operation_line is not None
            and line.return_operation_line.notes
        ):
            notes_str = line.return_operation_line.notes.strip()

        lines_context.append(
            ExcessReceivableLineContext(
                quantity=line.quantity,
                inventory_item_name=item_name,
                notes=notes_str,
                unit="Pcs",
                unit_price=format_ariary_amount(line.unit_amount),
                total_price=format_ariary_amount(line.total_amount),
            )
        )

    total_amount_str = format_ariary_amount(settlement.damage_loss_total)
    caution_amount_str = format_ariary_amount(settlement.caution_applied)
    remaining_due_str = format_ariary_amount(settlement.excess_due)
    due_date = settlement.validated_at or settlement.created_at
    total_words = format_ariary_amount_in_words(settlement.excess_due)

    reservation_context = None
    event_context = None
    if not is_hahitantsoa and source_draft is not None:
        from apps.documents.commercial import build_reservation_draft_commercial_document_context

        reservation_context = build_reservation_draft_commercial_document_context(
            reservation_draft=source_draft,
            template_key=template_key,
        ).reservation_draft

    return ExcessReceivableInvoiceContext(
        template=ExcessReceivableInvoiceTemplateContext.from_definition(template_definition),
        excess_receivable=ExcessReceivableContext(
            reservation_public_reference=public_ref,
            reservation_status=status_val,
            customer_display_name=customer.display_name if customer is not None else "",
            customer_email=customer.email if customer is not None else "",
            customer_phone=customer.phone if customer is not None else "",
            customer_address=customer.address if customer is not None else "",
            start_at=start_at,
            lines=tuple(lines_context),
            total_amount=total_amount_str,
            caution_amount=caution_amount_str,
            remaining_due=remaining_due_str,
            due_date=due_date,
            total_amount_in_words=total_words,
        ),
        reservation_draft=reservation_context,
        event_draft=event_context,
    )
