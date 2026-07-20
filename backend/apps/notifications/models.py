from django.conf import settings
from django.db import models

from apps.common.models import TimestampedModel, UUIDModel


class NotificationType(models.TextChoices):
    PAYMENT = "payment", "payment"
    STOCK = "stock", "stock"
    IMPORT = "import", "import"
    RESERVATION = "reservation", "reservation"
    SYSTEM = "system", "system"


class SystemNotification(UUIDModel, TimestampedModel):
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
        null=True,
        blank=True,
    )
    notification_type = models.CharField(
        max_length=32,
        choices=NotificationType.choices,
        default=NotificationType.SYSTEM,
    )
    title = models.CharField(max_length=255)
    message = models.TextField(blank=True, default="")
    severity = models.CharField(
        max_length=16,
        choices=[
            ("info", "info"),
            ("warning", "warning"),
            ("success", "success"),
            ("error", "error"),
        ],
        default="info",
    )
    is_read = models.BooleanField(default=False)
    link = models.CharField(max_length=512, blank=True, default="")

    class Meta:
        ordering = ["-created_at", "id"]
        verbose_name = "System notification"
        verbose_name_plural = "System notifications"

    def __str__(self) -> str:
        return f"[{self.notification_type}] {self.title}"
