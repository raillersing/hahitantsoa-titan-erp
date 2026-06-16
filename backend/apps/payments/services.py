from __future__ import annotations

from dataclasses import dataclass

from django.db import transaction
from django.utils import timezone

from apps.audit.services import record_audit_event_on_commit
from apps.documents.models import DocumentInstance
from apps.documents.registry import get_document_template_definition
from apps.documents.runtime import generate_document_instance_html
from apps.payments.models import Payment, PaymentStatus

PAYMENT_RECEIPT_TEMPLATE_KEY = "shared.payment_receipt.v1"


class PaymentLifecycleError(ValueError):
    def __init__(self, message: str, *, code: str) -> None:
        super().__init__(message)
        self.code = code


INVALID_PAYMENT_CONFIRMATION_STATE = "invalid_payment_confirmation_state"
PAYMENT_RECEIPT_TEMPLATE_NOT_FOUND = "payment_receipt_template_not_found"


@dataclass(frozen=True)
class PaymentConfirmationResult:
    payment: Payment
    receipt_document: DocumentInstance


def active_payments():
    return Payment.objects.select_related(
        "reservation_draft",
        "reservation_draft__customer",
        "receipt_document",
        "confirmed_by",
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
    customer = reservation_draft.customer if reservation_draft is not None else None
    customer_display_name = (
        customer.display_name
        if customer is not None
        else (payment.source_label or "Generic payment source")
    )

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
        "reservation_status": reservation_draft.status if reservation_draft is not None else "",
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
