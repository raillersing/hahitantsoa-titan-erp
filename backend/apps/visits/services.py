from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from apps.audit.services import record_audit_event_on_commit
from apps.visits.models import VisitAppointment, VisitStatus


class VisitLifecycleError(ValueError):
    code = "visit_lifecycle_error"


def _apply_values(*, visit: VisitAppointment, values: dict, actor: object) -> VisitAppointment:
    scheduled_at_was_updated = "scheduled_at" in values
    reminder_was_provided = "reminder_at" in values
    for field, value in values.items():
        setattr(visit, field, value)
    if scheduled_at_was_updated and not reminder_was_provided:
        visit.reminder_at = visit.scheduled_at - timedelta(hours=24)
    elif visit.reminder_at is None and not reminder_was_provided:
        visit.reminder_at = visit.scheduled_at - timedelta(hours=24)
    visit.updated_by = actor
    visit.full_clean()
    visit.save()
    return visit


@transaction.atomic
def create_visit_appointment(*, values: dict, actor: object) -> VisitAppointment:
    visit = VisitAppointment(created_by=actor, updated_by=actor, **values)
    if visit.reminder_at is None:
        visit.reminder_at = visit.scheduled_at - timedelta(hours=24)
    visit.full_clean()
    visit.save()
    record_audit_event_on_commit(
        actor=actor,
        action="visit.appointment_created",
        target_type="VisitAppointment",
        target_id=str(visit.id),
        metadata={"customer_id": str(visit.customer_id), "reason": visit.reason},
    )
    return visit


@transaction.atomic
def update_visit_appointment(
    *, visit: VisitAppointment, values: dict, actor: object
) -> VisitAppointment:
    locked_visit = VisitAppointment.objects.select_for_update().get(pk=visit.pk)
    if locked_visit.status != VisitStatus.SCHEDULED:
        raise VisitLifecycleError("Only scheduled visits can be updated.")
    updated = _apply_values(visit=locked_visit, values=values, actor=actor)
    record_audit_event_on_commit(
        actor=actor,
        action="visit.appointment_updated",
        target_type="VisitAppointment",
        target_id=str(updated.id),
    )
    return updated


def _transition_visit(
    *, visit: VisitAppointment, target_status: str, actor: object
) -> VisitAppointment:
    with transaction.atomic():
        locked_visit = VisitAppointment.objects.select_for_update().get(pk=visit.pk)
        if locked_visit.status != VisitStatus.SCHEDULED:
            raise VisitLifecycleError("Only scheduled visits can be transitioned.")
        now = timezone.now()
        locked_visit.status = target_status
        if target_status == VisitStatus.COMPLETED:
            locked_visit.completed_at = now
        else:
            locked_visit.cancelled_at = now
        locked_visit.updated_by = actor
        locked_visit.full_clean()
        locked_visit.save()
        record_audit_event_on_commit(
            actor=actor,
            action=f"visit.appointment_{target_status}",
            target_type="VisitAppointment",
            target_id=str(locked_visit.id),
        )
        return locked_visit


def complete_visit_appointment(*, visit: VisitAppointment, actor: object) -> VisitAppointment:
    return _transition_visit(
        visit=visit,
        target_status=VisitStatus.COMPLETED,
        actor=actor,
    )


def cancel_visit_appointment(*, visit: VisitAppointment, actor: object) -> VisitAppointment:
    return _transition_visit(
        visit=visit,
        target_status=VisitStatus.CANCELLED,
        actor=actor,
    )
