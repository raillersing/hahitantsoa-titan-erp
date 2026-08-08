from django.db import transaction
from django.utils import timezone

from apps.audit.services import record_audit_event_on_commit
from apps.customers.models import (
    Customer,
    CustomerLifecycleStatus,
    DesiredDateWaitlistEntry,
    DesiredDateWaitlistStatus,
    ProspectStatus,
)


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
