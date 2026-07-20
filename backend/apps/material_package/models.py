from __future__ import annotations

from django.db import models

from apps.common.models import AuditableModel, TimestampedModel, UUIDModel


class MaterialPackage(UUIDModel, TimestampedModel, AuditableModel):
    """A predefined bundle of inventory items that can be added to a reservation
    or event as a single unit."""

    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "Material Package"
        verbose_name_plural = "Material Packages"

    def __str__(self) -> str:
        status = "active" if self.is_active else "inactive"
        return f"{self.name} ({status})"


class MaterialPackageLine(UUIDModel, TimestampedModel):
    """A single line inside a material package, referencing an inventory item
    and a quantity."""

    package = models.ForeignKey(
        MaterialPackage,
        on_delete=models.CASCADE,
        related_name="lines",
    )
    inventory_item = models.ForeignKey(
        "inventory.InventoryItem",
        on_delete=models.PROTECT,
        related_name="material_package_lines",
    )
    quantity = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ["created_at", "id"]
        verbose_name = "Material Package Line"
        verbose_name_plural = "Material Package Lines"

    def __str__(self) -> str:
        return f"{self.package} - {self.inventory_item} x {self.quantity}"
