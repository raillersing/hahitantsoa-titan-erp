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
    CANCELLED = "cancelled", "cancelled"


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
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancelled_by = models.ForeignKey(
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
            models.CheckConstraint(
                condition=(
                    (
                        models.Q(contract_signed_at__isnull=True)
                        & models.Q(contract_signed_by__isnull=True)
                    )
                    | (
                        models.Q(contract_signed_at__isnull=False)
                        & models.Q(contract_signed_by__isnull=False)
                    )
                ),
                name="reservation_draft_contract_signed_marker_complete",
            ),
            models.CheckConstraint(
                condition=(
                    (
                        models.Q(required_deposit_received_at__isnull=True)
                        & models.Q(required_deposit_received_by__isnull=True)
                    )
                    | (
                        models.Q(required_deposit_received_at__isnull=False)
                        & models.Q(required_deposit_received_by__isnull=False)
                    )
                ),
                name="reservation_draft_required_deposit_received_marker_complete",
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


class ReservationCloseout(UUIDModel, TimestampedModel):
    """Append-only evidence that a reservation closeout was executed once."""

    class Status(models.TextChoices):
        CLOSED = "closed", "closed"

    reservation_draft = models.OneToOneField(
        ReservationDraft,
        on_delete=models.PROTECT,
        related_name="closeout_record",
    )
    closed_at = models.DateTimeField()
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.CLOSED,
    )
    idempotency_key = models.CharField(max_length=128, blank=True, default="")
    closed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="reservation_closeouts",
    )
    summary_snapshot = models.JSONField(default=dict)

    class Meta:
        ordering = ["-closed_at", "-created_at", "id"]
        verbose_name = "Reservation closeout"
        verbose_name_plural = "Reservation closeouts"

    def clean(self) -> None:
        if self.closed_at is None:
            raise ValidationError("Reservation closeouts require a closing timestamp.")
        if self.status != self.Status.CLOSED:
            raise ValidationError("Reservation closeouts must be closed when persisted.")

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise ValidationError("Reservation closeouts are append-only.")
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("Reservation closeouts are append-only.")


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


class ReservationDraftAmendment(UUIDModel, TimestampedModel, AuditableModel):
    """Audited Titan amendment request and its source business notes."""

    reservation_draft = models.ForeignKey(
        ReservationDraft,
        on_delete=models.PROTECT,
        related_name="amendments",
    )
    reason = models.CharField(max_length=255)
    notes = models.TextField(blank=True)
    changed_start_at = models.DateTimeField(null=True, blank=True)
    changed_end_at = models.DateTimeField(null=True, blank=True)
    changed_lines = models.JSONField(default=list, blank=True)
    document_instance_id = models.UUIDField(null=True, blank=True)
    amendment_sequence = models.PositiveSmallIntegerField(null=True, blank=True)
    source_contract_document_id = models.UUIDField(null=True, blank=True)
    applied_at = models.DateTimeField(null=True, blank=True)
    applied_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )

    class Meta:
        ordering = ["-created_at", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["reservation_draft", "amendment_sequence"],
                name="reservation_draft_amendment_sequence_unique",
            )
        ]

    def clean(self) -> None:
        super().clean()
        if not self.reason.strip():
            raise ValidationError({"reason": "An amendment requires a reason."})
