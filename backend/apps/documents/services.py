from __future__ import annotations

from datetime import timedelta

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from apps.audit.services import record_audit_event_on_commit
from apps.documents.commercial import (
    CommercialDocumentContext,
    CommercialDocumentContextError,
    build_reservation_draft_commercial_document_context,
)
from apps.documents.models import DocumentInstance, DocumentInstanceStatus
from apps.documents.pdf import (
    DocumentPDFGenerationError,
    build_pdf_artifact_storage_path,
    calculate_pdf_checksum,
    get_pdf_generator,
)
from apps.documents.runtime import generate_document_instance_html
from apps.documents.selectors import get_document_instance_by_id
from apps.finance.models import FinanceBankProfile
from apps.finance.services import get_default_finance_bank_profile
from apps.hahitantsoa.models import HahitantsoaEventDraft
from apps.reservations.models import ReservationDraft

TITAN_PROFORMA_TEMPLATE_KEY = "titan.proforma.v1"
HAHITANTSOA_PROFORMA_TEMPLATE_KEY = "hahitantsoa.proforma.v1"
DEFAULT_PROFORMA_VALIDITY_DAYS = 15
HAHITANTSOA_CONTRACT_TEMPLATE_KEY = "hahitantsoa.contract.v1"
CONTRACT_TEMPLATE_KEY_BY_PROFORMA_SCOPE = {
    "hahitantsoa": HAHITANTSOA_CONTRACT_TEMPLATE_KEY,
    "titan": "titan.material_contract.v1",
}
SUPPORTED_RESERVATION_DRAFT_DOCUMENT_TEMPLATE_KEYS = (
    "titan.proforma.v1",
    "titan.delivery_note.v1",
    "titan.material_contract.v1",
    "titan.material_amendment.v1",
    "titan.invoice.v1",
    "shared.return_note.v1",
    "shared.preparation_sheet.v1",
    "shared.internal_release_note.v1",
    "shared.supplier_purchase_order.v1",
    "shared.breakage_repair_invoice.v1",
    "shared.damage_loss_excess_invoice.v1",
)
SUPPORTED_HAHITANTSOA_EVENT_DRAFT_DOCUMENT_TEMPLATE_KEYS = (
    HAHITANTSOA_PROFORMA_TEMPLATE_KEY,
    HAHITANTSOA_CONTRACT_TEMPLATE_KEY,
    "hahitantsoa.contract_amendment.v1",
    "hahitantsoa.invoice.v1",
    "hahitantsoa.liability_release.v1",
    "hahitantsoa.delivery_note.v1",
    "hahitantsoa.preparation_sheet.v1",
    "shared.return_note.v1",
    "shared.preparation_sheet.v1",
    "shared.internal_release_note.v1",
    "shared.supplier_purchase_order.v1",
    "shared.breakage_repair_invoice.v1",
    "shared.damage_loss_excess_invoice.v1",
)
UNSUPPORTED_RESERVATION_DRAFT_DOCUMENT_TEMPLATE_KEY = (
    "unsupported_reservation_draft_document_template_key"
)


class ProformaActionError(ValueError):
    """Raised when a proforma cannot be converted or voided safely."""

    def __init__(self, message: str, *, code: str) -> None:
        super().__init__(message)
        self.code = code


def _get_locked_document_instance(*, document_instance_id) -> DocumentInstance:
    # The draft links are nullable: select_related() would create outer joins that
    # PostgreSQL correctly refuses to lock. The source document row is the
    # idempotency boundary, so lock only that row and load its link lazily.
    instance = DocumentInstance.objects.select_for_update().filter(id=document_instance_id).first()
    if instance is None:
        raise DocumentInstance.DoesNotExist
    return instance


def _get_contract_template_key_for_proforma(*, instance: DocumentInstance) -> str:
    from apps.documents.registry import get_document_template_definition

    template = get_document_template_definition(instance.template_key)
    if (
        template is None
        or template.document_type != "proforma"
        or template.business_scope != instance.business_scope
        or instance.document_type != "proforma"
    ):
        raise ProformaActionError(
            "Only registered proforma documents can use this action.",
            code="invalid_proforma_document",
        )

    contract_template_key = CONTRACT_TEMPLATE_KEY_BY_PROFORMA_SCOPE.get(template.business_scope)
    if contract_template_key is None:
        raise ProformaActionError(
            "This proforma business scope has no contract template.",
            code="proforma_contract_template_missing",
        )
    return contract_template_key


def _validate_convertible_proforma(*, instance: DocumentInstance) -> str:
    contract_template_key = _get_contract_template_key_for_proforma(instance=instance)
    if instance.status == DocumentInstanceStatus.VOIDED:
        raise ProformaActionError(
            "Cannot convert a voided proforma to a contract.", code="proforma_voided"
        )
    if instance.issued_at is None or instance.valid_until is None:
        raise ProformaActionError(
            "A proforma must be issued as a final PDF before conversion.",
            code="proforma_not_issued",
        )
    if instance.valid_until is not None and instance.valid_until < timezone.now():
        raise ProformaActionError(
            "This proforma has expired and cannot be converted.", code="proforma_expired"
        )
    if instance.reservation_draft_id is None and instance.hahitantsoa_event_draft_id is None:
        raise ProformaActionError(
            "A proforma must be linked to a draft before conversion.",
            code="proforma_draft_missing",
        )
    return contract_template_key


def _converted_contract_for_proforma(
    *,
    instance: DocumentInstance,
    contract_template_key: str,
) -> DocumentInstance | None:
    conversion_note = f"Converted from proforma {instance.id}"
    source_filter = (
        Q(reservation_draft_id=instance.reservation_draft_id)
        if instance.reservation_draft_id is not None
        else Q(hahitantsoa_event_draft_id=instance.hahitantsoa_event_draft_id)
    )
    return (
        DocumentInstance.objects.filter(
            source_filter,
            template_key=contract_template_key,
            notes=conversion_note,
        )
        .order_by("created_at", "id")
        .first()
    )


@transaction.atomic
def prepare_contract_from_proforma(
    *,
    document_instance_id,
    actor: object | None,
) -> tuple[DocumentInstance, bool]:
    """Prepare the scope-correct contract for a proforma without confirmation."""

    instance = _get_locked_document_instance(document_instance_id=document_instance_id)
    contract_template_key = _validate_convertible_proforma(instance=instance)
    existing_contract = _converted_contract_for_proforma(
        instance=instance,
        contract_template_key=contract_template_key,
    )
    if existing_contract is not None:
        return existing_contract, False

    conversion_note = f"Converted from proforma {instance.id}"
    # ponytail: locking the source row serializes repeated conversions without a schema change.
    if instance.reservation_draft_id is not None:
        contract = create_document_instance_from_reservation_draft(
            reservation_draft=instance.reservation_draft,
            template_key=contract_template_key,
            actor=actor,
            notes=conversion_note,
        )
    else:
        contract = create_document_instance_from_hahitantsoa_event_draft(
            event_draft=instance.hahitantsoa_event_draft,
            template_key=contract_template_key,
            actor=actor,
            notes=conversion_note,
        )

    record_audit_event_on_commit(
        actor=actor,
        action="document.proforma_converted_to_contract",
        target_type="document_instance",
        target_id=str(instance.id),
        metadata={
            "source_instance_id": str(instance.id),
            "new_instance_id": str(contract.id),
            "contract_template_key": contract_template_key,
        },
    )
    return contract, True


@transaction.atomic
def void_proforma(
    *, document_instance_id, actor: object | None, reason: str = ""
) -> DocumentInstance:
    instance = _get_locked_document_instance(document_instance_id=document_instance_id)
    _get_contract_template_key_for_proforma(instance=instance)
    if instance.status == DocumentInstanceStatus.VOIDED:
        raise ProformaActionError(
            "This proforma is already voided.", code="proforma_already_voided"
        )

    instance.status = DocumentInstanceStatus.VOIDED
    instance.voided_at = timezone.now()
    instance.voided_by = actor
    instance.void_reason = reason
    instance.save(update_fields=["status", "voided_at", "voided_by", "void_reason", "updated_at"])
    record_audit_event_on_commit(
        actor=actor,
        action="document.proforma_voided",
        target_type="document_instance",
        target_id=str(instance.id),
        metadata={"template_key": instance.template_key, "reason": instance.void_reason},
    )
    return instance


def get_supported_reservation_draft_document_template_keys() -> tuple[str, ...]:
    return SUPPORTED_RESERVATION_DRAFT_DOCUMENT_TEMPLATE_KEYS


def validate_supported_reservation_draft_document_template_key(template_key: str) -> None:
    if template_key in SUPPORTED_RESERVATION_DRAFT_DOCUMENT_TEMPLATE_KEYS:
        return

    raise CommercialDocumentContextError(
        f"Unsupported reservation draft document template key: {template_key}",
        code=UNSUPPORTED_RESERVATION_DRAFT_DOCUMENT_TEMPLATE_KEY,
    )


def validate_supported_hahitantsoa_event_draft_document_template_key(template_key: str) -> None:
    if template_key in SUPPORTED_HAHITANTSOA_EVENT_DRAFT_DOCUMENT_TEMPLATE_KEYS:
        return

    raise CommercialDocumentContextError(
        f"Unsupported Hahitantsoa event draft document template key: {template_key}",
        code="unsupported_hahitantsoa_event_draft_document_template_key",
    )


def active_reservation_drafts_for_commercial_document_context():
    return (
        ReservationDraft.objects.filter(is_deleted=False)
        .select_related("customer")
        .prefetch_related("lines__inventory_item")
        .order_by("-created_at", "public_reference")
    )


def get_reservation_draft_commercial_document_context_service(
    *,
    reservation_draft_id,
    template_key: str,
) -> CommercialDocumentContext:
    reservation_draft = (
        active_reservation_drafts_for_commercial_document_context()
        .filter(id=reservation_draft_id)
        .first()
    )
    if reservation_draft is None:
        raise ReservationDraft.DoesNotExist

    return build_reservation_draft_commercial_document_context(
        reservation_draft=reservation_draft,
        template_key=template_key,
    )


def commercial_document_context_to_titan_proforma_preview_payload(
    *,
    context: CommercialDocumentContext,
) -> dict[str, object]:
    return {
        "document_type": context.template.document_type,
        "business_scope": context.template.business_scope,
        "template_key": context.template.key,
        "template": {
            "key": context.template.key,
            "business_scope": context.template.business_scope,
            "document_type": context.template.document_type,
            "label": context.template.label,
            "version": context.template.version,
            "status": context.template.status,
            "source_kind": context.template.source_kind,
            "source_reference": context.template.source_reference,
            "template_path": context.template.template_path,
            "preview_path": context.template.preview_path,
            "validated_by_client": context.template.validated_by_client,
            "notes": context.template.notes,
        },
        "reservation_draft": {
            "id": context.reservation_draft.reservation_draft_id,
            "public_reference": context.reservation_draft.public_reference,
            "status": context.reservation_draft.status,
            "customer_id": context.reservation_draft.customer.customer_id,
            "customer_display_name": context.reservation_draft.customer.display_name,
            "start_at": context.reservation_draft.start_at,
            "end_at": context.reservation_draft.end_at,
            "notes": context.reservation_draft.notes,
            "lines": [
                {
                    "id": line.reservation_draft_line_id,
                    "inventory_item_id": line.inventory_item_id,
                    "inventory_item_name": line.inventory_item_name,
                    "inventory_item_kind": line.inventory_item_kind,
                    "quantity": line.quantity,
                    "notes": line.notes,
                }
                for line in context.reservation_draft.lines
            ],
            "created_at": context.reservation_draft.created_at,
            "updated_at": context.reservation_draft.updated_at,
        },
        "scope_flags": {
            "pdf_runtime_generated": context.runtime_scope_flags.pdf_runtime_generated,
            "reservation_confirmed": False,
            "inventory_blocked": context.runtime_scope_flags.inventory_blocked,
            "payment_created": context.runtime_scope_flags.payment_created,
            "invoice_created": context.runtime_scope_flags.invoice_created,
            "contract_created": context.runtime_scope_flags.contract_created,
        },
    }


def get_titan_proforma_draft_preview_payload_service(
    *,
    reservation_draft_id,
) -> dict[str, object]:
    context = get_reservation_draft_commercial_document_context_service(
        reservation_draft_id=reservation_draft_id,
        template_key=TITAN_PROFORMA_TEMPLATE_KEY,
    )
    return commercial_document_context_to_titan_proforma_preview_payload(context=context)


def commercial_document_context_to_document_instance_kwargs(
    *,
    reservation_draft: ReservationDraft,
    context: CommercialDocumentContext,
    actor_id: object | None,
    notes: str,
    proforma_validity_days: int | None = None,
    bank_profile: FinanceBankProfile | None = None,
    document_date=None,
) -> dict[str, object]:
    bank_profile = bank_profile or get_default_finance_bank_profile(
        business_scope=context.template.business_scope
    )
    if (
        bank_profile is not None
        and bank_profile.account.business_scope != context.template.business_scope
    ):
        raise CommercialDocumentContextError(
            "The selected bank does not belong to the document business scope.",
            code="bank_scope_mismatch",
        )
    return {
        "reservation_draft": reservation_draft,
        "customer": reservation_draft.customer,
        "template_key": context.template.key,
        "template_version": context.template.version,
        "template_label": context.template.label,
        "business_scope": context.template.business_scope,
        "document_type": context.template.document_type,
        "template_status": context.template.status,
        "template_source_kind": context.template.source_kind,
        "template_source_reference": context.template.source_reference,
        "template_path": context.template.template_path,
        "template_preview_path": context.template.preview_path,
        "template_validated_by_client": context.template.validated_by_client,
        "template_notes": context.template.notes,
        "reservation_public_reference": context.reservation_draft.public_reference,
        "reservation_status": context.reservation_draft.status,
        "customer_display_name": context.reservation_draft.customer.display_name,
        "customer_party_type": context.reservation_draft.customer.party_type,
        "customer_email": context.reservation_draft.customer.email,
        "customer_phone": context.reservation_draft.customer.phone,
        "customer_address": context.reservation_draft.customer.address,
        "customer_civilite": context.reservation_draft.customer.civilite,
        "customer_birth_date": context.reservation_draft.customer.birth_date,
        "customer_birth_place": context.reservation_draft.customer.birth_place,
        "customer_id_type": context.reservation_draft.customer.id_type,
        "customer_id_number": context.reservation_draft.customer.id_number,
        "customer_id_issue_date": context.reservation_draft.customer.id_issue_date,
        "customer_id_issue_place": context.reservation_draft.customer.id_issue_place,
        "customer_id_duplicata_date": context.reservation_draft.customer.id_duplicata_date,
        "customer_id_duplicata_place": context.reservation_draft.customer.id_duplicata_place,
        "customer_nif": context.reservation_draft.customer.nif,
        "customer_stat": context.reservation_draft.customer.stat,
        "customer_rcs": context.reservation_draft.customer.rcs,
        "customer_representative_name": context.reservation_draft.customer.representative_name,
        "customer_representative_role": context.reservation_draft.customer.representative_role,
        "bank_profile": bank_profile,
        "bank_name": bank_profile.bank_name if bank_profile else "",
        "bank_branch": bank_profile.branch if bank_profile else "",
        "bank_account_holder": bank_profile.account_holder if bank_profile else "",
        "bank_account_number": bank_profile.account_number if bank_profile else "",
        "bank_rib": bank_profile.rib if bank_profile else "",
        "bank_iban": bank_profile.iban if bank_profile else "",
        "bank_swift_bic": bank_profile.swift_bic if bank_profile else "",
        "status": "prepared",
        "prepared_at": timezone.now(),
        "prepared_by_id": actor_id,
        "proforma_validity_days": (
            proforma_validity_days if context.template.document_type == "proforma" else None
        ),
        "document_date": document_date,
        "notes": notes,
    }


def hahitantsoa_event_draft_document_instance_kwargs(
    *,
    event_draft: HahitantsoaEventDraft,
    template_key: str,
    actor_id: object | None,
    notes: str,
    proforma_validity_days: int | None = None,
    bank_profile: FinanceBankProfile | None = None,
    document_date=None,
) -> dict[str, object]:
    from apps.documents.registry import get_document_template_definition

    template_definition = get_document_template_definition(template_key)
    if template_definition is None:
        raise CommercialDocumentContextError(
            f"Unknown commercial document template key: {template_key}",
            code="unknown_commercial_document_template_key",
        )
    bank_profile = bank_profile or get_default_finance_bank_profile(
        business_scope=template_definition.business_scope
    )
    if (
        bank_profile is not None
        and bank_profile.account.business_scope != template_definition.business_scope
    ):
        raise CommercialDocumentContextError(
            "The selected bank does not belong to the document business scope.",
            code="bank_scope_mismatch",
        )

    return {
        "hahitantsoa_event_draft": event_draft,
        "customer": event_draft.customer,
        "template_key": template_definition.key,
        "template_version": template_definition.version,
        "template_label": template_definition.label,
        "business_scope": template_definition.business_scope,
        "document_type": template_definition.document_type,
        "template_status": template_definition.status,
        "template_source_kind": template_definition.source_kind,
        "template_source_reference": template_definition.source_reference,
        "template_path": template_definition.template_path,
        "template_preview_path": template_definition.preview_path,
        "template_validated_by_client": template_definition.validated_by_client,
        "template_notes": template_definition.notes,
        "reservation_public_reference": event_draft.public_reference,
        "reservation_status": event_draft.status,
        "customer_display_name": event_draft.customer.display_name,
        "customer_party_type": event_draft.customer.party_type,
        "customer_email": event_draft.customer.email,
        "customer_phone": event_draft.customer.phone,
        "customer_address": event_draft.customer.address,
        "customer_civilite": event_draft.customer.civilite,
        "customer_birth_date": event_draft.customer.birth_date,
        "customer_birth_place": event_draft.customer.birth_place,
        "customer_id_type": event_draft.customer.id_type,
        "customer_id_number": event_draft.customer.id_number,
        "customer_id_issue_date": event_draft.customer.id_issue_date,
        "customer_id_issue_place": event_draft.customer.id_issue_place,
        "customer_id_duplicata_date": event_draft.customer.id_duplicata_date,
        "customer_id_duplicata_place": event_draft.customer.id_duplicata_place,
        "customer_nif": event_draft.customer.nif,
        "customer_stat": event_draft.customer.stat,
        "customer_rcs": event_draft.customer.rcs,
        "customer_representative_name": event_draft.customer.representative_name,
        "customer_representative_role": event_draft.customer.representative_role,
        "bank_profile": bank_profile,
        "bank_name": bank_profile.bank_name if bank_profile else "",
        "bank_branch": bank_profile.branch if bank_profile else "",
        "bank_account_holder": bank_profile.account_holder if bank_profile else "",
        "bank_account_number": bank_profile.account_number if bank_profile else "",
        "bank_rib": bank_profile.rib if bank_profile else "",
        "bank_iban": bank_profile.iban if bank_profile else "",
        "bank_swift_bic": bank_profile.swift_bic if bank_profile else "",
        "status": "prepared",
        "prepared_at": timezone.now(),
        "prepared_by_id": actor_id,
        "proforma_validity_days": (
            proforma_validity_days if template_definition.document_type == "proforma" else None
        ),
        "document_date": document_date,
        "notes": notes,
    }


@transaction.atomic
def create_document_instance_from_reservation_draft(
    *,
    reservation_draft: ReservationDraft,
    template_key: str,
    actor: object | None = None,
    notes: str = "",
    proforma_validity_days: int | None = None,
    bank_profile: FinanceBankProfile | None = None,
    document_date=None,
    amendment_sequence: int | None = None,
    amendment_source_document_id=None,
) -> DocumentInstance:
    context = build_reservation_draft_commercial_document_context(
        reservation_draft=reservation_draft,
        template_key=template_key,
    )
    validate_supported_reservation_draft_document_template_key(template_key)
    if document_date is not None and context.template.document_type != "delivery_note":
        raise CommercialDocumentContextError(
            "Document date can only be set for delivery notes.", code="document_date_not_applicable"
        )
    if context.template.document_type == "delivery_note" and document_date is None:
        document_date = timezone.localtime(reservation_draft.start_at).date() - timedelta(days=1)
    if context.template.document_type == "proforma":
        if proforma_validity_days is None:
            proforma_validity_days = DEFAULT_PROFORMA_VALIDITY_DAYS
        elif not 1 <= proforma_validity_days <= 365:
            raise CommercialDocumentContextError(
                "Proforma validity must be between 1 and 365 calendar days.",
                code="invalid_proforma_validity_days",
            )
    elif proforma_validity_days is not None:
        raise CommercialDocumentContextError(
            "Proforma validity can only be set for proforma documents.",
            code="proforma_validity_not_applicable",
        )
    actor_id = getattr(actor, "pk", None)

    instance = DocumentInstance.objects.create(
        **commercial_document_context_to_document_instance_kwargs(
            reservation_draft=reservation_draft,
            context=context,
            actor_id=actor_id,
            notes=notes,
            proforma_validity_days=proforma_validity_days,
            bank_profile=bank_profile,
            document_date=document_date,
        )
    )
    if amendment_sequence is not None or amendment_source_document_id is not None:
        instance.amendment_sequence = amendment_sequence
        instance.amendment_source_document_id = amendment_source_document_id
        instance.save(
            update_fields=[
                "amendment_sequence",
                "amendment_source_document_id",
                "updated_at",
            ]
        )
    record_audit_event_on_commit(
        actor=actor,
        action="document.instance_prepared",
        target_type="document_instance",
        target_id=str(instance.id),
        metadata={
            "reservation_draft_id": str(reservation_draft.id),
            "template_key": template_key,
            "status": instance.status,
        },
    )
    return instance


def get_reservation_draft_document_instance_or_404(
    *,
    reservation_draft: ReservationDraft,
    document_instance_id,
) -> DocumentInstance:
    instance = get_document_instance_by_id(document_instance_id=document_instance_id)
    if instance is None or instance.reservation_draft_id != reservation_draft.id:
        raise DocumentInstance.DoesNotExist
    return instance


@transaction.atomic
def create_document_instance_from_hahitantsoa_event_draft(
    *,
    event_draft: HahitantsoaEventDraft,
    template_key: str,
    actor: object | None = None,
    notes: str = "",
    proforma_validity_days: int | None = None,
    bank_profile: FinanceBankProfile | None = None,
    document_date=None,
    amendment_sequence: int | None = None,
    amendment_source_document_id=None,
) -> DocumentInstance:
    validate_supported_hahitantsoa_event_draft_document_template_key(template_key)
    if document_date is not None and template_key != "hahitantsoa.delivery_note.v1":
        raise CommercialDocumentContextError(
            "Document date can only be set for delivery notes.", code="document_date_not_applicable"
        )
    if template_key == "hahitantsoa.delivery_note.v1" and document_date is None:
        document_date = timezone.localtime(event_draft.start_at).date() - timedelta(days=1)
    if template_key == HAHITANTSOA_PROFORMA_TEMPLATE_KEY:
        if proforma_validity_days is None:
            proforma_validity_days = DEFAULT_PROFORMA_VALIDITY_DAYS
        elif not 1 <= proforma_validity_days <= 365:
            raise CommercialDocumentContextError(
                "Proforma validity must be between 1 and 365 calendar days.",
                code="invalid_proforma_validity_days",
            )
    elif proforma_validity_days is not None:
        raise CommercialDocumentContextError(
            "Proforma validity can only be set for proforma documents.",
            code="proforma_validity_not_applicable",
        )
    actor_id = getattr(actor, "pk", None)
    instance = DocumentInstance.objects.create(
        **hahitantsoa_event_draft_document_instance_kwargs(
            event_draft=event_draft,
            template_key=template_key,
            actor_id=actor_id,
            notes=notes,
            proforma_validity_days=proforma_validity_days,
            bank_profile=bank_profile,
            document_date=document_date,
        )
    )
    if amendment_sequence is not None or amendment_source_document_id is not None:
        instance.amendment_sequence = amendment_sequence
        instance.amendment_source_document_id = amendment_source_document_id
        instance.save(
            update_fields=[
                "amendment_sequence",
                "amendment_source_document_id",
                "updated_at",
            ]
        )
    record_audit_event_on_commit(
        actor=actor,
        action="document.instance_prepared",
        target_type="document_instance",
        target_id=str(instance.id),
        metadata={
            "hahitantsoa_event_draft_id": str(event_draft.id),
            "template_key": template_key,
            "status": instance.status,
        },
    )
    return instance


def get_hahitantsoa_event_draft_document_instance_or_404(
    *,
    event_draft: HahitantsoaEventDraft,
    document_instance_id,
) -> DocumentInstance:
    instance = get_document_instance_by_id(document_instance_id=document_instance_id)
    if instance is None or instance.hahitantsoa_event_draft_id != event_draft.id:
        raise DocumentInstance.DoesNotExist
    return instance


@transaction.atomic
def generate_reservation_draft_document_instance_html(
    *,
    reservation_draft: ReservationDraft,
    document_instance_id,
    actor: object | None = None,
) -> DocumentInstance:
    instance = get_reservation_draft_document_instance_or_404(
        reservation_draft=reservation_draft,
        document_instance_id=document_instance_id,
    )
    result = generate_document_instance_html(document_instance=instance, actor=actor)
    record_audit_event_on_commit(
        actor=actor,
        action="document.instance_generated",
        target_type="document_instance",
        target_id=str(instance.id),
        metadata={
            "reservation_draft_id": str(reservation_draft.id),
            "template_key": instance.template_key,
            "status": instance.status,
            "content_checksum": result.content_checksum,
        },
    )
    return result.document_instance


@transaction.atomic
def generate_hahitantsoa_event_draft_document_instance_html(
    *,
    event_draft: HahitantsoaEventDraft,
    document_instance_id,
    actor: object | None = None,
) -> DocumentInstance:
    instance = get_hahitantsoa_event_draft_document_instance_or_404(
        event_draft=event_draft,
        document_instance_id=document_instance_id,
    )
    result = generate_document_instance_html(document_instance=instance, actor=actor)
    record_audit_event_on_commit(
        actor=actor,
        action="document.instance_generated",
        target_type="document_instance",
        target_id=str(instance.id),
        metadata={
            "hahitantsoa_event_draft_id": str(event_draft.id),
            "template_key": instance.template_key,
            "status": instance.status,
            "content_checksum": result.content_checksum,
        },
    )
    return result.document_instance


@transaction.atomic
def ensure_reservation_draft_preparation_document(
    *,
    reservation_draft: ReservationDraft,
    actor: object | None = None,
) -> DocumentInstance:
    """Create and emit the internal preparation sheet exactly once for a reservation."""
    preparation = (
        DocumentInstance.objects.select_for_update()
        .filter(
            reservation_draft=reservation_draft,
            template_key="shared.preparation_sheet.v1",
            status__in=(
                DocumentInstanceStatus.PREPARED,
                DocumentInstanceStatus.GENERATED,
                DocumentInstanceStatus.ISSUED,
            ),
        )
        .order_by("created_at", "id")
        .first()
    )
    if preparation is None:
        preparation = create_document_instance_from_reservation_draft(
            reservation_draft=reservation_draft,
            template_key="shared.preparation_sheet.v1",
            actor=actor,
            notes="Bon de préparation interne généré avec le bon de livraison.",
        )
    if preparation.status == DocumentInstanceStatus.PREPARED:
        preparation = generate_reservation_draft_document_instance_html(
            reservation_draft=reservation_draft,
            document_instance_id=preparation.id,
            actor=actor,
        )
    if preparation.pdf_storage_path is None:
        preparation = generate_document_instance_pdf(document_instance=preparation, actor=actor)
    return preparation


@transaction.atomic
def ensure_hahitantsoa_preparation_document(
    *,
    event_draft: HahitantsoaEventDraft,
    actor: object | None = None,
) -> DocumentInstance:
    """Create and emit the Hahitantsoa checking sheet exactly once."""
    preparation = (
        DocumentInstance.objects.select_for_update()
        .filter(
            hahitantsoa_event_draft=event_draft,
            template_key="hahitantsoa.preparation_sheet.v1",
            status__in=(
                DocumentInstanceStatus.PREPARED,
                DocumentInstanceStatus.GENERATED,
                DocumentInstanceStatus.ISSUED,
            ),
        )
        .order_by("created_at", "id")
        .first()
    )
    if preparation is None:
        preparation = create_document_instance_from_hahitantsoa_event_draft(
            event_draft=event_draft,
            template_key="hahitantsoa.preparation_sheet.v1",
            actor=actor,
            notes="Checklist manuelle Hahitantsoa générée avec le bon de livraison.",
        )
    if preparation.status == DocumentInstanceStatus.PREPARED:
        preparation = generate_hahitantsoa_event_draft_document_instance_html(
            event_draft=event_draft,
            document_instance_id=preparation.id,
            actor=actor,
        )
    if preparation.pdf_storage_path is None:
        preparation = generate_document_instance_pdf(document_instance=preparation, actor=actor)
    return preparation


@transaction.atomic
def generate_document_instance_pdf(
    *,
    document_instance: DocumentInstance,
    actor: object | None = None,
) -> DocumentInstance:
    """Generate a PDF artifact from an already-generated HTML document instance.

    Requires the document instance to be in ``GENERATED`` status and to have
    a stored HTML artifact. The resulting PDF is written to default storage
    and the instance is updated with PDF metadata.
    """
    from django.core.files.base import ContentFile
    from django.core.files.storage import default_storage

    locked_instance = _get_locked_document_instance(document_instance_id=document_instance.id)

    if (
        locked_instance.document_type == "proforma"
        and locked_instance.issued_at is not None
        and locked_instance.valid_until is not None
        and locked_instance.pdf_storage_path
        and locked_instance.pdf_generated_at is not None
        and locked_instance.pdf_content_checksum
    ):
        return locked_instance

    if locked_instance.status != DocumentInstanceStatus.GENERATED:
        raise DocumentPDFGenerationError(
            f"Cannot generate PDF from document status: {locked_instance.status}",
            code="invalid_document_status_for_pdf_generation",
        )

    if not locked_instance.storage_path:
        raise DocumentPDFGenerationError(
            "Document instance has no stored HTML artifact.",
            code="document_html_artifact_missing",
        )

    # Read existing HTML content from storage
    if not default_storage.exists(locked_instance.storage_path):
        raise DocumentPDFGenerationError(
            "Stored HTML artifact does not exist.",
            code="document_html_artifact_not_found",
        )

    html_content = default_storage.open(locked_instance.storage_path).read().decode("utf-8")
    if not html_content or not html_content.strip():
        raise DocumentPDFGenerationError(
            "Stored HTML content is empty.",
            code="document_html_content_empty",
        )

    # Generate PDF via configured generator
    generator = get_pdf_generator()
    pdf_bytes = generator.generate_pdf(html_content)
    if not pdf_bytes:
        raise DocumentPDFGenerationError(
            "PDF generator returned empty content.",
            code="pdf_generator_empty_output",
        )

    checksum = calculate_pdf_checksum(pdf_bytes)
    pdf_path = build_pdf_artifact_storage_path(locked_instance, checksum)

    # Validate path safety before saving
    if ".." in pdf_path or pdf_path.startswith("/"):
        raise DocumentPDFGenerationError(
            f"Unsafe PDF storage path resolved: {pdf_path}",
            code="unsafe_pdf_storage_path",
        )

    default_storage.save(pdf_path, ContentFile(pdf_bytes))

    issued_at = timezone.now()
    locked_instance.pdf_storage_path = pdf_path
    locked_instance.pdf_generated_at = issued_at
    locked_instance.pdf_content_checksum = checksum
    update_fields = ["pdf_storage_path", "pdf_generated_at", "pdf_content_checksum", "updated_at"]
    if locked_instance.document_type == "proforma":
        validity_days = locked_instance.proforma_validity_days or DEFAULT_PROFORMA_VALIDITY_DAYS
        locked_instance.proforma_validity_days = validity_days
        locked_instance.issued_at = issued_at
        locked_instance.valid_until = issued_at + timedelta(days=validity_days)
        locked_instance.status = DocumentInstanceStatus.ISSUED
        update_fields.extend(["proforma_validity_days", "issued_at", "valid_until", "status"])
    locked_instance.save(update_fields=update_fields)

    record_audit_event_on_commit(
        actor=actor,
        action="document.instance_pdf_generated",
        target_type="document_instance",
        target_id=str(locked_instance.id),
        metadata={
            "template_key": locked_instance.template_key,
            "pdf_storage_path": pdf_path,
            "pdf_content_checksum": checksum,
        },
    )
    return locked_instance
