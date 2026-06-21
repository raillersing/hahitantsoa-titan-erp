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


class BillingInstallmentStatus(models.TextChoices):
    UNPAID = "unpaid", "unpaid"
    PARTIALLY_PAID = "partially_paid", "partially_paid"
    PAID = "paid", "paid"


class BillingInvoiceInstallment(UUIDModel, TimestampedModel, AuditableModel):
    invoice = models.ForeignKey(
        BillingInvoice,
        on_delete=models.PROTECT,
        related_name="installments",
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    paid_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
    )
    due_at = models.DateTimeField()
    status = models.CharField(
        max_length=32,
        choices=BillingInstallmentStatus.choices,
        default=BillingInstallmentStatus.UNPAID,
    )
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["due_at", "created_at", "id"]
        verbose_name = "Billing invoice installment"
        verbose_name_plural = "Billing invoice installments"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(amount__gt=Decimal("0.00")),
                name="billing_installment_amount_positive",
            ),
            models.CheckConstraint(
                condition=models.Q(paid_amount__gte=Decimal("0.00")),
                name="billing_installment_paid_amount_non_negative",
            ),
            models.CheckConstraint(
                condition=models.Q(paid_amount__lte=models.F("amount")),
                name="billing_installment_paid_not_exceeds_amount",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(
                        status=BillingInstallmentStatus.UNPAID,
                        paid_amount=Decimal("0.00"),
                    )
                    | models.Q(
                        status=BillingInstallmentStatus.PARTIALLY_PAID,
                        paid_amount__gt=Decimal("0.00"),
                        paid_amount__lt=models.F("amount"),
                    )
                    | models.Q(
                        status=BillingInstallmentStatus.PAID,
                        paid_amount=models.F("amount"),
                    )
                ),
                name="billing_installment_status_paid_consistent",
            ),
        ]

    def clean(self) -> None:
        if self.amount is None or self.amount <= 0:
            raise ValidationError({"amount": "Installment amount must be greater than zero."})
        if self.paid_amount is None or self.paid_amount < 0:
            raise ValidationError({"paid_amount": "Paid amount cannot be negative."})
        if self.paid_amount > self.amount:
            raise ValidationError(
                {"paid_amount": "Paid amount cannot exceed the installment amount."}
            )
        if self.status == BillingInstallmentStatus.UNPAID and self.paid_amount != 0:
            raise ValidationError({"status": "An unpaid installment cannot have a paid amount."})
        if self.status == BillingInstallmentStatus.PARTIALLY_PAID and not (
            Decimal("0.00") < self.paid_amount < self.amount
        ):
            raise ValidationError(
                {"status": "A partially paid installment must have a partial paid amount."}
            )
        if self.status == BillingInstallmentStatus.PAID and self.paid_amount != self.amount:
            raise ValidationError({"status": "A paid installment must be fully paid."})

    def __str__(self) -> None:
        return f"Billing installment {self.amount} ({self.status})"


class BillingInstallmentAllocation(UUIDModel, TimestampedModel, AuditableModel):
    installment = models.ForeignKey(
        BillingInvoiceInstallment,
        on_delete=models.PROTECT,
        related_name="allocations",
    )
    payment = models.OneToOneField(
        Payment,
        on_delete=models.PROTECT,
        related_name="billing_installment_allocation",
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    allocated_at = models.DateTimeField()
    allocated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-allocated_at", "-created_at", "id"]
        verbose_name = "Billing installment allocation"
        verbose_name_plural = "Billing installment allocations"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(amount__gt=Decimal("0.00")),
                name="billing_installment_allocation_amount_positive",
            ),
        ]

    def clean(self) -> None:
        if self.amount is None or self.amount <= 0:
            raise ValidationError({"amount": "Allocation amount must be greater than zero."})
        if self.payment_id:
            if self.payment.payment_status not in CONFIRMED_PAYMENT_STATUS_VALUES:
                raise ValidationError(
                    {
                        "payment": (
                            "Installment allocations require a confirmed or reconciled payment."
                        )
                    }
                )
            if self.amount > self.payment.amount:
                raise ValidationError(
                    {"amount": "Allocation amount cannot exceed the payment amount."}
                )

    def __str__(self) -> None:
        return f"Billing allocation {self.amount} ({self.installment_id})"


class BillingRefundObligationStatus(models.TextChoices):
    PENDING = "pending", "pending"


class BillingRefundObligation(UUIDModel, TimestampedModel, AuditableModel):
    invoice = models.OneToOneField(
        BillingInvoice,
        on_delete=models.PROTECT,
        related_name="refund_obligation",
    )
    refund_amount = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(
        max_length=32,
        choices=BillingRefundObligationStatus.choices,
        default=BillingRefundObligationStatus.PENDING,
    )
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at", "id"]
        verbose_name = "Billing refund obligation"
        verbose_name_plural = "Billing refund obligations"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(refund_amount__gt=Decimal("0.00")),
                name="billing_refund_obligation_amount_positive",
            ),
        ]

    def clean(self) -> None:
        if self.refund_amount is None or self.refund_amount <= 0:
            raise ValidationError({"refund_amount": "Refund amount must be greater than zero."})

    def __str__(self) -> str:
        return f"Billing refund obligation {self.refund_amount} ({self.status})"
