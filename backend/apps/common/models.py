import uuid

from django.conf import settings
from django.db import models


class UUIDModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True


class TimestampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class SoftDeleteModel(models.Model):
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        abstract = True


class AuditableModel(models.Model):
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )

    class Meta:
        abstract = True


class NumberingSequenceBrand(models.TextChoices):
    TITAN = "titan", "Titan"
    HAHITANTSOA = "hahitantsoa", "Hahitantsoa"


class NumberingSequence(UUIDModel, TimestampedModel, AuditableModel):
    brand = models.CharField(
        max_length=32,
        choices=NumberingSequenceBrand.choices,
    )
    year = models.PositiveIntegerField()
    prefix = models.CharField(max_length=16, blank=True, default="")
    next_number = models.PositiveIntegerField(default=1)
    padding = models.PositiveSmallIntegerField(default=3)
    suffix_template = models.CharField(max_length=32, default="/{year}")

    class Meta:
        ordering = ["brand", "-year"]
        constraints = [
            models.UniqueConstraint(
                fields=["brand", "year"],
                name="unique_brand_year_numbering_sequence",
            )
        ]

    def __str__(self) -> str:
        return f"Sequence {self.brand} {self.year} (next: {self.next_number})"

    def format_reference(self, number: int) -> str:
        formatted_num = f"{number:0{self.padding}d}"
        suffix = (
            self.suffix_template.format(year=self.year)
            if "{year}" in self.suffix_template
            else self.suffix_template
        )
        return f"{self.prefix}{formatted_num}{suffix}"
