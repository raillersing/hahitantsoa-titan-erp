from django.core.exceptions import ValidationError
from django.db import models

from apps.common.models import (
    AuditableModel,
    SoftDeleteModel,
    TimestampedModel,
    UUIDModel,
)
from apps.inventory.scope import InventoryItemKind, assert_titan_allowed_item_kind

INVENTORY_ITEM_KIND_CHOICES = [
    (item_kind.value, item_kind.value) for item_kind in InventoryItemKind
]
INVENTORY_ITEM_KIND_VALUES = [item_kind.value for item_kind in InventoryItemKind]


class InventoryItem(UUIDModel, TimestampedModel, SoftDeleteModel, AuditableModel):
    name = models.CharField(max_length=255)
    kind = models.CharField(max_length=32, choices=INVENTORY_ITEM_KIND_CHOICES)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "Inventory item"
        verbose_name_plural = "Inventory items"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(kind__in=INVENTORY_ITEM_KIND_VALUES),
                name="inventory_item_kind_allowed_for_titan",
            ),
        ]

    def clean(self) -> None:
        try:
            item_kind = assert_titan_allowed_item_kind(self.kind)
        except ValueError as error:
            raise ValidationError(
                {"kind": "Inventory item kind is not allowed for Titan."}
            ) from error

        self.kind = item_kind.value

    def __str__(self) -> str:
        return self.name
