from django.conf import settings
from django.db import models

from apps.common.models import TimestampedModel, UUIDModel


class ImportJobStatus(models.TextChoices):
    UPLOADING = "uploading", "uploading"
    MAPPING = "mapping", "mapping"
    PREVIEWING = "previewing", "previewing"
    VALIDATING = "validating", "validating"
    IMPORTING = "importing", "importing"
    COMPLETED = "completed", "completed"
    FAILED = "failed", "failed"


class ImportJob(UUIDModel, TimestampedModel):
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    filename = models.CharField(max_length=255)
    status = models.CharField(
        max_length=32,
        choices=ImportJobStatus.choices,
        default=ImportJobStatus.UPLOADING,
    )
    column_mapping = models.JSONField(default=dict, blank=True)
    total_rows = models.PositiveIntegerField(default=0)
    valid_rows = models.PositiveIntegerField(default=0)
    error_rows = models.PositiveIntegerField(default=0)
    error_log = models.JSONField(default=list, blank=True)
    target_model = models.CharField(max_length=128, blank=True, default="")

    class Meta:
        ordering = ["-created_at", "id"]
        verbose_name = "Import job"
        verbose_name_plural = "Import jobs"

    def __str__(self) -> str:
        return f"{self.filename} ({self.status})"
