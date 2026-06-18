from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from apps.common.models import AuditableModel, TimestampedModel, UUIDModel
from apps.documents.models import DocumentInstance, DocumentInstanceStatus
from apps.inventory.models import InventoryDamageLossExcessReceivable
from apps.payments.models import CONFIRMED_PAYMENT_STATUS_VALUES, Payment
from apps.reservations.models import ReservationDraft


class BillingInvoiceSourceKind(models.TextChoices):
    INVENTORY_DAMAGE_LOSS_EXCESS_RECEIVABLE = (
        "inventory_damage_loss_excess_receivable",
        "inventory_damage_loss_excess_receivable",
    )


class BillingInvoiceStatus(models.TextChoices):
    OPEN = "open", "open"
    SETTLED = "settled", "settled"
    CANCELLED = "cancelled", "cancelled"


class BillingInvoice(UUIDModel, TimestampedModel, AuditableModel):
    excess_receivable = models.OneToOneField(
        InventoryDamageLossExcessReceivable,
        on_delete=models.PROTECT,
        related_name="billing_invoice",
    )
    document_instance = models.OneToOneField(
        DocumentInstance,
        on_delete=models.PROTECT,
        related_name="billing_invoice",
    )
    reservation_draft = models.ForeignKey(
        ReservationDraft,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="billing_invoices",
    )
    source_kind = models.CharField(max_length=64, choices=BillingInvoiceSourceKind.choices)
    invoice_status = models.CharField(
        max_length=32,
        choices=BillingInvoiceStatus.choices,
        default=BillingInvoiceStatus.OPEN,
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    issued_at = models.DateTimeField()
    settled_at = models.DateTimeField(null=True, blank=True)
    settled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-issued_at", "-created_at", "id"]
        verbose_name = "Billing invoice"
        verbose_name_plural = "Billing invoices"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(amount__gt=Decimal("0.00")),
                name="billing_invoice_amount_positive",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(
                        invoice_status=BillingInvoiceStatus.OPEN,
                        settled_at__isnull=True,
                        settled_by__isnull=True,
                    )
                    | models.Q(
                        invoice_status=BillingInvoiceStatus.CANCELLED,
                        settled_at__isnull=True,
                        settled_by__isnull=True,
                    )
                    | models.Q(
                        invoice_status=BillingInvoiceStatus.SETTLED,
                        settled_at__isnull=False,
                        settled_by__isnull=False,
                    )
                ),
                name="billing_invoice_status_markers_consistent",
            ),
        ]

    def clean(self) -> None:
        if self.amount is None or self.amount <= 0:
            raise ValidationError({"amount": "Invoice amount must be greater than zero."})

        if self.source_kind != BillingInvoiceSourceKind.INVENTORY_DAMAGE_LOSS_EXCESS_RECEIVABLE:
            raise ValidationError({"source_kind": "Unsupported billing invoice source kind."})

        if self.excess_receivable_id and self.amount != self.excess_receivable.amount:
            raise ValidationError(
                {"amount": "Invoice amount must match the linked excess receivable amount."}
            )

        if (
            self.document_instance_id
            and self.document_instance.status != DocumentInstanceStatus.GENERATED
        ):
            raise ValidationError(
                {"document_instance": "Billing invoices require a generated document instance."}
            )

    def __str__(self) -> str:
        return f"Billing invoice {self.amount} ({self.invoice_status})"


class BillingInvoiceSettlement(UUIDModel, TimestampedModel, AuditableModel):
    invoice = models.OneToOneField(
        BillingInvoice,
        on_delete=models.PROTECT,
        related_name="settlement",
    )
    payment = models.OneToOneField(
        Payment,
        on_delete=models.PROTECT,
        related_name="billing_invoice_settlement",
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    settled_at = models.DateTimeField()
    settled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-settled_at", "-created_at", "id"]
        verbose_name = "Billing invoice settlement"
        verbose_name_plural = "Billing invoice settlements"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(amount__gt=Decimal("0.00")),
                name="billing_invoice_settlement_amount_positive",
            ),
        ]

    def clean(self) -> None:
        if self.amount is None or self.amount <= 0:
            raise ValidationError({"amount": "Settlement amount must be greater than zero."})

        if self.invoice_id and self.amount != self.invoice.amount:
            raise ValidationError({"amount": "Settlement amount must match the invoice amount."})

        if self.payment_id:
            if self.payment.payment_status not in CONFIRMED_PAYMENT_STATUS_VALUES:
                raise ValidationError(
                    {"payment": "Billing settlements require a confirmed or reconciled payment."}
                )
            if self.amount != self.payment.amount:
                raise ValidationError(
                    {"amount": "Settlement amount must match the payment amount."}
                )

        if self.invoice_id and self.payment_id and self.invoice.reservation_draft_id is not None:
            if self.payment.reservation_draft_id != self.invoice.reservation_draft_id:
                raise ValidationError(
                    {
                        "payment": (
                            "Billing settlements require a payment linked to the same "
                            "reservation draft as the invoice."
                        )
                    }
                )

    def __str__(self) -> str:
        return f"Billing settlement {self.amount} ({self.invoice_id})"
