from __future__ import annotations

from datetime import date

from django.core.exceptions import ValidationError
from django.db import transaction

from apps.audit.services import record_audit_event_on_commit

from .models import PayrollRuleSet, PayrollRuleSetStatus, PaySlip


class PaySlipValidationError(ValueError):
    pass


def validate_payslip(*, payslip: PaySlip, actor: object) -> PaySlip:
    try:
        period_start = date.fromisoformat(f"{payslip.period}-01")
    except ValueError as exc:
        raise ValidationError({"period": "La période doit être au format AAAA-MM."}) from exc

    with transaction.atomic():
        locked_payslip = PaySlip.objects.select_for_update().get(pk=payslip.pk)
        if locked_payslip.status != "draft":
            raise PaySlipValidationError("Seul un bulletin brouillon peut être validé.")
        rule_set = (
            PayrollRuleSet.objects.select_for_update()
            .filter(
                status=PayrollRuleSetStatus.ACTIVE,
                effective_from__lte=period_start,
            )
            .filter(
                effective_until__isnull=True,
            )
            .order_by("-effective_from")
            .first()
        )
        if rule_set is None:
            rule_set = (
                PayrollRuleSet.objects.select_for_update()
                .filter(
                    status=PayrollRuleSetStatus.ACTIVE,
                    effective_from__lte=period_start,
                    effective_until__gte=period_start,
                )
                .order_by("-effective_from")
                .first()
            )
        if rule_set is None:
            raise PaySlipValidationError(
                "Aucune configuration de paie active ne couvre la période du bulletin."
            )
        if rule_set.configuration_errors():
            raise PaySlipValidationError("La configuration active de paie est incomplète.")
        locked_payslip.payroll_rule_set = rule_set
        locked_payslip.payroll_rule_snapshot = rule_set.snapshot()
        locked_payslip.status = "validated"
        locked_payslip.save(
            update_fields=[
                "payroll_rule_set",
                "payroll_rule_snapshot",
                "status",
            ]
        )
        record_audit_event_on_commit(
            actor=actor,
            action="hr_payroll.payslip_validated",
            target_type="payslip",
            target_id=str(locked_payslip.id),
            metadata={"payroll_rule_set_id": str(rule_set.id), "period": locked_payslip.period},
        )
    return locked_payslip
