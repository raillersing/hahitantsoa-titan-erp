from django.db import models

from apps.common.models import (
    AuditableModel,
    SoftDeleteModel,
    TimestampedModel,
    UUIDModel,
)


class CustomerLifecycleStatus(models.TextChoices):
    PROSPECT = "prospect", "Prospect"
    CLIENT = "client", "Client"


class CustomerPartyType(models.TextChoices):
    INDIVIDUAL = "individual", "Particulier"
    COMPANY = "company", "Entreprise"


class Customer(UUIDModel, TimestampedModel, SoftDeleteModel, AuditableModel):
    display_name = models.CharField(max_length=255)
    lifecycle_status = models.CharField(
        max_length=16,
        choices=CustomerLifecycleStatus.choices,
        default=CustomerLifecycleStatus.CLIENT,
    )
    party_type = models.CharField(
        max_length=16,
        choices=CustomerPartyType.choices,
        default=CustomerPartyType.INDIVIDUAL,
    )
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=64, blank=True)
    address = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["display_name"]
        verbose_name = "Customer"
        verbose_name_plural = "Customers"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(
                    lifecycle_status__in=[status.value for status in CustomerLifecycleStatus]
                ),
                name="customer_lifecycle_status_allowed",
            ),
            models.CheckConstraint(
                condition=models.Q(
                    party_type__in=[party_type.value for party_type in CustomerPartyType]
                ),
                name="customer_party_type_allowed",
            ),
        ]

    def __str__(self) -> str:
        return self.display_name
