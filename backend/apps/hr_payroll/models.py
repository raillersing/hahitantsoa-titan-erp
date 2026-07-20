from __future__ import annotations

from django.db import models

from apps.common.models import TimestampedModel, UUIDModel


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
        on_delete=models.CASCADE,
        related_name="payslips",
    )
    period = models.CharField(max_length=7, help_text="Format AAAA-MM, ex. 2026-06")
    gross_salary = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    deductions = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    net_salary = models.DecimalField(max_digits=12, decimal_places=2, default=0)
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
