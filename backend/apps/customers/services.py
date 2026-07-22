from django.db import transaction

from apps.audit.services import record_audit_event_on_commit
from apps.customers.models import (
    Customer,
    DesiredDateWaitlistEntry,
    DesiredDateWaitlistStatus,
)


class DesiredDateWaitlistLifecycleError(ValueError):
    code = "desired_date_waitlist_lifecycle_error"


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
