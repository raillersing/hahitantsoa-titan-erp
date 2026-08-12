from __future__ import annotations

from decimal import Decimal, InvalidOperation

from django.core.exceptions import ValidationError
from django.db import models

from apps.common.models import AuditableModel, TimestampedModel, UUIDModel


class PayrollRuleSetStatus(models.TextChoices):
    DRAFT = "draft", "Brouillon"
    PENDING_REVIEW = "pending_review", "À valider"
    ACTIVE = "active", "Actif"
    ARCHIVED = "archived", "Archivé"


class PayrollFieldConfirmationStatus(models.TextChoices):
    MISSING = "missing", "Manquant"
    PROPOSED = "proposed", "Proposé"
    CONFIRMED = "confirmed", "Confirmé par la DRH"


PAYROLL_CONFIRMABLE_FIELDS = {
    "irsa_brackets",
    "irsa_minimum",
    "irsa_abatement",
    "dependent_allowance",
    "contribution_base_definition",
    "cnaps_employee_rate",
    "cnaps_employer_rate",
    "ostie_employee_rate",
    "ostie_employer_rate",
    "fmfp_rate",
    "overtime_rules",
    "payslip_contexture",
    "dns_format",
    "ostie_format",
    "collective_agreement",
}


class PayrollRuleSet(UUIDModel, TimestampedModel, AuditableModel):
    """Versioned employer-supplied rules used by a future payroll run."""

    status = models.CharField(
        max_length=20,
        choices=PayrollRuleSetStatus.choices,
        default=PayrollRuleSetStatus.DRAFT,
    )
    label = models.CharField(max_length=255)
    effective_from = models.DateField()
    effective_until = models.DateField(null=True, blank=True)
    source_reference = models.CharField(max_length=500, blank=True, default="")
    validation_note = models.TextField(blank=True, default="")
    irsa_brackets = models.JSONField(default=list, blank=True)
    irsa_minimum = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    irsa_abatement = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    dependent_allowance = models.DecimalField(
        max_digits=14, decimal_places=2, null=True, blank=True
    )
    contribution_base_definition = models.TextField(blank=True, default="")
    cnaps_employee_rate = models.DecimalField(max_digits=7, decimal_places=4, null=True, blank=True)
    cnaps_employer_rate = models.DecimalField(max_digits=7, decimal_places=4, null=True, blank=True)
    ostie_employee_rate = models.DecimalField(max_digits=7, decimal_places=4, null=True, blank=True)
    ostie_employer_rate = models.DecimalField(max_digits=7, decimal_places=4, null=True, blank=True)
    fmfp_rate = models.DecimalField(max_digits=7, decimal_places=4, null=True, blank=True)
    contribution_cap = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    overtime_rules = models.JSONField(default=dict, blank=True)
    payslip_contexture = models.JSONField(default=dict, blank=True)
    dns_format = models.JSONField(default=dict, blank=True)
    ostie_format = models.JSONField(default=dict, blank=True)
    collective_agreement = models.JSONField(default=dict, blank=True)
    field_confirmations = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-effective_from", "-created_at"]
        verbose_name = "Jeu de règles de paie"
        verbose_name_plural = "Jeux de règles de paie"

    def __str__(self) -> str:
        return f"{self.label} ({self.effective_from})"

    @staticmethod
    def _decimal(value: object, field: str) -> Decimal:
        try:
            return Decimal(str(value))
        except (InvalidOperation, TypeError, ValueError) as exc:
            raise ValidationError({field: "La valeur doit être un nombre décimal valide."}) from exc

    def configuration_errors(self) -> dict[str, str]:
        errors: dict[str, str] = {}
        required_fields = {
            "irsa_brackets": self.irsa_brackets,
            "irsa_minimum": self.irsa_minimum,
            "irsa_abatement": self.irsa_abatement,
            "dependent_allowance": self.dependent_allowance,
            "contribution_base_definition": self.contribution_base_definition,
            "cnaps_employee_rate": self.cnaps_employee_rate,
            "cnaps_employer_rate": self.cnaps_employer_rate,
            "ostie_employee_rate": self.ostie_employee_rate,
            "ostie_employer_rate": self.ostie_employer_rate,
            "fmfp_rate": self.fmfp_rate,
            "overtime_rules": self.overtime_rules,
            "payslip_contexture": self.payslip_contexture,
            "dns_format": self.dns_format,
            "ostie_format": self.ostie_format,
            "collective_agreement": self.collective_agreement,
        }
        for field, value in required_fields.items():
            if value in (None, "", [], {}):
                errors[field] = "Ce champ doit être renseigné avant activation."
            elif (
                self.field_confirmations.get(field, {}).get("status")
                != PayrollFieldConfirmationStatus.CONFIRMED
            ):
                errors[field] = "Ce champ doit être confirmé par la DRH avant activation."

        if self.irsa_brackets:
            previous_upper: Decimal | None = None
            for index, bracket in enumerate(self.irsa_brackets):
                if not isinstance(bracket, dict):
                    errors["irsa_brackets"] = "Chaque tranche IRSA doit être un objet."
                    break
                if "lower" not in bracket or "rate" not in bracket:
                    errors["irsa_brackets"] = f"La tranche {index + 1} doit contenir lower et rate."
                    break
                lower = self._decimal(bracket["lower"], "irsa_brackets")
                rate = self._decimal(bracket["rate"], "irsa_brackets")
                if lower < 0 or rate < 0 or rate > 100:
                    errors["irsa_brackets"] = (
                        "Les bornes et taux IRSA doivent être positifs et le taux inférieur à 100."
                    )
                    break
                if previous_upper is not None and lower < previous_upper:
                    errors["irsa_brackets"] = "Les tranches IRSA ne doivent pas se chevaucher."
                    break
                upper = bracket.get("upper")
                if upper not in (None, ""):
                    upper_decimal = self._decimal(upper, "irsa_brackets")
                    if upper_decimal <= lower:
                        errors["irsa_brackets"] = (
                            "La borne supérieure doit être supérieure à la borne inférieure."
                        )
                        break
                    previous_upper = upper_decimal
                else:
                    previous_upper = None

        for field in (
            "cnaps_employee_rate",
            "cnaps_employer_rate",
            "ostie_employee_rate",
            "ostie_employer_rate",
            "fmfp_rate",
        ):
            value = getattr(self, field)
            if value is not None and (value < 0 or value > 100):
                errors[field] = "Le taux doit être compris entre 0 et 100."
        if self.effective_until and self.effective_until < self.effective_from:
            errors["effective_until"] = "La fin de validité doit être postérieure au début."
        return errors

    def clean(self) -> None:
        super().clean()
        if self.status == PayrollRuleSetStatus.ACTIVE:
            errors = self.configuration_errors()
            if errors:
                raise ValidationError(errors)

    def snapshot(self) -> dict[str, object]:
        """Return a JSON-safe immutable representation for a payslip."""

        decimal_fields = (
            "irsa_minimum",
            "irsa_abatement",
            "dependent_allowance",
            "cnaps_employee_rate",
            "cnaps_employer_rate",
            "ostie_employee_rate",
            "ostie_employer_rate",
            "fmfp_rate",
            "contribution_cap",
        )
        result: dict[str, object] = {
            "id": str(self.id),
            "label": self.label,
            "effective_from": self.effective_from.isoformat(),
            "effective_until": self.effective_until.isoformat() if self.effective_until else None,
            "source_reference": self.source_reference,
            "irsa_brackets": self.irsa_brackets,
            "contribution_base_definition": self.contribution_base_definition,
            "overtime_rules": self.overtime_rules,
            "payslip_contexture": self.payslip_contexture,
            "dns_format": self.dns_format,
            "ostie_format": self.ostie_format,
            "collective_agreement": self.collective_agreement,
            "field_confirmations": self.field_confirmations,
        }
        result.update(
            {
                field: str(getattr(self, field)) if getattr(self, field) is not None else None
                for field in decimal_fields
            }
        )
        return result


class Employee(UUIDModel, TimestampedModel):
    """Represents an employee of the organisation."""

    STATUS_CHOICES = [
        ("active", "Actif"),
        ("on_leave", "En congé"),
        ("inactive", "Inactif"),
    ]

    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)
    role = models.CharField(max_length=150, help_text="Fonction / rôle de l'employé")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="active")
    assignment = models.CharField(
        max_length=150, blank=True, default="", help_text="Affectation / service"
    )
    salary = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    class Meta:
        ordering = ["last_name", "first_name"]
        verbose_name = "Employé"
        verbose_name_plural = "Employés"

    def __str__(self) -> str:
        return f"{self.first_name} {self.last_name}"

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"


class PaySlip(UUIDModel):
    """Bulletin de paie mensuel d'un employé."""

    STATUS_CHOICES = [
        ("draft", "Brouillon"),
        ("validated", "Validé"),
        ("paid", "Payé"),
    ]

    employee = models.ForeignKey(
        Employee,
        on_delete=models.PROTECT,
        related_name="payslips",
    )
    period = models.CharField(max_length=7, help_text="Format AAAA-MM, ex. 2026-06")
    gross_salary = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    deductions = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    net_salary = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    payroll_rule_set = models.ForeignKey(
        PayrollRuleSet,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="payslips",
    )
    payroll_rule_snapshot = models.JSONField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="draft")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Bulletin de paie"
        verbose_name_plural = "Bulletins de paie"

    def __str__(self) -> str:
        return f"Bulletin {self.period} – {self.employee}"


class AdvanceRequest(UUIDModel):
    """Demande d'avance sur salaire."""

    STATUS_CHOICES = [
        ("pending", "En attente"),
        ("approved", "Approuvée"),
        ("rejected", "Rejetée"),
    ]

    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name="advance_requests",
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    reason = models.TextField(blank=True, default="")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Demande d'avance"
        verbose_name_plural = "Demandes d'avance"

    def __str__(self) -> str:
        return f"Avance {self.amount} – {self.employee}"


class LeaveRequest(UUIDModel):
    """Demande de congé."""

    STATUS_CHOICES = [
        ("pending", "En attente"),
        ("approved", "Approuvée"),
        ("rejected", "Rejetée"),
    ]

    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name="leave_requests",
    )
    start_date = models.DateField()
    end_date = models.DateField()
    reason = models.TextField(blank=True, default="")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Demande de congé"
        verbose_name_plural = "Demandes de congé"

    def __str__(self) -> str:
        return f"Congé {self.start_date} → {self.end_date} – {self.employee}"
