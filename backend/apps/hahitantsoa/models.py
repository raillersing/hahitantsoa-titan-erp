import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from apps.common.models import AuditableModel, SoftDeleteModel, TimestampedModel, UUIDModel
from apps.customers.models import Customer
from apps.hahitantsoa.scope import assert_hahitantsoa_shared_inventory_item_kind
from apps.inventory.models import InventoryItem
from apps.reservations.periods import validate_reservation_period


class HahitantsoaEventDraftStatus(models.TextChoices):
    DRAFT = "draft", "draft"
    CONFIRMED = "confirmed", "confirmed"


HAHITANTSOA_EVENT_DRAFT_STATUS_VALUES = [status.value for status in HahitantsoaEventDraftStatus]


def generate_hahitantsoa_event_draft_public_reference() -> str:
    return f"HED-{uuid.uuid4().hex[:12].upper()}"


class HahitantsoaEventDraft(UUIDModel, TimestampedModel, SoftDeleteModel, AuditableModel):
    customer = models.ForeignKey(
        Customer,
        on_delete=models.PROTECT,
        related_name="hahitantsoa_event_drafts",
    )
    public_reference = models.CharField(
        max_length=32,
        unique=True,
        default=generate_hahitantsoa_event_draft_public_reference,
    )
    status = models.CharField(
        max_length=32,
        choices=HahitantsoaEventDraftStatus.choices,
        default=HahitantsoaEventDraftStatus.DRAFT,
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
    event_name = models.CharField(max_length=255)
    venue_name = models.CharField(max_length=255, blank=True)
    location_details = models.TextField(blank=True)
    service_notes = models.TextField(blank=True)
    start_at = models.DateTimeField()
    end_at = models.DateTimeField()
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at", "public_reference"]
        verbose_name = "Hahitantsoa event draft"
        verbose_name_plural = "Hahitantsoa event drafts"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(status__in=HAHITANTSOA_EVENT_DRAFT_STATUS_VALUES),
                name="hahitantsoa_event_draft_status_allowed",
            ),
            models.CheckConstraint(
                condition=models.Q(end_at__gt=models.F("start_at")),
                name="hahitantsoa_event_draft_end_after_start",
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
                name="hahitantsoa_event_draft_contract_signed_marker_complete",
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
                name="hahitantsoa_event_draft_required_deposit_received_marker_complete",
            ),
            models.CheckConstraint(
                condition=(
                    (models.Q(confirmed_at__isnull=True) & models.Q(confirmed_by__isnull=True))
                    | (models.Q(confirmed_at__isnull=False) & models.Q(confirmed_by__isnull=False))
                ),
                name="hahitantsoa_event_draft_confirmed_marker_complete",
            ),
        ]

    def clean(self) -> None:
        try:
            validate_reservation_period(start_at=self.start_at, end_at=self.end_at)
        except (TypeError, ValueError) as error:
            raise ValidationError({"end_at": str(error)}) from error

        if self.customer_id and (not self.customer.is_active or self.customer.is_deleted):
            raise ValidationError({"customer": "Hahitantsoa event draft customer must be active."})

    def __str__(self) -> str:
        return self.public_reference


class HahitantsoaEventDraftLine(UUIDModel, TimestampedModel, SoftDeleteModel, AuditableModel):
    event_draft = models.ForeignKey(
        HahitantsoaEventDraft,
        on_delete=models.CASCADE,
        related_name="lines",
    )
    inventory_item = models.ForeignKey(
        InventoryItem,
        on_delete=models.PROTECT,
        related_name="hahitantsoa_event_draft_lines",
    )
    quantity = models.PositiveIntegerField(default=1)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["created_at", "id"]
        verbose_name = "Hahitantsoa event draft line"
        verbose_name_plural = "Hahitantsoa event draft lines"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(quantity__gte=1),
                name="hahitantsoa_event_draft_line_quantity_positive",
            ),
            models.UniqueConstraint(
                fields=["event_draft", "inventory_item"],
                name="hahitantsoa_event_draft_line_unique_item",
            ),
        ]

    def clean(self) -> None:
        if self.quantity < 1:
            raise ValidationError({"quantity": "Quantity must be greater than zero."})

        try:
            assert_hahitantsoa_shared_inventory_item_kind(self.inventory_item.kind)
        except ValueError as error:
            raise ValidationError(
                {
                    "inventory_item": (
                        "Inventory item kind is not allowed for Hahitantsoa shared event drafts."
                    )
                }
            ) from error

        if not self.inventory_item.is_active or self.inventory_item.is_deleted:
            raise ValidationError(
                {"inventory_item": "Hahitantsoa event draft item must be active."}
            )

    def __str__(self) -> str:
        return f"{self.event_draft} - {self.inventory_item} x {self.quantity}"
