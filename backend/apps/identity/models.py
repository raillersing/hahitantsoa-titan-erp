from __future__ import annotations

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from apps.common.models import AuditableModel, TimestampedModel, UUIDModel


class LoginAttemptBucket(models.Model):
    class Dimension(models.TextChoices):
        ACCOUNT = "account", "Account"
        ACCOUNT_PEER = "account_peer", "Account and transport peer"
        TRANSPORT_PEER = "transport_peer", "Transport peer"

    key = models.CharField(max_length=64, primary_key=True)
    dimension = models.CharField(max_length=16, choices=Dimension.choices)
    attempt_count = models.PositiveIntegerField(default=0)
    window_started_at = models.DateTimeField()
    expires_at = models.DateTimeField(db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["key"]
        verbose_name = "Login attempt bucket"
        verbose_name_plural = "Login attempt buckets"


class ApplicationRole(UUIDModel, TimestampedModel, AuditableModel):
    name = models.CharField(max_length=64, unique=True)
    slug = models.SlugField(max_length=64, unique=True)
    description = models.TextField(blank=True)
    is_system_managed = models.BooleanField(
        default=False,
        help_text=(
            "System-managed roles are seeded automatically and should not be "
            "removed by administrators."
        ),
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "Application Role"
        verbose_name_plural = "Application Roles"

    def __str__(self) -> str:
        return self.name

    def clean(self) -> None:
        super().clean()
        if self.is_system_managed and not self.is_active:
            raise ValidationError("System-managed roles cannot be deactivated.")


class UserRoleAssignment(UUIDModel, TimestampedModel, AuditableModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="role_assignments",
    )
    role = models.ForeignKey(
        ApplicationRole,
        on_delete=models.CASCADE,
        related_name="user_assignments",
    )
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    assigned_at = models.DateTimeField(auto_now_add=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-assigned_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "role"],
                condition=models.Q(is_active=True),
                name="unique_active_user_role",
                violation_error_message="This user already has an active assignment for this role.",
            ),
        ]

    def clean(self) -> None:
        super().clean()
        if self.is_active and self.revoked_at is not None:
            raise ValidationError("An active assignment cannot have a revocation date.")
        if not self.is_active and self.revoked_at is None:
            raise ValidationError("A revoked assignment must have a revocation date.")


class DeviceType(models.TextChoices):
    DESKTOP = "desktop", "Ordinateur"
    MOBILE = "mobile", "Smartphone"
    TABLET = "tablet", "Tablette"
    UNKNOWN = "unknown", "Inconnu"


class UserDeviceSession(UUIDModel, TimestampedModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="device_sessions",
        db_index=True,
    )
    session_key = models.CharField(max_length=64, db_index=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    device_type = models.CharField(
        max_length=16,
        choices=DeviceType.choices,
        default=DeviceType.UNKNOWN,
    )
    device_name = models.CharField(max_length=64, default="Appareil inconnu")
    os_name = models.CharField(max_length=64, blank=True)
    browser_name = models.CharField(max_length=64, blank=True)
    client_platform = models.CharField(max_length=64, blank=True)
    logged_in_at = models.DateTimeField(default=timezone.now, db_index=True)
    last_seen_at = models.DateTimeField(default=timezone.now, db_index=True)
    is_active = models.BooleanField(default=True, db_index=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    revoked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    revocation_reason = models.CharField(max_length=64, blank=True)

    class Meta:
        ordering = ["-last_seen_at"]
        verbose_name = "Session d'appareil utilisateur"
        verbose_name_plural = "Sessions d'appareils utilisateurs"

    def __str__(self) -> str:
        return f"{self.user} - {self.device_name} ({self.session_key[:8]}...)"
