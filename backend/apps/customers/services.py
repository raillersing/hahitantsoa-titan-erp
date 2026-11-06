import hashlib
import json

from django.contrib.auth import get_user_model
from django.core.serializers.json import DjangoJSONEncoder
from django.db import models, transaction
from django.utils import timezone

from apps.audit.services import record_audit_event_on_commit
from apps.customers.models import (
    Customer,
    CustomerContactKind,
    CustomerContactPoint,
    CustomerLifecycleStatus,
    DesiredDateWaitlistEntry,
    DesiredDateWaitlistStatus,
    ProspectStatus,
)


class CustomerCreationConflict(ValueError):
    code = "customer_creation_conflict"


def _replace_customer_contacts(customer, contact_points):
    primary_kinds = {
        contact["kind"] for contact in contact_points if contact.get("is_primary", False)
    }
    normalised = []
    for contact in contact_points:
        contact = dict(contact)
        if contact["kind"] not in primary_kinds:
            contact["is_primary"] = True
            primary_kinds.add(contact["kind"])
        normalised.append(contact)
    CustomerContactPoint.objects.filter(customer=customer).delete()
    CustomerContactPoint.objects.bulk_create(
        CustomerContactPoint(
            customer=customer,
            created_by=customer.updated_by or customer.created_by,
            updated_by=customer.updated_by or customer.created_by,
            **contact,
        )
        for contact in normalised
    )
    contacts = list(customer.contact_points.all())
    for kind, field in ((CustomerContactKind.EMAIL, "email"), (CustomerContactKind.PHONE, "phone")):
        setattr(
            customer,
            field,
            next(
                (point.value for point in contacts if point.kind == kind and point.is_primary), ""
            ),
        )


@transaction.atomic
def create_customer_idempotently(*, values, actor, idempotency_key=""):
    values = dict(values)
    values.pop("idempotency_key", None)
    fingerprint = hashlib.sha256(
        json.dumps(
            values,
            sort_keys=True,
            separators=(",", ":"),
            default=lambda value: (
                str(value.pk)
                if isinstance(value, models.Model)
                else DjangoJSONEncoder().default(value)
            ),
        ).encode("utf-8")
    ).hexdigest()
    if idempotency_key:
        if actor is None:
            raise CustomerCreationConflict("L'opération de création nécessite un utilisateur.")
        # NO KEY UPDATE serializes the actor's creation operations without
        # blocking customer/contact FK checks performed by another writer.
        get_user_model().objects.select_for_update(no_key=True).get(pk=actor.pk)
        existing = (
            Customer.objects.select_for_update()
            .filter(idempotency_actor=actor, idempotency_key=idempotency_key)
            .first()
        )
        if existing is not None:
            if existing.is_deleted or not existing.is_active:
                raise CustomerCreationConflict(
                    "Le client de cette opération est désactivé ou supprimé."
                )
            if not existing.idempotency_fingerprint:
                raise CustomerCreationConflict(
                    "L'empreinte de cette ancienne opération est indisponible. "
                    "Consultez la fiche existante."
                )
            if existing.idempotency_fingerprint != fingerprint:
                raise CustomerCreationConflict(
                    "Cette clé de création a déjà été utilisée avec une autre demande."
                )
            return existing, False
        if Customer.objects.filter(
            idempotency_key=idempotency_key, idempotency_actor__isnull=True
        ).exists():
            raise CustomerCreationConflict(
                "Cette ancienne opération ne peut pas être rejouée automatiquement."
            )
    contacts = values.pop("contact_points", None)
    customer = Customer.objects.create(
        **values,
        created_by=actor,
        updated_by=actor,
        idempotency_key=idempotency_key,
        idempotency_actor=actor if idempotency_key else None,
        idempotency_fingerprint=fingerprint if idempotency_key else "",
    )
    if contacts is not None:
        _replace_customer_contacts(customer, contacts)
        customer.save(update_fields=["email", "phone", "updated_at"])
    return customer, True


@transaction.atomic
def update_customer_record(*, customer, values):
    if {"idempotency_key", "idempotency_actor", "idempotency_fingerprint"}.intersection(values):
        raise CustomerCreationConflict("La clé de création ne peut pas être modifiée.")
    customer = Customer.objects.select_for_update().get(pk=customer.pk)
    values = dict(values)
    contacts = values.pop("contact_points", None)
    for field, value in values.items():
        setattr(customer, field, value)
    if contacts is not None:
        _replace_customer_contacts(customer, contacts)
    customer.save()
    return customer


class DesiredDateWaitlistLifecycleError(ValueError):
    code = "desired_date_waitlist_lifecycle_error"


class CustomerConversionError(ValueError):
    code = "customer_conversion_error"


@transaction.atomic
def create_desired_date_waitlist_entry(
    *, customer: Customer, values: dict, actor: object
) -> DesiredDateWaitlistEntry:
    entry = DesiredDateWaitlistEntry(
        customer=customer,
        created_by=actor,
        updated_by=actor,
        **values,
    )
    entry.full_clean()
    entry.save()
    record_audit_event_on_commit(
        actor=actor,
        action="customer.desired_date_waitlist_created",
        target_type="desired_date_waitlist_entry",
        target_id=str(entry.id),
        metadata={
            "customer_id": str(entry.customer_id),
            "business_scope": entry.business_scope,
            "interest_kind": entry.interest_kind,
            "quantity": entry.quantity,
        },
    )
    return entry


def transition_desired_date_waitlist_entry(
    *, entry: DesiredDateWaitlistEntry, target_status: str, actor: object
) -> DesiredDateWaitlistEntry:
    allowed_targets = {
        DesiredDateWaitlistStatus.NEW: {DesiredDateWaitlistStatus.CONTACTED},
        DesiredDateWaitlistStatus.CONTACTED: {
            DesiredDateWaitlistStatus.CONVERTED,
            DesiredDateWaitlistStatus.LOST,
            DesiredDateWaitlistStatus.CANCELLED,
        },
    }
    with transaction.atomic():
        locked_entry = DesiredDateWaitlistEntry.objects.select_for_update().get(pk=entry.pk)
        if target_status not in allowed_targets.get(locked_entry.status, set()):
            raise DesiredDateWaitlistLifecycleError(
                "This desired-date waitlist status transition is not allowed."
            )
        locked_entry.status = target_status
        locked_entry.updated_by = actor
        locked_entry.full_clean()
        locked_entry.save(update_fields=["status", "updated_by", "updated_at"])
        record_audit_event_on_commit(
            actor=actor,
            action=f"customer.desired_date_waitlist_{target_status}",
            target_type="desired_date_waitlist_entry",
            target_id=str(locked_entry.id),
            metadata={"customer_id": str(locked_entry.customer_id), "status": target_status},
        )
        return locked_entry


# Prospect pipeline transition rules (Lot 1.1)
PROSPECT_VALID_TRANSITIONS: dict[str, set[str]] = {
    ProspectStatus.NEW: {
        ProspectStatus.CONTACT_ATTEMPTED,
        ProspectStatus.CONTACTED,
        ProspectStatus.DISQUALIFIED,
        ProspectStatus.LOST,
    },
    ProspectStatus.CONTACT_ATTEMPTED: {
        ProspectStatus.CONTACTED,
        ProspectStatus.TO_RECALL,
        ProspectStatus.DISQUALIFIED,
        ProspectStatus.LOST,
    },
    ProspectStatus.CONTACTED: {
        ProspectStatus.QUALIFIED,
        ProspectStatus.TO_RECALL,
        ProspectStatus.DISQUALIFIED,
        ProspectStatus.LOST,
    },
    ProspectStatus.QUALIFIED: {
        ProspectStatus.PROFORMA_SENT,
        ProspectStatus.TO_RECALL,
        ProspectStatus.DISQUALIFIED,
        ProspectStatus.LOST,
    },
    ProspectStatus.PROFORMA_SENT: {
        ProspectStatus.CONVERTED,
        ProspectStatus.TO_RECALL,
        ProspectStatus.LOST,
    },
    ProspectStatus.TO_RECALL: {
        ProspectStatus.CONTACT_ATTEMPTED,
        ProspectStatus.QUALIFIED,
        ProspectStatus.PROFORMA_SENT,
        ProspectStatus.DISQUALIFIED,
        ProspectStatus.LOST,
    },
    ProspectStatus.CONVERTED: set(),
    ProspectStatus.DISQUALIFIED: set(),
    ProspectStatus.LOST: {
        ProspectStatus.NEW,  # Reopening requires reason
    },
}


PROSPECT_STATUS_TERMINAL = {
    ProspectStatus.CONVERTED,
    ProspectStatus.DISQUALIFIED,
    ProspectStatus.LOST,
}


class ProspectTransitionError(ValueError):
    code = "prospect_transition_error"


@transaction.atomic
def transition_prospect_status(
    *,
    customer: Customer,
    target_status: str,
    actor: object,
    reason: str = "",
    follow_up_owner: object | None = None,
) -> Customer:
    """Transition a prospect through the CRM pipeline with validation."""
    if customer.lifecycle_status != CustomerLifecycleStatus.PROSPECT:
        raise ProspectTransitionError(
            "Prospect status transitions are only valid for prospects.",
        )

    locked_customer = Customer.objects.select_for_update().get(pk=customer.pk)
    current_status = locked_customer.prospect_status

    if target_status not in PROSPECT_VALID_TRANSITIONS.get(current_status, set()):
        raise ProspectTransitionError(
            f"Transition from {current_status} to {target_status} is not allowed.",
        )

    # Terminal statuses (disqualified / lost) require a reason
    if (
        target_status
        in {
            ProspectStatus.DISQUALIFIED,
            ProspectStatus.LOST,
        }
        and not reason
    ):
        raise ProspectTransitionError(
            f"Transition to '{target_status}' requires a reason.",
        )

    # Reopening a lost prospect requires a reason
    if current_status == ProspectStatus.LOST and target_status == ProspectStatus.NEW and not reason:
        raise ProspectTransitionError(
            "Reopening a lost prospect requires a reason and an audit.",
        )

    locked_customer.prospect_status = target_status
    locked_customer.prospect_status_changed_at = timezone.now()
    locked_customer.prospect_status_reason = reason
    locked_customer.updated_by = actor
    if follow_up_owner is not None:
        locked_customer.prospect_follow_up_owner = follow_up_owner
    locked_customer.full_clean()
    locked_customer.save(
        update_fields=[
            "prospect_status",
            "prospect_status_changed_at",
            "prospect_status_reason",
            "prospect_follow_up_owner",
            "updated_by",
            "updated_at",
        ]
    )

    record_audit_event_on_commit(
        actor=actor,
        action="customer.prospect_status_changed",
        target_type="customer",
        target_id=str(locked_customer.id),
        metadata={
            "previous_status": current_status,
            "new_status": target_status,
            "reason": reason,
        },
    )
    return locked_customer


@transaction.atomic
def convert_prospect_to_client(*, customer: Customer, actor: object) -> Customer:
    """Transition a Customer from prospect to client lifecycle status."""
    locked_customer = Customer.objects.select_for_update().get(pk=customer.pk)
    if locked_customer.lifecycle_status != CustomerLifecycleStatus.PROSPECT:
        raise CustomerConversionError(
            "Only prospects can be converted to clients.",
        )
    locked_customer.lifecycle_status = CustomerLifecycleStatus.CLIENT
    locked_customer.prospect_status = ProspectStatus.CONVERTED
    locked_customer.prospect_status_changed_at = timezone.now()
    locked_customer.updated_by = actor
    locked_customer.full_clean()
    locked_customer.save(
        update_fields=[
            "lifecycle_status",
            "prospect_status",
            "prospect_status_changed_at",
            "updated_by",
            "updated_at",
        ]
    )
    record_audit_event_on_commit(
        actor=actor,
        action="customer.converted_to_client",
        target_type="customer",
        target_id=str(locked_customer.id),
        metadata={
            "previous_status": CustomerLifecycleStatus.PROSPECT,
            "new_status": CustomerLifecycleStatus.CLIENT,
        },
    )
    return locked_customer
