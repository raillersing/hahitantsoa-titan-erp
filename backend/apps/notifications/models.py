from django.conf import settings
from django.core.exceptions import ValidationError
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


class PaymentReminderDispatch(UUIDModel, TimestampedModel):
    """Auditable, operator-reviewed payment reminder prepared for one dossier.

    The record deliberately stores a draft message only. Sending through an
    external channel requires a separate provider and consent decision.
    """

    reservation_draft = models.ForeignKey(
        "reservations.ReservationDraft",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="payment_reminder_dispatches",
    )
    hahitantsoa_event_draft = models.ForeignKey(
        "hahitantsoa.HahitantsoaEventDraft",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="payment_reminder_dispatches",
    )
    reminder_key = models.CharField(max_length=96)
    message = models.TextField()
    whatsapp_url = models.TextField(blank=True, default="")
    prepared_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="prepared_payment_reminders",
    )
    prepared_at = models.DateTimeField()

    class Meta:
        ordering = ["-prepared_at", "-created_at", "id"]
        constraints = [
            models.CheckConstraint(
                condition=(
                    (
                        models.Q(reservation_draft__isnull=False)
                        & models.Q(hahitantsoa_event_draft__isnull=True)
                    )
                    | (
                        models.Q(reservation_draft__isnull=True)
                        & models.Q(hahitantsoa_event_draft__isnull=False)
                    )
                ),
                name="payment_reminder_single_draft_link",
            ),
            models.UniqueConstraint(
                fields=["reservation_draft", "reminder_key"],
                condition=models.Q(reservation_draft__isnull=False),
                name="payment_reminder_reservation_key_unique",
            ),
            models.UniqueConstraint(
                fields=["hahitantsoa_event_draft", "reminder_key"],
                condition=models.Q(hahitantsoa_event_draft__isnull=False),
                name="payment_reminder_hahitantsoa_key_unique",
            ),
        ]

    def clean(self) -> None:
        if bool(self.reservation_draft_id) == bool(self.hahitantsoa_event_draft_id):
            raise ValidationError("A reminder must target exactly one business draft.")
        if not (self.reminder_key or "").strip():
            raise ValidationError({"reminder_key": "A reminder key is required."})
        if not (self.message or "").strip():
            raise ValidationError({"message": "A reminder message is required."})
