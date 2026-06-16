from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from apps.common.models import AuditableModel, TimestampedModel, UUIDModel
from apps.documents.models import DocumentInstance, DocumentInstanceStatus
from apps.reservations.models import ReservationDraft


class PaymentKind(models.TextChoices):
    DEPOSIT = "deposit", "deposit"
    BALANCE = "balance", "balance"
    CAUTION = "caution", "caution"
    OWNER_INJECTION = "owner_injection", "owner_injection"
    INVESTOR_INJECTION = "investor_injection", "investor_injection"
    DATE_RESERVATION = "date_reservation", "date_reservation"
    OTHER = "other", "other"


class PaymentMethod(models.TextChoices):
    CASH = "cash", "cash"
    BANK_TRANSFER = "bank_transfer", "bank_transfer"
    MOBILE_MONEY = "mobile_money", "mobile_money"
    CHEQUE = "cheque", "cheque"
    OTHER = "other", "other"


class PaymentStatus(models.TextChoices):
    PENDING = "pending", "pending"
    CONFIRMED = "confirmed", "confirmed"
    FAILED = "failed", "failed"
    CANCELLED = "cancelled", "cancelled"
    RECONCILED = "reconciled", "reconciled"


CONFIRMED_PAYMENT_STATUS_VALUES = (
    PaymentStatus.CONFIRMED,
    PaymentStatus.RECONCILED,
)


class Payment(UUIDModel, TimestampedModel, AuditableModel):
    reservation_draft = models.ForeignKey(
        ReservationDraft,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="payments",
    )
    receipt_document = models.OneToOneField(
        DocumentInstance,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="payment_receipt",
    )
    payment_kind = models.CharField(max_length=32, choices=PaymentKind.choices)
    payment_method = models.CharField(max_length=32, choices=PaymentMethod.choices)
    payment_status = models.CharField(
        max_length=32,
        choices=PaymentStatus.choices,
        default=PaymentStatus.PENDING,
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    paid_at = models.DateTimeField(null=True, blank=True)
    external_reference = models.CharField(max_length=255, blank=True)
    source_label = models.CharField(max_length=255, blank=True)
    notes = models.TextField(blank=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)
    confirmed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )

    class Meta:
        ordering = ["-created_at", "id"]
        verbose_name = "Payment"
        verbose_name_plural = "Payments"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(amount__gt=Decimal("0.00")),
                name="payment_amount_positive",
            ),
            models.CheckConstraint(
                condition=(models.Q(reservation_draft__isnull=False) | ~models.Q(source_label="")),
                name="payment_requires_reservation_or_source_label",
            ),
            models.CheckConstraint(
                condition=(
                    (
                        models.Q(
                            payment_status__in=[
                                PaymentStatus.CONFIRMED,
                                PaymentStatus.RECONCILED,
                            ]
                        )
                        & models.Q(paid_at__isnull=False)
                        & models.Q(receipt_document__isnull=False)
                    )
                    | ~models.Q(
                        payment_status__in=[
                            PaymentStatus.CONFIRMED,
                            PaymentStatus.RECONCILED,
                        ]
                    )
                ),
                name="payment_confirmed_status_requires_paid_at_and_receipt",
            ),
            models.CheckConstraint(
                condition=(
                    (models.Q(confirmed_at__isnull=True) & models.Q(confirmed_by__isnull=True))
                    | (models.Q(confirmed_at__isnull=False) & models.Q(confirmed_by__isnull=False))
                ),
                name="payment_confirmed_marker_consistent",
            ),
        ]

    def clean(self) -> None:
        if self.amount is None or self.amount <= 0:
            raise ValidationError({"amount": "Amount must be greater than zero."})

        if self.reservation_draft_id is None and not (self.source_label or "").strip():
            raise ValidationError(
                {
                    "source_label": (
                        "Standalone payments must define a source label when no "
                        "reservation draft is linked."
                    )
                }
            )

        if self.payment_status in CONFIRMED_PAYMENT_STATUS_VALUES and self.paid_at is None:
            raise ValidationError(
                {"paid_at": "Confirmed or reconciled payments must define paid_at."}
            )

        if self.payment_status in CONFIRMED_PAYMENT_STATUS_VALUES:
            if self.receipt_document_id is None:
                raise ValidationError(
                    {
                        "receipt_document": (
                            "Confirmed or reconciled payments must link a "
                            "generated receipt document."
                        )
                    }
                )

            if self.receipt_document.status != DocumentInstanceStatus.GENERATED:
                raise ValidationError(
                    {
                        "receipt_document": (
                            "Confirmed or reconciled payments must link a "
                            "generated receipt document."
                        )
                    }
                )

        if self.payment_status not in CONFIRMED_PAYMENT_STATUS_VALUES:
            if self.confirmed_at is not None or self.confirmed_by_id is not None:
                raise ValidationError(
                    {
                        "payment_status": (
                            "Only confirmed or reconciled payments may keep "
                            "durable confirmation markers."
                        )
                    }
                )

        if self.payment_status in CONFIRMED_PAYMENT_STATUS_VALUES:
            if self.confirmed_at is None:
                self.confirmed_at = timezone.now()

    def __str__(self) -> str:
        return f"{self.payment_kind} {self.amount} ({self.payment_status})"
