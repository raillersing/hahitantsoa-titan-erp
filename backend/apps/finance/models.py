from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from apps.common.models import TimestampedModel, UUIDModel


class FinanceBusinessScope(models.TextChoices):
    HAHITANTSOA = "hahitantsoa", "Hahitantsoa"
    TITAN = "titan", "Titan"


class FinanceAccountKind(models.TextChoices):
    CASH = "cash", "Cash"
    BANK = "bank", "Bank"
    MOBILE_MONEY = "mobile_money", "Mobile money"
    CHEQUE = "cheque", "Cheque"


class FinancialJournalDirection(models.TextChoices):
    INFLOW = "inflow", "Inflow"
    OUTFLOW = "outflow", "Outflow"


class FinanceAccount(UUIDModel, TimestampedModel):
    """A configurable account, deliberately scoped to one business unit."""

    business_scope = models.CharField(max_length=32, choices=FinanceBusinessScope.choices)
    code = models.CharField(max_length=64)
    label = models.CharField(max_length=255)
    kind = models.CharField(max_length=32, choices=FinanceAccountKind.choices)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )

    class Meta:
        ordering = ["business_scope", "code", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["business_scope", "code"],
                name="finance_account_scope_code_unique",
            ),
        ]

    def clean(self) -> None:
        if not (self.code or "").strip():
            raise ValidationError({"code": "Finance account code is required."})
        if not (self.label or "").strip():
            raise ValidationError({"label": "Finance account label is required."})


class FinancialJournalEntry(UUIDModel, TimestampedModel):
    """Append-only operational ledger line; corrections are new counter-entries."""

    account = models.ForeignKey(
        FinanceAccount,
        on_delete=models.PROTECT,
        related_name="journal_entries",
    )
    direction = models.CharField(max_length=16, choices=FinancialJournalDirection.choices)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    occurred_at = models.DateTimeField()
    source_label = models.CharField(max_length=255, blank=True)
    transfer_reference = models.UUIDField(null=True, blank=True, db_index=True)
    payment = models.ForeignKey(
        "payments.Payment",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="financial_journal_entries",
    )
    billing_invoice = models.ForeignKey(
        "billing.BillingInvoice",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="financial_journal_entries",
    )
    billing_refund_obligation = models.ForeignKey(
        "billing.BillingRefundObligation",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="financial_journal_entries",
    )
    reservation_draft = models.ForeignKey(
        "reservations.ReservationDraft",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="financial_journal_entries",
    )
    hahitantsoa_event_draft = models.ForeignKey(
        "hahitantsoa.HahitantsoaEventDraft",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="financial_journal_entries",
    )
    notes = models.TextField(blank=True)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="+",
    )

    class Meta:
        ordering = ["-occurred_at", "-created_at", "id"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(amount__gt=Decimal("0.00")),
                name="financial_journal_entry_amount_positive",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(
                        payment__isnull=False,
                        billing_invoice__isnull=True,
                        billing_refund_obligation__isnull=True,
                        reservation_draft__isnull=True,
                        hahitantsoa_event_draft__isnull=True,
                    )
                    | models.Q(
                        payment__isnull=True,
                        billing_invoice__isnull=False,
                        billing_refund_obligation__isnull=True,
                        reservation_draft__isnull=True,
                        hahitantsoa_event_draft__isnull=True,
                    )
                    | models.Q(
                        payment__isnull=True,
                        billing_invoice__isnull=True,
                        billing_refund_obligation__isnull=False,
                        reservation_draft__isnull=True,
                        hahitantsoa_event_draft__isnull=True,
                    )
                    | models.Q(
                        payment__isnull=True,
                        billing_invoice__isnull=True,
                        billing_refund_obligation__isnull=True,
                        reservation_draft__isnull=False,
                        hahitantsoa_event_draft__isnull=True,
                    )
                    | models.Q(
                        payment__isnull=True,
                        billing_invoice__isnull=True,
                        billing_refund_obligation__isnull=True,
                        reservation_draft__isnull=True,
                        hahitantsoa_event_draft__isnull=False,
                    )
                    | models.Q(
                        payment__isnull=True,
                        billing_invoice__isnull=True,
                        billing_refund_obligation__isnull=True,
                        reservation_draft__isnull=True,
                        hahitantsoa_event_draft__isnull=True,
                    )
                ),
                name="financial_journal_entry_single_source",
            ),
        ]

    def clean(self) -> None:
        if self.amount is None or self.amount <= 0:
            raise ValidationError({"amount": "Journal entry amount must be positive."})
        if self.occurred_at is None:
            raise ValidationError({"occurred_at": "Journal entries require an occurrence time."})
        if self.recorded_by_id is None:
            raise ValidationError({"recorded_by": "Journal entries require an actor."})
        source_count = sum(
            bool(value)
            for value in (
                self.payment_id,
                self.billing_invoice_id,
                self.billing_refund_obligation_id,
                self.reservation_draft_id,
                self.hahitantsoa_event_draft_id,
            )
        )
        if source_count > 1:
            raise ValidationError("A journal entry may reference at most one durable source.")
        if source_count == 0 and not (self.source_label or "").strip():
            raise ValidationError(
                {"source_label": "Standalone journal entries require a source label."}
            )
        if (
            self.account_id
            and self.reservation_draft_id
            and self.account.business_scope != FinanceBusinessScope.TITAN
        ):
            raise ValidationError(
                {"account": "Titan reservations require a Titan finance account."}
            )
        if (
            self.account_id
            and self.hahitantsoa_event_draft_id
            and self.account.business_scope != FinanceBusinessScope.HAHITANTSOA
        ):
            raise ValidationError(
                {"account": "Hahitantsoa events require a Hahitantsoa finance account."}
            )

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise ValidationError(
                "Financial journal entries are immutable; record a counter-entry."
            )
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("Financial journal entries are immutable and cannot be deleted.")
