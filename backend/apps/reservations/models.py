import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from apps.common.models import (
    AuditableModel,
    SoftDeleteModel,
    TimestampedModel,
    UUIDModel,
)
from apps.customers.models import Customer
from apps.inventory.models import InventoryItem
from apps.reservations.periods import validate_reservation_period
from apps.reservations.scope import assert_reservable_inventory_item_kind


class ReservationDraftStatus(models.TextChoices):
    DRAFT = "draft", "draft"
    CONFIRMED = "confirmed", "confirmed"


RESERVATION_DRAFT_STATUS_VALUES = [status.value for status in ReservationDraftStatus]


def generate_reservation_draft_public_reference() -> str:
    return f"RD-{uuid.uuid4().hex[:12].upper()}"


class ReservationDraft(UUIDModel, TimestampedModel, SoftDeleteModel, AuditableModel):
    customer = models.ForeignKey(
        Customer,
        on_delete=models.PROTECT,
        related_name="reservation_drafts",
    )
    public_reference = models.CharField(
        max_length=32,
        unique=True,
        default=generate_reservation_draft_public_reference,
    )
    status = models.CharField(
        max_length=32,
        choices=ReservationDraftStatus.choices,
        default=ReservationDraftStatus.DRAFT,
    )
    contract_signed_at = models.DateTimeField(null=True, blank=True)
    contract_signed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    required_deposit_received_at = models.DateTimeField(null=True, blank=True)
    required_deposit_received_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    confirmed_at = models.DateTimeField(null=True, blank=True)
    confirmed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    start_at = models.DateTimeField()
    end_at = models.DateTimeField()
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at", "public_reference"]
        verbose_name = "Reservation draft"
        verbose_name_plural = "Reservation drafts"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(status__in=RESERVATION_DRAFT_STATUS_VALUES),
                name="reservation_draft_status_allowed",
            ),
            models.CheckConstraint(
                condition=models.Q(end_at__gt=models.F("start_at")),
                name="reservation_draft_end_after_start",
            ),
        ]

    def clean(self) -> None:
        try:
            validate_reservation_period(start_at=self.start_at, end_at=self.end_at)
        except (TypeError, ValueError) as error:
            raise ValidationError({"end_at": str(error)}) from error

        if self.customer_id and (not self.customer.is_active or self.customer.is_deleted):
            raise ValidationError({"customer": "Reservation draft customer must be active."})

    def __str__(self) -> str:
        return self.public_reference


class ReservationDraftLine(UUIDModel, TimestampedModel, SoftDeleteModel, AuditableModel):
    reservation_draft = models.ForeignKey(
        ReservationDraft,
        on_delete=models.CASCADE,
        related_name="lines",
    )
    inventory_item = models.ForeignKey(
        InventoryItem,
        on_delete=models.PROTECT,
        related_name="reservation_draft_lines",
    )
    quantity = models.PositiveIntegerField(default=1)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["created_at", "id"]
        verbose_name = "Reservation draft line"
        verbose_name_plural = "Reservation draft lines"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(quantity__gte=1),
                name="reservation_draft_line_quantity_positive",
            ),
            models.UniqueConstraint(
                fields=["reservation_draft", "inventory_item"],
                name="reservation_draft_line_unique_item",
            ),
        ]

    def clean(self) -> None:
        if self.quantity < 1:
            raise ValidationError({"quantity": "Quantity must be greater than zero."})

        try:
            assert_reservable_inventory_item_kind(self.inventory_item.kind)
        except ValueError as error:
            raise ValidationError(
                {"inventory_item": "Inventory item kind is not reservable in Titan."}
            ) from error

        if not self.inventory_item.is_active or self.inventory_item.is_deleted:
            raise ValidationError({"inventory_item": "Reservation draft item must be active."})

    def __str__(self) -> str:
        return f"{self.reservation_draft} - {self.inventory_item} x {self.quantity}"
