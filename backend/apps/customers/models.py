from django.conf import settings
from django.core.exceptions import ValidationError
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


class DesiredDateWaitlistBusinessScope(models.TextChoices):
    TITAN = "titan", "Titan"
    HAHITANTSOA = "hahitantsoa", "Hahitantsoa"


class DesiredDateWaitlistInterestKind(models.TextChoices):
    MATERIAL = "material", "Matériel"
    MATERIAL_PACK = "material_pack", "Pack matériel"
    LOCAL = "local", "Local"
    SERVICE = "service", "Service"


class DesiredDateWaitlistStatus(models.TextChoices):
    NEW = "new", "Nouveau"
    CONTACTED = "contacted", "Contacté"
    CONVERTED = "converted", "Converti"
    LOST = "lost", "Perdu"
    CANCELLED = "cancelled", "Annulé"


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


class DesiredDateWaitlistEntry(UUIDModel, TimestampedModel, AuditableModel):
    customer = models.ForeignKey(
        Customer,
        on_delete=models.PROTECT,
        related_name="desired_date_waitlist_entries",
    )
    business_scope = models.CharField(
        max_length=16,
        choices=DesiredDateWaitlistBusinessScope.choices,
    )
    preferred_date_1 = models.DateField(null=True, blank=True)
    preferred_date_2 = models.DateField(null=True, blank=True)
    preferred_date_3 = models.DateField(null=True, blank=True)
    flexible_start = models.DateField(null=True, blank=True)
    flexible_end = models.DateField(null=True, blank=True)
    interest_kind = models.CharField(
        max_length=16,
        choices=DesiredDateWaitlistInterestKind.choices,
    )
    quantity = models.PositiveIntegerField()
    responsible = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="responsible_desired_date_waitlist_entries",
    )
    status = models.CharField(
        max_length=16,
        choices=DesiredDateWaitlistStatus.choices,
        default=DesiredDateWaitlistStatus.NEW,
    )

    class Meta:
        ordering = ["created_at"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(quantity__gt=0),
                name="desired_date_waitlist_quantity_positive",
            ),
            models.CheckConstraint(
                condition=models.Q(
                    business_scope__in=[scope.value for scope in DesiredDateWaitlistBusinessScope]
                ),
                name="desired_date_waitlist_scope_allowed",
            ),
            models.CheckConstraint(
                condition=models.Q(
                    interest_kind__in=[kind.value for kind in DesiredDateWaitlistInterestKind]
                ),
                name="desired_date_waitlist_interest_allowed",
            ),
            models.CheckConstraint(
                condition=models.Q(
                    status__in=[status.value for status in DesiredDateWaitlistStatus]
                ),
                name="desired_date_waitlist_status_allowed",
            ),
            models.CheckConstraint(
                condition=(
                    ~models.Q(business_scope=DesiredDateWaitlistBusinessScope.TITAN)
                    | models.Q(
                        interest_kind__in=[
                            DesiredDateWaitlistInterestKind.MATERIAL,
                            DesiredDateWaitlistInterestKind.MATERIAL_PACK,
                        ]
                    )
                ),
                name="desired_date_waitlist_titan_interest_allowed",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(
                        models.Q(preferred_date_1__isnull=False),
                        (
                            models.Q(preferred_date_2__isnull=True, preferred_date_3__isnull=True)
                            | models.Q(
                                preferred_date_2__isnull=False, preferred_date_3__isnull=True
                            )
                            | models.Q(
                                preferred_date_2__isnull=False, preferred_date_3__isnull=False
                            )
                        ),
                        flexible_start__isnull=True,
                        flexible_end__isnull=True,
                    )
                    | models.Q(
                        preferred_date_1__isnull=True,
                        preferred_date_2__isnull=True,
                        preferred_date_3__isnull=True,
                        flexible_start__isnull=False,
                        flexible_end__isnull=False,
                    )
                ),
                name="desired_date_waitlist_date_selection_valid",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(flexible_start__isnull=True)
                    | models.Q(flexible_end__isnull=True)
                    | models.Q(flexible_start__lte=models.F("flexible_end"))
                ),
                name="desired_date_waitlist_flexible_period_valid",
            ),
            models.CheckConstraint(
                condition=(
                    (
                        models.Q(preferred_date_1__isnull=True)
                        | models.Q(preferred_date_2__isnull=True)
                    )
                    | ~models.Q(preferred_date_1=models.F("preferred_date_2"))
                )
                & (
                    (
                        models.Q(preferred_date_1__isnull=True)
                        | models.Q(preferred_date_3__isnull=True)
                    )
                    | ~models.Q(preferred_date_1=models.F("preferred_date_3"))
                )
                & (
                    (
                        models.Q(preferred_date_2__isnull=True)
                        | models.Q(preferred_date_3__isnull=True)
                    )
                    | ~models.Q(preferred_date_2=models.F("preferred_date_3"))
                ),
                name="desired_date_waitlist_preferred_dates_distinct",
            ),
            models.CheckConstraint(
                condition=(
                    ~models.Q(business_scope=DesiredDateWaitlistBusinessScope.HAHITANTSOA)
                    | models.Q(
                        interest_kind__in=[
                            DesiredDateWaitlistInterestKind.LOCAL,
                            DesiredDateWaitlistInterestKind.MATERIAL,
                            DesiredDateWaitlistInterestKind.SERVICE,
                        ]
                    )
                ),
                name="desired_date_waitlist_hah_interest_allowed",
            ),
        ]

    def clean(self) -> None:
        super().clean()
        preferred_dates = tuple(
            value
            for value in (
                self.preferred_date_1,
                self.preferred_date_2,
                self.preferred_date_3,
            )
            if value is not None
        )
        has_flexible_period = self.flexible_start is not None or self.flexible_end is not None
        if preferred_dates and has_flexible_period:
            raise ValidationError("Use preferred dates or a flexible period, not both.")
        if not preferred_dates and not has_flexible_period:
            raise ValidationError("Provide one to three preferred dates or a flexible period.")
        if has_flexible_period and (self.flexible_start is None or self.flexible_end is None):
            raise ValidationError("A flexible period requires both start and end dates.")
        if self.flexible_start and self.flexible_end and self.flexible_start > self.flexible_end:
            raise ValidationError("Flexible period start must not follow its end.")
        if len(preferred_dates) != len(set(preferred_dates)):
            raise ValidationError("Preferred dates must be distinct.")
        if (
            self.business_scope == DesiredDateWaitlistBusinessScope.TITAN
            and self.interest_kind
            not in {
                DesiredDateWaitlistInterestKind.MATERIAL,
                DesiredDateWaitlistInterestKind.MATERIAL_PACK,
            }
        ):
            raise ValidationError("Titan waitlist entries only accept material or material packs.")
        if (
            self.business_scope == DesiredDateWaitlistBusinessScope.HAHITANTSOA
            and self.interest_kind
            not in {
                DesiredDateWaitlistInterestKind.LOCAL,
                DesiredDateWaitlistInterestKind.MATERIAL,
                DesiredDateWaitlistInterestKind.SERVICE,
            }
        ):
            raise ValidationError("Unsupported Hahitantsoa interest kind.")
