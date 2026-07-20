from __future__ import annotations

from django.db import models

from apps.common.models import AuditableModel, TimestampedModel, UUIDModel


class BlacklistedIntervenant(UUIDModel, TimestampedModel, AuditableModel):
    """An intervenant (staff member or external worker) who is blocked from
    participating in events or reservations."""

    name = models.CharField(max_length=255)
    note = models.TextField(blank=True, default="")
    is_active = models.BooleanField(
        default=True,
        help_text="Inactive entries represent lifted bans.",
    )

    class Meta:
        ordering = ["name"]
        verbose_name = "Blacklisted Intervenant"
        verbose_name_plural = "Blacklisted Intervenants"

    def __str__(self) -> str:
        status = "active" if self.is_active else "inactive"
        return f"{self.name} ({status})"
