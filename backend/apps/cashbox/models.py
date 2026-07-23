from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from apps.billing.models import BillingInvoice, BillingRefundObligation
from apps.common.models import AuditableModel, TimestampedModel, UUIDModel
from apps.finance.models import FinanceAccount, FinanceAccountKind
from apps.payments.models import Payment


class CashboxSession(UUIDModel, TimestampedModel, AuditableModel):
    cash_account = models.ForeignKey(
        FinanceAccount,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="cashbox_sessions",
    )
    operator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="cashbox_sessions",
    )
    opening_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
    )
    status = models.CharField(
        max_length=32,
        choices=(
            ("open", "Open"),
            ("count_submitted", "Count submitted"),
            ("validated_closed", "Validated closed"),
            ("legacy_terminal", "Legacy terminal"),
        ),
        default="open",
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
                fields=["operator", "cash_account"],
                condition=models.Q(closed_at__isnull=True),
                name="cashbox_single_open_session_per_operator_and_account",
            ),
        ]

    def clean(self) -> None:
        if self.opened_at is None:
            raise ValidationError({"opened_at": "Cashbox sessions require opened_at."})
        if self.opened_by_id is None:
            raise ValidationError({"opened_by": "Cashbox sessions require opened_by."})
        if self.opening_amount is None or self.opening_amount < 0:
            raise ValidationError({"opening_amount": "Opening amount must be zero or positive."})
        if self.cash_account_id and self.cash_account.kind != FinanceAccountKind.CASH:
            raise ValidationError(
                {"cash_account": "Cashbox sessions require a cash finance account."}
            )

    def __str__(self) -> str:
        return f"Cashbox session {self.operator_id} ({self.opened_at})"


def is_legacy_cashbox_session(session: CashboxSession) -> bool:
    return session.cash_account_id is None


class CashboxClosureAttempt(UUIDModel, TimestampedModel):
    """Immutable counted snapshot retained across a supervised reopening."""

    session = models.ForeignKey(
        CashboxSession,
        on_delete=models.PROTECT,
        related_name="closure_attempts",
    )
    theoretical_amount = models.DecimalField(max_digits=12, decimal_places=2)
    actual_amount = models.DecimalField(max_digits=12, decimal_places=2)
    variance_amount = models.DecimalField(max_digits=12, decimal_places=2)
    variance_justification = models.TextField(blank=True)
    submitted_at = models.DateTimeField()
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="+",
    )
    submission_idempotency_key = models.CharField(max_length=128)
    validated_at = models.DateTimeField(null=True, blank=True)
    validated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="+",
    )
    validation_idempotency_key = models.CharField(max_length=128, blank=True)

    class Meta:
        ordering = ["-submitted_at", "-created_at", "id"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(actual_amount__gte=Decimal("0.00")),
                name="cashbox_closure_actual_amount_nonnegative",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(variance_amount=Decimal("0.00")) | ~models.Q(variance_justification="")
                ),
                name="cashbox_closure_variance_requires_justification",
            ),
            models.UniqueConstraint(
                fields=["session", "submission_idempotency_key"],
                name="cashbox_closure_submission_idempotency_unique",
            ),
            models.CheckConstraint(
                condition=models.Q(
                    validated_at__isnull=True,
                    validated_by__isnull=True,
                    validation_idempotency_key="",
                ),
                name="cashbox_closure_attempt_validation_is_separate_evidence",
            ),
        ]

    def clean(self) -> None:
        if self.actual_amount is None or self.actual_amount < 0:
            raise ValidationError({"actual_amount": "Counted cash must be zero or positive."})
        if self.variance_amount is None:
            raise ValidationError({"variance_amount": "Cash variance is required."})
        if self.variance_amount != 0 and not (self.variance_justification or "").strip():
            raise ValidationError(
                {"variance_justification": "A non-zero cash variance requires justification."}
            )
        if self.submitted_at is None or self.submitted_by_id is None:
            raise ValidationError("Cash counts require a submitter and submission time.")

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise ValidationError("Cashbox closure attempts are append-only.")
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("Cashbox closure attempts are append-only.")


class CashboxClosureValidation(UUIDModel, TimestampedModel):
    """Separate append-only supervisor validation evidence for a counted attempt."""

    closure_attempt = models.OneToOneField(
        CashboxClosureAttempt,
        on_delete=models.PROTECT,
        related_name="validation",
    )
    validated_at = models.DateTimeField()
    validated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="+",
    )
    idempotency_key = models.CharField(max_length=128)

    class Meta:
        ordering = ["-validated_at", "-created_at", "id"]

    def clean(self) -> None:
        if self.validated_at is None or self.validated_by_id is None:
            raise ValidationError("Cashbox validations require a supervisor and validation time.")

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise ValidationError("Cashbox validation evidence is append-only.")
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("Cashbox validation evidence is append-only.")


class CashboxReopenEvent(UUIDModel, TimestampedModel):
    """Append-only supervisor evidence for a reopening after validated closure."""

    session = models.ForeignKey(
        CashboxSession,
        on_delete=models.PROTECT,
        related_name="reopen_events",
    )
    closure_attempt = models.ForeignKey(
        CashboxClosureAttempt,
        on_delete=models.PROTECT,
        related_name="reopen_events",
    )
    reason = models.TextField()
    reopened_at = models.DateTimeField()
    reopened_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="+",
    )
    idempotency_key = models.CharField(max_length=128)

    class Meta:
        ordering = ["-reopened_at", "-created_at", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["session", "idempotency_key"],
                name="cashbox_reopen_idempotency_unique",
            ),
        ]

    def clean(self) -> None:
        if not (self.reason or "").strip():
            raise ValidationError({"reason": "Cashbox reopening requires a reason."})
        if self.reopened_at is None or self.reopened_by_id is None:
            raise ValidationError("Cashbox reopen events require actor and timestamp.")

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise ValidationError("Cashbox reopen evidence is append-only.")
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("Cashbox reopen evidence is append-only.")


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
