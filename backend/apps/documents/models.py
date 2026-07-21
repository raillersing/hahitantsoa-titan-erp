from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.common.models import TimestampedModel, UUIDModel
from apps.customers.models import Customer
from apps.hahitantsoa.models import HahitantsoaEventDraft
from apps.reservations.models import ReservationDraft


class DocumentInstanceStatus(models.TextChoices):
    PREPARED = "prepared", "prepared"
    GENERATED = "generated", "generated"
    ISSUED = "issued", "issued"
    VOIDED = "voided", "voided"


DOCUMENT_INSTANCE_STATUS_VALUES = [status.value for status in DocumentInstanceStatus]


class DocumentInstance(UUIDModel, TimestampedModel):
    reservation_draft = models.ForeignKey(
        ReservationDraft,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="document_instances",
    )
    hahitantsoa_event_draft = models.ForeignKey(
        HahitantsoaEventDraft,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="document_instances",
    )
    customer = models.ForeignKey(
        Customer,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="document_instances",
    )
    template_key = models.CharField(max_length=128)
    template_version = models.CharField(max_length=32)
    template_label = models.CharField(max_length=255)
    business_scope = models.CharField(max_length=32)
    document_type = models.CharField(max_length=128)
    template_status = models.CharField(max_length=64)
    template_source_kind = models.CharField(max_length=64)
    template_source_reference = models.TextField()
    template_path = models.CharField(max_length=512)
    template_preview_path = models.CharField(max_length=512)
    template_validated_by_client = models.BooleanField(default=False)
    template_notes = models.TextField(blank=True)
    reservation_public_reference = models.CharField(max_length=32)
    reservation_status = models.CharField(max_length=32)
    customer_display_name = models.CharField(max_length=255)
    customer_email = models.EmailField(blank=True)
    customer_phone = models.CharField(max_length=64, blank=True)
    customer_address = models.TextField(blank=True)
    status = models.CharField(
        max_length=32,
        choices=DocumentInstanceStatus.choices,
        default=DocumentInstanceStatus.PREPARED,
    )
    prepared_at = models.DateTimeField(default=timezone.now)
    prepared_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    voided_at = models.DateTimeField(null=True, blank=True)
    voided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    void_reason = models.TextField(blank=True)
    content_checksum = models.CharField(max_length=128, null=True, blank=True)
    storage_path = models.CharField(max_length=512, null=True, blank=True)
    generated_content_size_bytes = models.PositiveIntegerField(null=True, blank=True)
    pdf_storage_path = models.CharField(max_length=512, null=True, blank=True)
    pdf_generated_at = models.DateTimeField(null=True, blank=True)
    pdf_content_checksum = models.CharField(max_length=128, null=True, blank=True)
    valid_until = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["created_at", "id"]
        verbose_name = "Document instance"
        verbose_name_plural = "Document instances"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(status__in=DOCUMENT_INSTANCE_STATUS_VALUES),
                name="document_instance_status_allowed",
            ),
            models.CheckConstraint(
                condition=(
                    ~(
                        models.Q(reservation_draft__isnull=False)
                        & models.Q(hahitantsoa_event_draft__isnull=False)
                    )
                ),
                name="document_instance_single_draft_link",
            ),
            models.CheckConstraint(
                condition=(
                    (
                        ~models.Q(status=DocumentInstanceStatus.VOIDED)
                        & models.Q(voided_at__isnull=True)
                        & models.Q(voided_by__isnull=True)
                    )
                    | (
                        models.Q(status=DocumentInstanceStatus.VOIDED)
                        & models.Q(voided_at__isnull=False)
                        & models.Q(voided_by__isnull=False)
                    )
                ),
                name="document_instance_voided_marker_consistent",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.template_key} - {self.reservation_public_reference}"


class DocumentTemplateStatus(models.TextChoices):
    DRAFT = "draft", "draft"
    ACTIVE = "active", "active"
    ARCHIVED = "archived", "archived"


DOCUMENT_TEMPLATE_STATUS_VALUES = [s.value for s in DocumentTemplateStatus]


class DocumentTemplate(UUIDModel, TimestampedModel):
    code = models.CharField(max_length=128, unique=True)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    family = models.CharField(max_length=128, blank=True, default="")
    business_scope = models.CharField(max_length=32)
    document_type = models.CharField(max_length=128)
    status = models.CharField(
        max_length=32,
        choices=DocumentTemplateStatus.choices,
        default=DocumentTemplateStatus.DRAFT,
    )

    class Meta:
        ordering = ["code", "id"]
        verbose_name = "Document template"
        verbose_name_plural = "Document templates"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(status__in=DOCUMENT_TEMPLATE_STATUS_VALUES),
                name="document_template_status_allowed",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.code} ({self.name})"


class DocumentTemplateVersion(UUIDModel, TimestampedModel):
    template = models.ForeignKey(
        DocumentTemplate,
        on_delete=models.CASCADE,
        related_name="versions",
    )
    version = models.CharField(max_length=32)
    status = models.CharField(
        max_length=32,
        choices=DocumentTemplateStatus.choices,
        default=DocumentTemplateStatus.DRAFT,
    )
    body_html = models.TextField(blank=True, default="")
    header_html = models.TextField(blank=True, default="")
    footer_html = models.TextField(blank=True, default="")
    css = models.TextField(blank=True, default="")
    variables_schema = models.JSONField(null=True, blank=True)

    class Meta:
        ordering = ["template", "version", "id"]
        verbose_name = "Document template version"
        verbose_name_plural = "Document template versions"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(status__in=DOCUMENT_TEMPLATE_STATUS_VALUES),
                name="document_template_version_status_allowed",
            ),
            models.UniqueConstraint(
                fields=["template", "version"],
                name="document_template_version_unique_per_template",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.template.code} v{self.version}"
