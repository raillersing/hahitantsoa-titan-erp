from __future__ import annotations

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

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
