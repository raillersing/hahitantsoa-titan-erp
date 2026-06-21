from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from apps.billing.models import BillingInvoice, BillingRefundObligation
from apps.common.models import AuditableModel, TimestampedModel, UUIDModel
from apps.payments.models import Payment


class CashboxSession(UUIDModel, TimestampedModel, AuditableModel):
    operator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="cashbox_sessions",
    )
    opened_at = models.DateTimeField()
    opened_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="+",
    )
    closed_at = models.DateTimeField(null=True, blank=True)
    closed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="+",
    )
    opening_note = models.TextField(blank=True)
    closing_note = models.TextField(blank=True)

    class Meta:
        ordering = ["-opened_at", "-created_at", "id"]
        verbose_name = "Cashbox session"
        verbose_name_plural = "Cashbox sessions"
        constraints = [
            models.CheckConstraint(
                condition=(
                    (models.Q(closed_at__isnull=True) & models.Q(closed_by__isnull=True))
                    | (models.Q(closed_at__isnull=False) & models.Q(closed_by__isnull=False))
                ),
                name="cashbox_session_closed_markers_consistent",
            ),
            models.UniqueConstraint(
                fields=["operator"],
                condition=models.Q(closed_at__isnull=True),
                name="cashbox_single_open_session_per_operator",
            ),
        ]

    def clean(self) -> None:
        if self.opened_at is None:
            raise ValidationError({"opened_at": "Cashbox sessions require opened_at."})
        if self.opened_by_id is None:
            raise ValidationError({"opened_by": "Cashbox sessions require opened_by."})

    def __str__(self) -> str:
        return f"Cashbox session {self.operator_id} ({self.opened_at})"


class CashboxMovementDirection(models.TextChoices):
    CASH_IN = "cash_in", "cash_in"
    CASH_OUT = "cash_out", "cash_out"


class CashboxMovement(UUIDModel, TimestampedModel, AuditableModel):
    session = models.ForeignKey(
        CashboxSession,
        on_delete=models.PROTECT,
        related_name="movements",
    )
    direction = models.CharField(max_length=32, choices=CashboxMovementDirection.choices)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment = models.ForeignKey(
        Payment,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="cashbox_movements",
    )
    billing_invoice = models.ForeignKey(
        BillingInvoice,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="cashbox_movements",
    )
    billing_refund_obligation = models.ForeignKey(
        BillingRefundObligation,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="cashbox_movements",
    )
    moved_at = models.DateTimeField()
    moved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="+",
    )
    note = models.TextField(blank=True)

    class Meta:
        ordering = ["-moved_at", "-created_at", "id"]
        verbose_name = "Cashbox movement"
        verbose_name_plural = "Cashbox movements"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(amount__gt=Decimal("0.00")),
                name="cashbox_movement_amount_positive",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(
                        payment__isnull=False,
                        billing_invoice__isnull=True,
                        billing_refund_obligation__isnull=True,
                    )
                    | models.Q(
                        payment__isnull=True,
                        billing_invoice__isnull=False,
                        billing_refund_obligation__isnull=True,
                    )
                    | models.Q(
                        payment__isnull=True,
                        billing_invoice__isnull=True,
                        billing_refund_obligation__isnull=False,
                    )
                    | models.Q(
                        payment__isnull=True,
                        billing_invoice__isnull=True,
                        billing_refund_obligation__isnull=True,
                    )
                ),
                name="cashbox_movement_single_financial_reference",
            ),
        ]

    def clean(self) -> None:
        if self.amount is None or self.amount <= 0:
            raise ValidationError({"amount": "Cashbox movements require a positive amount."})
        if self.moved_at is None:
            raise ValidationError({"moved_at": "Cashbox movements require moved_at."})
        if self.moved_by_id is None:
            raise ValidationError({"moved_by": "Cashbox movements require moved_by."})

        linked_reference_count = sum(
            [
                1 if self.payment_id else 0,
                1 if self.billing_invoice_id else 0,
                1 if self.billing_refund_obligation_id else 0,
            ]
        )
        if linked_reference_count > 1:
            raise ValidationError(
                {
                    "billing_refund_obligation": (
                        "Cashbox movements may reference at most one financial record."
                    )
                }
            )

        if self.session_id and self.session.closed_at is not None:
            raise ValidationError({"session": "Closed cashbox sessions are immutable."})

    def __str__(self) -> str:
        return f"Cashbox movement {self.amount} ({self.direction})"
