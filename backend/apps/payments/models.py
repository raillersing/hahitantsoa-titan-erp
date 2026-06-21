from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from apps.common.models import AuditableModel, TimestampedModel, UUIDModel
from apps.documents.models import DocumentInstance, DocumentInstanceStatus
from apps.hahitantsoa.models import HahitantsoaEventDraft
from apps.inventory.models import InventoryCautionRefundObligationStatus
from apps.reservations.models import ReservationDraft


class PaymentKind(models.TextChoices):
    DEPOSIT = "deposit", "deposit"
    BALANCE = "balance", "balance"
    CAUTION = "caution", "caution"
    OWNER_INJECTION = "owner_injection", "owner_injection"
    INVESTOR_INJECTION = "investor_injection", "investor_injection"
    DATE_RESERVATION = "date_reservation", "date_reservation"
    REFUND = "refund", "refund"
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
    hahitantsoa_event_draft = models.ForeignKey(
        HahitantsoaEventDraft,
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
    refund_obligation = models.ForeignKey(
        "inventory.InventoryCautionRefundObligation",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="refund_payments",
    )
    billing_refund_obligation = models.ForeignKey(
        "billing.BillingRefundObligation",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="refund_payments",
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
                condition=(
                    models.Q(reservation_draft__isnull=False)
                    | models.Q(hahitantsoa_event_draft__isnull=False)
                    | ~models.Q(source_label="")
                ),
                name="payment_requires_reservation_or_source_label",
            ),
            models.CheckConstraint(
                condition=(
                    ~(
                        models.Q(reservation_draft__isnull=False)
                        & models.Q(hahitantsoa_event_draft__isnull=False)
                    )
                ),
                name="payment_single_draft_link",
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
            models.CheckConstraint(
                condition=(
                    (
                        models.Q(payment_kind=PaymentKind.REFUND)
                        & (
                            models.Q(refund_obligation__isnull=False)
                            | models.Q(billing_refund_obligation__isnull=False)
                        )
                    )
                    | ~models.Q(payment_kind=PaymentKind.REFUND)
                ),
                name="payment_refund_requires_obligation",
            ),
            models.CheckConstraint(
                condition=(
                    ~(
                        models.Q(refund_obligation__isnull=False)
                        & models.Q(billing_refund_obligation__isnull=False)
                    )
                ),
                name="payment_single_refund_obligation_link",
            ),
        ]

    def clean(self) -> None:
        if self.amount is None or self.amount <= 0:
            raise ValidationError({"amount": "Amount must be greater than zero."})

        if self.reservation_draft_id and self.hahitantsoa_event_draft_id:
            raise ValidationError(
                {
                    "hahitantsoa_event_draft": (
                        "Payments must not link both a reservation draft and a "
                        "Hahitantsoa event draft."
                    )
                }
            )

        if (
            self.reservation_draft_id is None
            and self.hahitantsoa_event_draft_id is None
            and not (self.source_label or "").strip()
        ):
            raise ValidationError(
                {
                    "source_label": (
                        "Standalone payments must define a source label when no "
                        "reservation draft or Hahitantsoa event draft is linked."
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

        if self.payment_kind == PaymentKind.REFUND:
            if self.refund_obligation_id and self.billing_refund_obligation_id:
                raise ValidationError(
                    {
                        "billing_refund_obligation": (
                            "Refund payments must link exactly one refund obligation."
                        )
                    }
                )
            if self.refund_obligation_id is None and self.billing_refund_obligation_id is None:
                raise ValidationError(
                    {"refund_obligation": "Refund payments require a linked refund obligation."}
                )
            if (
                self.refund_obligation_id
                and self.refund_obligation.status != InventoryCautionRefundObligationStatus.PENDING
            ):
                raise ValidationError({"refund_obligation": "Refund obligation must be pending."})
            if (
                self.billing_refund_obligation_id
                and self.billing_refund_obligation.status != "pending"
            ):
                raise ValidationError(
                    {"billing_refund_obligation": ("Billing refund obligation must be pending.")}
                )

    def __str__(self) -> str:
        return f"{self.payment_kind} {self.amount} ({self.payment_status})"
