from __future__ import annotations

from django.core.exceptions import ValidationError
from django.db import models

from apps.common.models import AuditableModel, TimestampedModel, UUIDModel


class LogisticsEventType(models.TextChoices):
    DELIVERY = "delivery", "delivery"
    PICKUP = "pickup", "pickup"
    PREPARATION = "preparation", "preparation"
    HANDOVER = "handover", "handover"


class LogisticsEventStatus(models.TextChoices):
    PLANNED = "planned", "planned"
    DISPATCHED = "dispatched", "dispatched"
    COMPLETED = "completed", "completed"
    CANCELLED = "cancelled", "cancelled"


class LogisticsEvent(UUIDModel, TimestampedModel, AuditableModel):
    reservation_draft = models.ForeignKey(
        "reservations.ReservationDraft",
        on_delete=models.PROTECT,
        related_name="logistics_events",
    )
    event_type = models.CharField(
        max_length=32,
        choices=LogisticsEventType.choices,
    )
    status = models.CharField(
        max_length=32,
        choices=LogisticsEventStatus.choices,
        default=LogisticsEventStatus.PLANNED,
    )
    scheduled_at = models.DateTimeField(null=True, blank=True)
    executed_at = models.DateTimeField(null=True, blank=True)
    address = models.TextField(blank=True)
    contact_name = models.CharField(max_length=255, blank=True)
    contact_phone = models.CharField(max_length=64, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-scheduled_at", "-created_at"]
        verbose_name = "Logistics Event"
        verbose_name_plural = "Logistics Events"

    def __str__(self) -> str:
        return f"{self.event_type.label} ? {self.reservation_draft.public_reference}"

    def clean(self) -> None:
        super().clean()
        if self.status == LogisticsEventStatus.COMPLETED and not self.executed_at:
            raise ValidationError("A completed event must have an executed_at timestamp.")
        if self.status == LogisticsEventStatus.CANCELLED and self.executed_at:
            raise ValidationError("A cancelled event cannot have an executed_at timestamp.")
        if self.executed_at and not self.scheduled_at:
            raise ValidationError("Executed at requires a scheduled at value.")
