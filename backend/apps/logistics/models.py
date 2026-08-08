from __future__ import annotations

from django.conf import settings
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


class HandoverSignatureStatus(models.TextChoices):
    PENDING = "pending", "En attente de signature"
    RECEIVED = "received", "Document signé reçu"
    EXCEPTION = "exception", "Signature exceptionnellement non obtenue"


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
    # Passation signature tracking (INV-011)
    signature_required = models.BooleanField(default=False)
    signature_received = models.BooleanField(default=False)
    signature_status = models.CharField(
        max_length=32,
        choices=HandoverSignatureStatus.choices,
        default=HandoverSignatureStatus.PENDING,
        blank=True,
    )
    signature_exception_reason = models.TextField(blank=True)
    signed_document_file = models.CharField(max_length=2048, blank=True)
    signed_document_hash = models.CharField(max_length=128, blank=True)
    signed_by_client_name = models.CharField(max_length=255, blank=True)
    signed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    signed_at = models.DateTimeField(null=True, blank=True)

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
        if self.signature_received and not self.signed_at:
            raise ValidationError("Signature received requires a signed_at timestamp.")
        if self.signed_at and not self.signed_by:
            raise ValidationError("Signed_at requires a signed_by user.")
        if self.signature_received and self.event_type != LogisticsEventType.HANDOVER:
            raise ValidationError("Signature tracking is only valid for handover events.")
        if (
            self.signature_status == HandoverSignatureStatus.EXCEPTION
            and not self.signature_exception_reason
        ):
            raise ValidationError(
                "Signature exception status requires a reason."
            )
        if (
            self.signature_status == HandoverSignatureStatus.RECEIVED
            and not self.signed_document_file
            and not self.signed_by
        ):
            raise ValidationError(
                "Signature received requires either a signed document "
                "file or a signed_by user."
            )
        if (
            self.signature_status != HandoverSignatureStatus.EXCEPTION
            and self.signature_exception_reason
        ):
            raise ValidationError(
                "Signature exception reason is only allowed when "
                "status is 'exception'."
            )


class LogisticsEventItemLine(UUIDModel, TimestampedModel, AuditableModel):
    logistics_event = models.ForeignKey(
        LogisticsEvent,
        on_delete=models.CASCADE,
        related_name="item_lines",
    )
    inventory_item = models.ForeignKey(
        "inventory.InventoryItem",
        on_delete=models.PROTECT,
        related_name="logistics_event_lines",
    )
    quantity = models.PositiveIntegerField(default=1)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["created_at", "id"]
        verbose_name = "Logistics Event Item Line"
        verbose_name_plural = "Logistics Event Item Lines"
        constraints = [
            models.UniqueConstraint(
                fields=["logistics_event", "inventory_item"],
                name="logistics_event_item_line_unique_item_per_event",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.inventory_item.name} x {self.quantity} ({self.logistics_event.event_type})"
