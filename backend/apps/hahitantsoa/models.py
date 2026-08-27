import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from apps.common.models import AuditableModel, SoftDeleteModel, TimestampedModel, UUIDModel
from apps.customers.models import Customer
from apps.hahitantsoa.scope import assert_hahitantsoa_shared_inventory_item_kind
from apps.inventory.models import InventoryItem
from apps.reservations.periods import validate_reservation_period


class HahitantsoaEventDraftStatus(models.TextChoices):
    DRAFT = "draft", "draft"
    CONFIRMED = "confirmed", "confirmed"


HAHITANTSOA_EVENT_DRAFT_STATUS_VALUES = [status.value for status in HahitantsoaEventDraftStatus]


class HahitantsoaEventType(models.TextChoices):
    WEDDING = "wedding", "Mariage"
    ENGAGEMENT = "engagement", "Fiançailles"
    CIVIL_WEDDING = "civil_wedding", "Mariage civil"
    OTHER = "other", "Autre"


class HahitantsoaRentalType(models.TextChoices):
    BARE = "bare", "Location nue"
    LOGISTICS = "logistics", "Location + logistique"


class HahitantsoaEventDraftAmendmentRequestStatus(models.TextChoices):
    DRAFT = "draft", "draft"
    APPLIED = "applied", "applied"


HAHITANTSOA_EVENT_DRAFT_AMENDMENT_REQUEST_STATUS_VALUES = [
    status.value for status in HahitantsoaEventDraftAmendmentRequestStatus
]


def generate_hahitantsoa_event_draft_public_reference() -> str:
    return f"HED-{uuid.uuid4().hex[:12].upper()}"


class HahitantsoaEventDraft(UUIDModel, TimestampedModel, SoftDeleteModel, AuditableModel):
    customer = models.ForeignKey(
        Customer,
        on_delete=models.PROTECT,
        related_name="hahitantsoa_event_drafts",
    )
    public_reference = models.CharField(
        max_length=32,
        unique=True,
        default=generate_hahitantsoa_event_draft_public_reference,
    )
    status = models.CharField(
        max_length=32,
        choices=HahitantsoaEventDraftStatus.choices,
        default=HahitantsoaEventDraftStatus.DRAFT,
    )
    contract_signed_at = models.DateTimeField(null=True, blank=True)
    contract_signed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    required_deposit_received_at = models.DateTimeField(null=True, blank=True)
    required_deposit_received_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    confirmed_at = models.DateTimeField(null=True, blank=True)
    confirmed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    event_name = models.CharField(max_length=255)
    event_type = models.CharField(
        max_length=32,
        choices=HahitantsoaEventType.choices,
        default=HahitantsoaEventType.OTHER,
    )
    rental_type = models.CharField(
        max_length=16,
        choices=HahitantsoaRentalType.choices,
        default=HahitantsoaRentalType.BARE,
    )
    guest_count = models.PositiveIntegerField(default=0)
    space_rental_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    required_deposit_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    venue_name = models.CharField(max_length=255, blank=True)
    location_details = models.TextField(blank=True)
    service_notes = models.TextField(blank=True)
    start_at = models.DateTimeField()
    end_at = models.DateTimeField()
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at", "public_reference"]
        verbose_name = "Hahitantsoa event draft"
        verbose_name_plural = "Hahitantsoa event drafts"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(status__in=HAHITANTSOA_EVENT_DRAFT_STATUS_VALUES),
                name="hahitantsoa_event_draft_status_allowed",
            ),
            models.CheckConstraint(
                condition=models.Q(
                    rental_type__in=[choice.value for choice in HahitantsoaRentalType]
                ),
                name="hahitantsoa_event_draft_rental_type_allowed",
            ),
            models.CheckConstraint(
                condition=models.Q(space_rental_amount__gte=0),
                name="hahitantsoa_event_draft_space_rental_amount_nonnegative",
            ),
            models.CheckConstraint(
                condition=models.Q(required_deposit_amount__gte=0),
                name="hahitantsoa_event_draft_required_deposit_amount_nonnegative",
            ),
            models.CheckConstraint(
                condition=models.Q(end_at__gt=models.F("start_at")),
                name="hahitantsoa_event_draft_end_after_start",
            ),
            models.CheckConstraint(
                condition=(
                    (
                        models.Q(contract_signed_at__isnull=True)
                        & models.Q(contract_signed_by__isnull=True)
                    )
                    | (
                        models.Q(contract_signed_at__isnull=False)
                        & models.Q(contract_signed_by__isnull=False)
                    )
                ),
                name="hahitantsoa_event_draft_contract_signed_marker_complete",
            ),
            models.CheckConstraint(
                condition=(
                    (
                        models.Q(required_deposit_received_at__isnull=True)
                        & models.Q(required_deposit_received_by__isnull=True)
                    )
                    | (
                        models.Q(required_deposit_received_at__isnull=False)
                        & models.Q(required_deposit_received_by__isnull=False)
                    )
                ),
                name="hahitantsoa_event_draft_required_deposit_received_marker_complete",
            ),
            models.CheckConstraint(
                condition=(
                    (models.Q(confirmed_at__isnull=True) & models.Q(confirmed_by__isnull=True))
                    | (models.Q(confirmed_at__isnull=False) & models.Q(confirmed_by__isnull=False))
                ),
                name="hahitantsoa_event_draft_confirmed_marker_complete",
            ),
        ]

    def clean(self) -> None:
        try:
            validate_reservation_period(start_at=self.start_at, end_at=self.end_at)
        except (TypeError, ValueError) as error:
            raise ValidationError({"end_at": str(error)}) from error

        if self.customer_id and (not self.customer.is_active or self.customer.is_deleted):
            raise ValidationError({"customer": "Hahitantsoa event draft customer must be active."})

    def __str__(self) -> str:
        return self.public_reference


class HahitantsoaEventDraftLine(UUIDModel, TimestampedModel, SoftDeleteModel, AuditableModel):
    event_draft = models.ForeignKey(
        HahitantsoaEventDraft,
        on_delete=models.CASCADE,
        related_name="lines",
    )
    inventory_item = models.ForeignKey(
        InventoryItem,
        on_delete=models.PROTECT,
        related_name="hahitantsoa_event_draft_lines",
    )
    quantity = models.PositiveIntegerField(default=1)
    unit_rental_price = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["created_at", "id"]
        verbose_name = "Hahitantsoa event draft line"
        verbose_name_plural = "Hahitantsoa event draft lines"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(quantity__gte=1),
                name="hahitantsoa_event_draft_line_quantity_positive",
            ),
            models.CheckConstraint(
                condition=models.Q(unit_rental_price__gte=0),
                name="hahitantsoa_event_draft_line_unit_rental_price_nonnegative",
            ),
            models.UniqueConstraint(
                fields=["event_draft", "inventory_item"],
                name="hahitantsoa_event_draft_line_unique_item",
            ),
        ]

    def clean(self) -> None:
        if self.quantity < 1:
            raise ValidationError({"quantity": "Quantity must be greater than zero."})

        try:
            assert_hahitantsoa_shared_inventory_item_kind(self.inventory_item.kind)
        except ValueError as error:
            raise ValidationError(
                {
                    "inventory_item": (
                        "Inventory item kind is not allowed for Hahitantsoa shared event drafts."
                    )
                }
            ) from error

        if not self.inventory_item.is_active or self.inventory_item.is_deleted:
            raise ValidationError(
                {"inventory_item": "Hahitantsoa event draft item must be active."}
            )

    def __str__(self) -> str:
        return f"{self.event_draft} - {self.inventory_item} x {self.quantity}"


class HahitantsoaCommercialTerms(UUIDModel, TimestampedModel, AuditableModel):
    """The single editable source of the Hahitantsoa default commercial terms."""

    key = models.CharField(max_length=32, unique=True, default="default", editable=False)
    base_space_rental_amount = models.DecimalField(max_digits=14, decimal_places=2, default=6500000)
    included_guest_count = models.PositiveIntegerField(default=250)
    excess_guest_amount = models.DecimalField(max_digits=14, decimal_places=2, default=5000)
    bare_deposit_amount = models.DecimalField(max_digits=14, decimal_places=2, default=1000000)
    logistics_deposit_amount = models.DecimalField(max_digits=14, decimal_places=2, default=1500000)
    night_option_1_amount = models.DecimalField(max_digits=14, decimal_places=2, default=300000)
    night_option_2_amount = models.DecimalField(max_digits=14, decimal_places=2, default=500000)
    night_security_amount = models.DecimalField(max_digits=14, decimal_places=2, default=120000)
    caution_amount = models.DecimalField(max_digits=14, decimal_places=2, default=500000)

    class Meta:
        verbose_name = "Hahitantsoa commercial terms"
        verbose_name_plural = "Hahitantsoa commercial terms"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(base_space_rental_amount__gte=0),
                name="hahitantsoa_terms_base_space_rental_nonnegative",
            ),
            models.CheckConstraint(
                condition=models.Q(excess_guest_amount__gte=0),
                name="hahitantsoa_terms_excess_guest_amount_nonnegative",
            ),
            models.CheckConstraint(
                condition=models.Q(bare_deposit_amount__gte=0),
                name="hahitantsoa_terms_bare_deposit_nonnegative",
            ),
            models.CheckConstraint(
                condition=models.Q(logistics_deposit_amount__gte=0),
                name="hahitantsoa_terms_logistics_deposit_nonnegative",
            ),
            models.CheckConstraint(
                condition=models.Q(night_option_1_amount__gte=0),
                name="hahitantsoa_terms_night_option_1_nonnegative",
            ),
            models.CheckConstraint(
                condition=models.Q(night_option_2_amount__gte=0),
                name="hahitantsoa_terms_night_option_2_nonnegative",
            ),
            models.CheckConstraint(
                condition=models.Q(night_security_amount__gte=0),
                name="hahitantsoa_terms_night_security_nonnegative",
            ),
            models.CheckConstraint(
                condition=models.Q(caution_amount__gte=0),
                name="hahitantsoa_terms_caution_amount_nonnegative",
            ),
        ]

    def __str__(self) -> str:
        return "Hahitantsoa commercial terms"


class HahitantsoaEventDraftAmendmentRequest(UUIDModel, TimestampedModel, AuditableModel):
    event_draft = models.ForeignKey(
        HahitantsoaEventDraft,
        on_delete=models.PROTECT,
        related_name="amendment_requests",
    )
    status = models.CharField(
        max_length=32,
        choices=HahitantsoaEventDraftAmendmentRequestStatus.choices,
        default=HahitantsoaEventDraftAmendmentRequestStatus.DRAFT,
    )
    reason = models.CharField(max_length=255, blank=True)
    notes = models.TextField(blank=True)
    changed_start_at = models.DateTimeField(null=True, blank=True)
    changed_end_at = models.DateTimeField(null=True, blank=True)
    changed_event_name = models.CharField(max_length=255, blank=True)
    changed_event_type = models.CharField(max_length=32, blank=True)
    changed_venue_name = models.CharField(max_length=255, blank=True)
    changed_location_details = models.TextField(blank=True)
    changed_service_notes = models.TextField(blank=True)
    changed_notes = models.TextField(blank=True)
    amendment_sequence = models.PositiveSmallIntegerField(null=True, blank=True)
    document_instance_id = models.UUIDField(null=True, blank=True)
    source_contract_document_id = models.UUIDField(null=True, blank=True)
    applied_at = models.DateTimeField(null=True, blank=True)
    applied_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )

    class Meta:
        ordering = ["created_at", "id"]
        verbose_name = "Hahitantsoa event draft amendment request"
        verbose_name_plural = "Hahitantsoa event draft amendment requests"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(
                    status__in=HAHITANTSOA_EVENT_DRAFT_AMENDMENT_REQUEST_STATUS_VALUES
                ),
                name="hahitantsoa_event_draft_amendment_request_status_allowed",
            )
        ]

    def __str__(self) -> str:
        return f"{self.event_draft} amendment request {self.id}"


class HahitantsoaEventDraftAmendmentRequestLine(
    UUIDModel, TimestampedModel, SoftDeleteModel, AuditableModel
):
    amendment_request = models.ForeignKey(
        HahitantsoaEventDraftAmendmentRequest,
        on_delete=models.CASCADE,
        related_name="lines",
    )
    inventory_item = models.ForeignKey(
        InventoryItem,
        on_delete=models.PROTECT,
        related_name="hahitantsoa_event_draft_amendment_request_lines",
    )
    quantity = models.PositiveIntegerField(default=1)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["created_at", "id"]
        verbose_name = "Hahitantsoa event draft amendment request line"
        verbose_name_plural = "Hahitantsoa event draft amendment request lines"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(quantity__gte=1),
                name="hahitantsoa_event_draft_amendment_request_line_quantity_positive",
            ),
            models.UniqueConstraint(
                fields=["amendment_request", "inventory_item"],
                name="hahitantsoa_event_draft_amendment_request_line_unique_item",
            ),
        ]

    def clean(self) -> None:
        if self.quantity < 1:
            raise ValidationError({"quantity": "Quantity must be greater than zero."})

        try:
            assert_hahitantsoa_shared_inventory_item_kind(self.inventory_item.kind)
        except ValueError as error:
            raise ValidationError(
                {
                    "inventory_item": (
                        "Inventory item kind is not allowed for Hahitantsoa "
                        "amendment request lines."
                    )
                }
            ) from error

        if not self.inventory_item.is_active or self.inventory_item.is_deleted:
            raise ValidationError(
                {"inventory_item": "Hahitantsoa amendment request item must be active."}
            )

    def __str__(self) -> str:
        return f"{self.amendment_request} - {self.inventory_item} x {self.quantity}"


class HahitantsoaVenue(UUIDModel, TimestampedModel, AuditableModel):
    name = models.CharField(max_length=255)
    type = models.CharField(max_length=128, blank=True, default="")
    capacity = models.PositiveIntegerField(null=True, blank=True)
    active = models.BooleanField(default=True)
    note = models.TextField(blank=True, default="")
    price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    usage = models.CharField(max_length=255, blank=True, default="")
    volet = models.CharField(max_length=255, blank=True, default="")
    is_default = models.BooleanField(default=False)

    class Meta:
        ordering = ["name", "id"]
        verbose_name = "Hahitantsoa venue"
        verbose_name_plural = "Hahitantsoa venues"

    def __str__(self) -> str:
        return self.name


class HahitantsoaServiceCategory(models.TextChoices):
    DRAPERY = "drapery", "Draperie & Voilage"
    STARRY_SKY = "starry_sky", "Ciel étoilé"
    SCENOGRAPHY = "scenography", "Piste & Scénographie"
    SPECIAL_EFFECTS = "special_effects", "Effets spéciaux"
    TECHNICAL_FACILITY = "technical_facility", "Prestations techniques & Aménagement"
    OTHER = "other", "Autre prestation"


class HahitantsoaServicePricingType(models.TextChoices):
    FLAT_FEE = "flat_fee", "Forfait"
    PER_LINE = "per_line", "À la ligne"
    PER_UNIT = "per_unit", "Unitaire"
    ON_QUOTE = "on_quote", "Sur devis"


class HahitantsoaService(UUIDModel, TimestampedModel, AuditableModel):
    name = models.CharField(max_length=255)
    category = models.CharField(
        max_length=32,
        choices=HahitantsoaServiceCategory.choices,
        default=HahitantsoaServiceCategory.OTHER,
    )
    pricing_type = models.CharField(
        max_length=16,
        choices=HahitantsoaServicePricingType.choices,
        default=HahitantsoaServicePricingType.FLAT_FEE,
    )
    desc = models.TextField(blank=True, default="")
    price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    unit_label = models.CharField(max_length=64, blank=True, default="")
    image_url = models.TextField(blank=True, default="")
    features = models.JSONField(default=list, blank=True)
    is_external_fee = models.BooleanField(default=False)
    active = models.BooleanField(default=True)

    class Meta:
        ordering = ["category", "name", "id"]
        verbose_name = "Hahitantsoa service"
        verbose_name_plural = "Hahitantsoa services"

    def __str__(self) -> str:
        return self.name
