from __future__ import annotations

from datetime import timedelta

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.audit.services import record_audit_event_on_commit

from .models import PayrollRuleSet, PayrollRuleSetStatus


class PayrollRuleSetWorkflowError(ValueError):
    pass


def submit_rule_set(*, rule_set: PayrollRuleSet, actor: object) -> PayrollRuleSet:
    with transaction.atomic():
        locked = PayrollRuleSet.objects.select_for_update().get(pk=rule_set.pk)
        if locked.status != PayrollRuleSetStatus.DRAFT:
            raise PayrollRuleSetWorkflowError("Seul un brouillon peut être soumis.")
        errors = locked.configuration_errors()
        if errors:
            raise ValidationError(errors)
        locked.status = PayrollRuleSetStatus.PENDING_REVIEW
        locked.updated_by = actor
        locked.save(update_fields=["status", "updated_by", "updated_at"])
        record_audit_event_on_commit(
            actor=actor,
            action="hr_payroll.rule_set_submitted",
            target_type="payroll_rule_set",
            target_id=str(locked.id),
            metadata={"status": locked.status},
        )
    return locked


def activate_rule_set(*, rule_set: PayrollRuleSet, actor: object) -> PayrollRuleSet:
    today = timezone.localdate()
    with transaction.atomic():
        locked = PayrollRuleSet.objects.select_for_update().get(pk=rule_set.pk)
        if locked.status != PayrollRuleSetStatus.PENDING_REVIEW:
            raise PayrollRuleSetWorkflowError("Seule une configuration soumise peut être activée.")
        errors = locked.configuration_errors()
        if errors:
            raise ValidationError(errors)
        if locked.effective_from < today:
            raise PayrollRuleSetWorkflowError(
                "La date d'effet ne peut pas être antérieure à la date d'activation."
            )
        active_sets = (
            PayrollRuleSet.objects.select_for_update()
            .filter(
                status=PayrollRuleSetStatus.ACTIVE,
            )
            .exclude(pk=locked.pk)
        )
        for active in active_sets:
            active_end = active.effective_until
            new_end = locked.effective_until
            if active_end is None and active.effective_from <= locked.effective_from:
                continue
            comparison_end = active_end or locked.effective_until
            overlaps = comparison_end is None or (
                active.effective_from <= (new_end or comparison_end)
                and locked.effective_from <= comparison_end
            )
            if overlaps:
                raise PayrollRuleSetWorkflowError(
                    "La période de validité chevauche une configuration active."
                )
        active_open = active_sets.filter(effective_until__isnull=True)
        active_open.update(effective_until=locked.effective_from - timedelta(days=1))
        locked.status = PayrollRuleSetStatus.ACTIVE
        locked.updated_by = actor
        locked.save(update_fields=["status", "updated_by", "updated_at"])
        record_audit_event_on_commit(
            actor=actor,
            action="hr_payroll.rule_set_activated",
            target_type="payroll_rule_set",
            target_id=str(locked.id),
            metadata={"effective_from": str(locked.effective_from)},
        )
    return locked


def archive_rule_set(*, rule_set: PayrollRuleSet, actor: object) -> PayrollRuleSet:
    with transaction.atomic():
        locked = PayrollRuleSet.objects.select_for_update().get(pk=rule_set.pk)
        if locked.status == PayrollRuleSetStatus.ACTIVE:
            raise PayrollRuleSetWorkflowError("Une configuration active ne peut pas être archivée.")
        if locked.status == PayrollRuleSetStatus.ARCHIVED:
            raise PayrollRuleSetWorkflowError("La configuration est déjà archivée.")
        locked.status = PayrollRuleSetStatus.ARCHIVED
        locked.updated_by = actor
        locked.save(update_fields=["status", "updated_by", "updated_at"])
        record_audit_event_on_commit(
            actor=actor,
            action="hr_payroll.rule_set_archived",
            target_type="payroll_rule_set",
            target_id=str(locked.id),
            metadata={"status": locked.status},
        )
    return locked
