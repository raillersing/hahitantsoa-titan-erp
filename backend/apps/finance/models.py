from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from apps.common.models import TimestampedModel, UUIDModel


class FinanceBusinessScope(models.TextChoices):
    HAHITANTSOA = "hahitantsoa", "Hahitantsoa"
    TITAN = "titan", "Titan"


class FinanceCurrency(models.TextChoices):
    MGA = "MGA", "Malagasy ariary"


class FinanceAccountKind(models.TextChoices):
    CASH = "cash", "Cash"
    BANK = "bank", "Bank"
    MOBILE_MONEY = "mobile_money", "Mobile money"
    CHEQUE = "cheque", "Cheque"


class FinancialCategoryKind(models.TextChoices):
    INCOME = "income", "Income"
    EXPENSE = "expense", "Expense"
    TRANSFER = "transfer", "Transfer"


FIXED_FINANCIAL_CATEGORY_DEFINITIONS = (
    ("income.rental", "Recettes location", FinancialCategoryKind.INCOME),
    ("income.service_sale", "Recettes prestation-vente", FinancialCategoryKind.INCOME),
    ("income.deposit", "Recettes acompte", FinancialCategoryKind.INCOME),
    ("income.invoice_settlement", "Recettes règlement facture", FinancialCategoryKind.INCOME),
    ("income.other", "Recettes autre", FinancialCategoryKind.INCOME),
    ("expense.purchase", "Dépenses achat", FinancialCategoryKind.EXPENSE),
    ("expense.supplier", "Dépenses fournisseur", FinancialCategoryKind.EXPENSE),
    ("expense.transport_delivery", "Dépenses transport-livraison", FinancialCategoryKind.EXPENSE),
    ("expense.fuel", "Dépenses carburant", FinancialCategoryKind.EXPENSE),
    ("expense.salary_labor", "Dépenses salaire-main-d’œuvre", FinancialCategoryKind.EXPENSE),
    ("expense.maintenance", "Dépenses maintenance", FinancialCategoryKind.EXPENSE),
    ("expense.rent_charges", "Dépenses loyer-charges", FinancialCategoryKind.EXPENSE),
    (
        "expense.bank_mobile_money_fees",
        "Dépenses frais bancaire-mobile money",
        FinancialCategoryKind.EXPENSE,
    ),
    ("expense.reimbursement", "Dépenses remboursement", FinancialCategoryKind.EXPENSE),
    ("expense.other", "Dépenses autre", FinancialCategoryKind.EXPENSE),
    ("transfer.cash_bank", "Transfert caisse↔banque", FinancialCategoryKind.TRANSFER),
    (
        "transfer.cash_mobile_money",
        "Transfert caisse↔mobile money",
        FinancialCategoryKind.TRANSFER,
    ),
    (
        "transfer.bank_mobile_money",
        "Transfert banque↔mobile money",
        FinancialCategoryKind.TRANSFER,
    ),
    (
        "transfer.titan_hahitantsoa",
        "Transfert Titan↔Hahitantsoa",
        FinancialCategoryKind.TRANSFER,
    ),
)


class FinancialCategory(UUIDModel, TimestampedModel):
    """System-managed financial category from the fixed F2-1 catalog."""

    code = models.CharField(max_length=96, unique=True)
    label = models.CharField(max_length=255)
    kind = models.CharField(max_length=16, choices=FinancialCategoryKind.choices)

    class Meta:
        ordering = ["kind", "code", "id"]

    def clean(self) -> None:
        definition_by_code = {
            code: (label, kind) for code, label, kind in FIXED_FINANCIAL_CATEGORY_DEFINITIONS
        }
        expected = definition_by_code.get(self.code)
        if expected is None:
            raise ValidationError(
                {"code": "Financial categories are limited to the fixed catalog."}
            )
        expected_label, expected_kind = expected
        if self.label != expected_label or self.kind != expected_kind:
            raise ValidationError("Financial category attributes must match the fixed catalog.")


class FinancialJournalDirection(models.TextChoices):
    INFLOW = "inflow", "Inflow"
    OUTFLOW = "outflow", "Outflow"


class FinanceAccount(UUIDModel, TimestampedModel):
    """A configurable account, deliberately scoped to one business unit."""

    business_scope = models.CharField(max_length=32, choices=FinanceBusinessScope.choices)
    currency = models.CharField(
        max_length=3,
        choices=FinanceCurrency.choices,
        default=FinanceCurrency.MGA,
    )
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
            models.CheckConstraint(
                condition=models.Q(currency=FinanceCurrency.MGA),
                name="finance_account_currency_mga_only",
            ),
            models.UniqueConstraint(
                fields=["business_scope", "code"],
                name="finance_account_scope_code_unique",
            ),
        ]

    def clean(self) -> None:
        if self.currency != FinanceCurrency.MGA:
            raise ValidationError({"currency": "Finance accounts are MGA-only."})
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
    category = models.ForeignKey(
        FinancialCategory,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="journal_entries",
    )
    direction = models.CharField(max_length=16, choices=FinancialJournalDirection.choices)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    occurred_at = models.DateTimeField()
    source_label = models.CharField(max_length=255, blank=True)
    transfer_reference = models.UUIDField(null=True, blank=True, db_index=True)
    reverses_transfer_reference = models.UUIDField(null=True, blank=True, db_index=True)
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
            models.CheckConstraint(
                condition=(
                    models.Q(reverses_transfer_reference__isnull=True)
                    | models.Q(transfer_reference__isnull=False)
                ),
                name="financial_journal_entry_reversal_requires_transfer",
            ),
            models.UniqueConstraint(
                fields=["transfer_reference", "direction"],
                condition=models.Q(transfer_reference__isnull=False),
                name="financial_journal_entry_transfer_pair_direction_unique",
            ),
            models.UniqueConstraint(
                fields=["reverses_transfer_reference", "direction"],
                condition=models.Q(reverses_transfer_reference__isnull=False),
                name="financial_journal_entry_counter_pair_direction_unique",
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
        if self.reverses_transfer_reference and not self.transfer_reference:
            raise ValidationError("Counter-transfer entries require a transfer reference.")
        if self.category_id:
            if self.transfer_reference and self.category.kind != FinancialCategoryKind.TRANSFER:
                raise ValidationError("Transfers require a transfer financial category.")
            if (
                self.category.kind == FinancialCategoryKind.INCOME
                and self.direction != FinancialJournalDirection.INFLOW
            ):
                raise ValidationError("Income categories require an inflow journal entry.")
            if (
                self.category.kind == FinancialCategoryKind.EXPENSE
                and self.direction != FinancialJournalDirection.OUTFLOW
            ):
                raise ValidationError("Expense categories require an outflow journal entry.")
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
