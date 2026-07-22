from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from apps.common.models import AuditableModel, TimestampedModel, UUIDModel


class VisitReason(models.TextChoices):
    SIMPLE_VISIT = "simple_visit", "Simple visite"
    PROSPECT = "prospect", "Prospect"
    OTHER = "other", "Autres"


class VisitStatus(models.TextChoices):
    SCHEDULED = "scheduled", "Planifiée"
    COMPLETED = "completed", "Terminée"
    CANCELLED = "cancelled", "Annulée"


class VisitAppointment(UUIDModel, TimestampedModel, AuditableModel):
    customer = models.ForeignKey(
        "customers.Customer",
        on_delete=models.PROTECT,
        related_name="visit_appointments",
    )
    reason = models.CharField(max_length=32, choices=VisitReason.choices)
    scheduled_at = models.DateTimeField()
    responsible = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="responsible_visit_appointments",
    )
    location = models.CharField(max_length=255, default="Local de l'entreprise")
    notes = models.TextField(blank=True)
    status = models.CharField(
        max_length=16,
        choices=VisitStatus.choices,
        default=VisitStatus.SCHEDULED,
    )
    reminder_at = models.DateTimeField(null=True, blank=True)
    reminder_sent_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["scheduled_at", "created_at"]
        verbose_name = "Visit appointment"
        verbose_name_plural = "Visit appointments"

    def clean(self) -> None:
        super().clean()
        if self.status == VisitStatus.COMPLETED and not self.completed_at:
            raise ValidationError("A completed visit must have a completed_at timestamp.")
        if self.status == VisitStatus.CANCELLED and not self.cancelled_at:
            raise ValidationError("A cancelled visit must have a cancelled_at timestamp.")
        if self.status == VisitStatus.SCHEDULED and (self.completed_at or self.cancelled_at):
            raise ValidationError("A scheduled visit cannot have terminal timestamps.")
        if self.status == VisitStatus.COMPLETED and self.cancelled_at:
            raise ValidationError("A completed visit cannot have a cancelled_at timestamp.")
        if self.status == VisitStatus.CANCELLED and self.completed_at:
            raise ValidationError("A cancelled visit cannot have a completed_at timestamp.")

    def __str__(self) -> str:
        return f"{self.customer.display_name} — {self.scheduled_at:%Y-%m-%d %H:%M}"
