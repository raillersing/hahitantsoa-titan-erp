from django.db import models

from apps.common.models import (
    AuditableModel,
    SoftDeleteModel,
    TimestampedModel,
    UUIDModel,
)


class Customer(UUIDModel, TimestampedModel, SoftDeleteModel, AuditableModel):
    display_name = models.CharField(max_length=255)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=64, blank=True)
    address = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["display_name"]
        verbose_name = "Customer"
        verbose_name_plural = "Customers"

    def __str__(self) -> str:
        return self.display_name
