from __future__ import annotations

from datetime import timedelta
from decimal import Decimal, InvalidOperation

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.audit.services import record_audit_event_on_commit

from .models import (
    PAYROLL_CONFIRMABLE_FIELDS,
    PayrollFieldConfirmationStatus,
    PayrollRuleSet,
    PayrollRuleSetStatus,
)


class PayrollRuleSetWorkflowError(ValueError):
    pass


def duplicate_rule_set(*, rule_set: PayrollRuleSet, actor: object) -> PayrollRuleSet:
    with transaction.atomic():
        source = PayrollRuleSet.objects.select_for_update().get(pk=rule_set.pk)
        clone = PayrollRuleSet.objects.create(
            status=PayrollRuleSetStatus.DRAFT,
            label=f"Copie — {source.label}",
            effective_from=source.effective_from,
            effective_until=source.effective_until,
            source_reference=source.source_reference,
            validation_note="Copie à revalider par la DRH.",
            irsa_brackets=source.irsa_brackets,
            irsa_minimum=source.irsa_minimum,
            irsa_abatement=source.irsa_abatement,
            dependent_allowance=source.dependent_allowance,
            contribution_base_definition=source.contribution_base_definition,
            cnaps_employee_rate=source.cnaps_employee_rate,
            cnaps_employer_rate=source.cnaps_employer_rate,
            ostie_employee_rate=source.ostie_employee_rate,
            ostie_employer_rate=source.ostie_employer_rate,
            fmfp_rate=source.fmfp_rate,
            contribution_cap=source.contribution_cap,
            overtime_rules=source.overtime_rules,
            payslip_contexture=source.payslip_contexture,
            dns_format=source.dns_format,
            ostie_format=source.ostie_format,
            collective_agreement=source.collective_agreement,
            field_confirmations={
                field: {**metadata, "status": PayrollFieldConfirmationStatus.PROPOSED}
                for field, metadata in source.field_confirmations.items()
            },
            created_by=actor,
            updated_by=actor,
        )
        record_audit_event_on_commit(
            actor=actor,
            action="hr_payroll.rule_set_duplicated",
            target_type="payroll_rule_set",
            target_id=str(clone.id),
            metadata={"source_id": str(source.id)},
        )
    return clone


def confirm_rule_set_fields(
    *, rule_set: PayrollRuleSet, fields: dict, actor: object
) -> PayrollRuleSet:
    with transaction.atomic():
        locked = PayrollRuleSet.objects.select_for_update().get(pk=rule_set.pk)
        if locked.status != PayrollRuleSetStatus.DRAFT:
            raise PayrollRuleSetWorkflowError("Seul un brouillon peut être confirmé.")
        confirmations = dict(locked.field_confirmations or {})
        for field, metadata in fields.items():
            if field not in PAYROLL_CONFIRMABLE_FIELDS:
                raise PayrollRuleSetWorkflowError(f"Champ de confirmation inconnu : {field}.")
            if not isinstance(metadata, dict):
                raise PayrollRuleSetWorkflowError(
                    f"Les métadonnées de confirmation sont invalides pour : {field}."
                )
            confirmations[field] = {
                **metadata,
                "status": PayrollFieldConfirmationStatus.CONFIRMED,
                "confirmed_at": timezone.now().isoformat(),
                "confirmed_by": str(getattr(actor, "id", "")),
            }
        locked.field_confirmations = confirmations
        locked.updated_by = actor
        locked.save(update_fields=["field_confirmations", "updated_by", "updated_at"])
        record_audit_event_on_commit(
            actor=actor,
            action="hr_payroll.rule_set_fields_confirmed",
            target_type="payroll_rule_set",
            target_id=str(locked.id),
            metadata={"fields": sorted(fields)},
        )
    return locked


def preview_rule_set(*, rule_set: PayrollRuleSet, gross_salary: object) -> dict[str, object]:
    """Return a simulation only; this function never writes data."""

    try:
        gross = Decimal(str(gross_salary))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise PayrollRuleSetWorkflowError("Le salaire brut doit être numérique.") from exc
    if gross < 0:
        raise PayrollRuleSetWorkflowError("Le salaire brut ne peut pas être négatif.")
    if rule_set.configuration_errors():
        raise PayrollRuleSetWorkflowError(
            "La configuration doit être complète et confirmée pour la simulation."
        )
    employee_cnaps = gross * (rule_set.cnaps_employee_rate / Decimal("100"))
    employee_ostie = gross * (rule_set.ostie_employee_rate / Decimal("100"))
    employer_fmfp = gross * (rule_set.fmfp_rate / Decimal("100"))
    irsa = Decimal("0")
    for bracket in rule_set.irsa_brackets:
        lower = Decimal(str(bracket["lower"]))
        upper = Decimal(str(bracket["upper"])) if bracket.get("upper") not in (None, "") else gross
        taxable = max(Decimal("0"), min(gross, upper) - lower)
        irsa += taxable * Decimal(str(bracket["rate"])) / Decimal("100")
    irsa = max(irsa, rule_set.irsa_minimum)
    return {
        "simulation_only": True,
        "gross_salary": str(gross),
        "employee_cnaps": str(employee_cnaps),
        "employee_ostie": str(employee_ostie),
        "employer_fmfp": str(employer_fmfp),
        "irsa": str(irsa),
        "net_before_other_deductions": str(gross - employee_cnaps - employee_ostie - irsa),
    }


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
