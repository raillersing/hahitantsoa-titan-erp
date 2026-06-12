from django.conf import settings
from django.db import models

from apps.common.models import TimestampedModel, UUIDModel


class AuditEvent(UUIDModel, TimestampedModel):
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    action = models.CharField(max_length=128)
    target_type = models.CharField(max_length=128)
    target_id = models.CharField(max_length=128)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["created_at", "id"]
        verbose_name = "Audit event"
        verbose_name_plural = "Audit events"

    def __str__(self) -> str:
        return f"{self.action} {self.target_type} {self.target_id}"
