"""Commercial document context value objects.

F126BC is intentionally backend-only and side-effect free. It prepares a stable
commercial document context from an existing reservation draft and template
definition, without creating documents, payments, invoices, receipts, inventory
blocks, endpoints, serializers, views, migrations, or frontend behavior.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from apps.documents.registry import (
    DocumentTemplateDefinition,
    get_document_template_definition,
)
from apps.reservations.models import (
    ReservationDraft,
    ReservationDraftLine,
    ReservationDraftStatus,
)

UNKNOWN_COMMERCIAL_DOCUMENT_TEMPLATE_KEY = "unknown_commercial_document_template_key"


class CommercialDocumentContextError(ValueError):
    def __init__(self, message: str, *, code: str) -> None:
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class CommercialDocumentTemplateContext:
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
    ) -> CommercialDocumentTemplateContext:
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
class CommercialDocumentCustomerContext:
    customer_id: object
    display_name: str
    email: str
    phone: str
    address: str


@dataclass(frozen=True)
class CommercialDocumentLineContext:
    reservation_draft_line_id: object
    inventory_item_id: object
    inventory_item_name: str
    inventory_item_kind: str
    inventory_item_description: str
    quantity: int
    notes: str


@dataclass(frozen=True)
class CommercialDocumentReservationContext:
    reservation_draft_id: object
    public_reference: str
    status: str
    customer: CommercialDocumentCustomerContext
    start_at: datetime
    end_at: datetime
    notes: str
    lines: tuple[CommercialDocumentLineContext, ...]
    created_at: datetime
    updated_at: datetime


@dataclass(frozen=True)
class CommercialDocumentRuntimeScopeFlags:
    pdf_runtime_generated: bool
    inventory_blocked: bool
    payment_created: bool
    invoice_created: bool
    contract_created: bool


@dataclass(frozen=True)
class CommercialDocumentReservationMarkerFlags:
    contract_signed_marker_present: bool
    required_deposit_received_marker_present: bool
    reservation_confirmed: bool
    reservation_cancelled: bool


@dataclass(frozen=True)
class CommercialDocumentContext:
    template: CommercialDocumentTemplateContext
    reservation_draft: CommercialDocumentReservationContext
    runtime_scope_flags: CommercialDocumentRuntimeScopeFlags
    reservation_marker_flags: CommercialDocumentReservationMarkerFlags


def _active_reservation_draft_lines(
    *,
    reservation_draft: ReservationDraft,
) -> tuple[ReservationDraftLine, ...]:
    return tuple(
        reservation_draft.lines.filter(is_deleted=False)
        .select_related("inventory_item")
        .order_by("created_at", "id")
    )


def _build_customer_context(
    *,
    reservation_draft: ReservationDraft,
) -> CommercialDocumentCustomerContext:
    customer = reservation_draft.customer

    return CommercialDocumentCustomerContext(
        customer_id=reservation_draft.customer_id,
        display_name=customer.display_name,
        email=customer.email or "",
        phone=customer.phone or "",
        address=customer.address or "",
    )


def _build_line_context(
    *,
    line: ReservationDraftLine,
) -> CommercialDocumentLineContext:
    inventory_item = line.inventory_item

    return CommercialDocumentLineContext(
        reservation_draft_line_id=line.id,
        inventory_item_id=line.inventory_item_id,
        inventory_item_name=inventory_item.name,
        inventory_item_kind=inventory_item.kind,
        inventory_item_description=inventory_item.description or "",
        quantity=line.quantity,
        notes=line.notes or "",
    )


def _is_marker_complete(*, timestamp: object | None, actor_id: object | None) -> bool:
    return timestamp is not None and actor_id is not None


def _build_runtime_scope_flags() -> CommercialDocumentRuntimeScopeFlags:
    return CommercialDocumentRuntimeScopeFlags(
        pdf_runtime_generated=False,
        inventory_blocked=False,
        payment_created=False,
        invoice_created=False,
        contract_created=False,
    )


def _build_reservation_marker_flags(
    *,
    reservation_draft: ReservationDraft,
) -> CommercialDocumentReservationMarkerFlags:
    contract_signed = _is_marker_complete(
        timestamp=reservation_draft.contract_signed_at,
        actor_id=reservation_draft.contract_signed_by_id,
    )
    required_deposit_received = _is_marker_complete(
        timestamp=reservation_draft.required_deposit_received_at,
        actor_id=reservation_draft.required_deposit_received_by_id,
    )
    reservation_confirmed = (
        reservation_draft.status == ReservationDraftStatus.CONFIRMED
        and _is_marker_complete(
            timestamp=reservation_draft.confirmed_at,
            actor_id=reservation_draft.confirmed_by_id,
        )
    )
    reservation_cancelled = (
        reservation_draft.status == ReservationDraftStatus.CANCELLED
        and _is_marker_complete(
            timestamp=reservation_draft.cancelled_at,
            actor_id=reservation_draft.cancelled_by_id,
        )
    )

    return CommercialDocumentReservationMarkerFlags(
        contract_signed_marker_present=contract_signed,
        required_deposit_received_marker_present=required_deposit_received,
        reservation_confirmed=reservation_confirmed,
        reservation_cancelled=reservation_cancelled,
    )


def build_reservation_draft_commercial_document_context(
    *,
    reservation_draft: ReservationDraft,
    template_key: str,
) -> CommercialDocumentContext:
    template_definition = get_document_template_definition(template_key)
    if template_definition is None:
        raise CommercialDocumentContextError(
            f"Unknown commercial document template key: {template_key}",
            code=UNKNOWN_COMMERCIAL_DOCUMENT_TEMPLATE_KEY,
        )

    active_lines = _active_reservation_draft_lines(reservation_draft=reservation_draft)

    return CommercialDocumentContext(
        template=CommercialDocumentTemplateContext.from_definition(template_definition),
        reservation_draft=CommercialDocumentReservationContext(
            reservation_draft_id=reservation_draft.id,
            public_reference=reservation_draft.public_reference,
            status=reservation_draft.status,
            customer=_build_customer_context(reservation_draft=reservation_draft),
            start_at=reservation_draft.start_at,
            end_at=reservation_draft.end_at,
            notes=reservation_draft.notes or "",
            lines=tuple(_build_line_context(line=line) for line in active_lines),
            created_at=reservation_draft.created_at,
            updated_at=reservation_draft.updated_at,
        ),
        runtime_scope_flags=_build_runtime_scope_flags(),
        reservation_marker_flags=_build_reservation_marker_flags(
            reservation_draft=reservation_draft,
        ),
    )
