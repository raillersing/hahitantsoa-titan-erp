from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models

from apps.common.models import AuditableModel, TimestampedModel, UUIDModel


class PurchaseOrderStatus(models.TextChoices):
    PENDING = "pending", "pending"
    RECEIVED = "received", "received"
    CANCELLED = "cancelled", "cancelled"


class PurchaseOrder(UUIDModel, TimestampedModel, AuditableModel):
    """Bon de commande fournisseur."""

    reference = models.CharField(
        max_length=32,
        unique=True,
        editable=False,
        help_text="Auto-generated reference like BC-2026-XXXX.",
    )
    supplier_name = models.CharField(max_length=255)
    subject = models.CharField(max_length=512, blank=True, default="")
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    status = models.CharField(
        max_length=16,
        choices=PurchaseOrderStatus.choices,
        default=PurchaseOrderStatus.PENDING,
    )
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-created_at", "id"]
        verbose_name = "Purchase order"
        verbose_name_plural = "Purchase orders"

    def save(self, *args, **kwargs):
        if not self.reference:
            self.reference = self._generate_reference()
        super().save(*args, **kwargs)

    @staticmethod
    def _generate_reference() -> str:
        from django.utils import timezone

        year = timezone.now().year
        last = (
            PurchaseOrder.objects.filter(reference__startswith=f"BC-{year}-")
            .order_by("-reference")
            .values_list("reference", flat=True)
            .first()
        )
        if last:
            seq = int(last.split("-")[-1]) + 1
        else:
            seq = 1
        return f"BC-{year}-{seq:04d}"

    def __str__(self) -> str:
        return f"{self.reference} – {self.supplier_name}"


class QuickExpenseCategory(models.TextChoices):
    OFFICE = "office", "office"
    TRANSPORT = "transport", "transport"
    CATERING = "catering", "catering"
    MAINTENANCE = "maintenance", "maintenance"
    OTHER = "other", "other"


class QuickExpense(UUIDModel, TimestampedModel):
    """Dépense rapide enregistrée par un opérateur."""

    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    category = models.CharField(
        max_length=32,
        choices=QuickExpenseCategory.choices,
        default=QuickExpenseCategory.OTHER,
    )
    description = models.TextField(blank=True, default="")
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="quick_expenses",
    )

    class Meta:
        ordering = ["-created_at", "id"]
        verbose_name = "Quick expense"
        verbose_name_plural = "Quick expenses"

    def __str__(self) -> str:
        return f"{self.amount} – {self.category}"
