import django.core.validators
import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="PurchaseOrder",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "reference",
                    models.CharField(
                        editable=False,
                        help_text="Auto-generated reference like BC-2026-XXXX.",
                        max_length=32,
                        unique=True,
                    ),
                ),
                ("supplier_name", models.CharField(max_length=255)),
                ("subject", models.CharField(blank=True, default="", max_length=512)),
                (
                    "amount",
                    models.DecimalField(
                        decimal_places=2,
                        max_digits=12,
                        validators=[django.core.validators.MinValueValidator(0)],
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "pending"),
                            ("received", "received"),
                            ("cancelled", "cancelled"),
                        ],
                        default="pending",
                        max_length=16,
                    ),
                ),
                ("notes", models.TextField(blank=True, default="")),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "updated_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Purchase order",
                "verbose_name_plural": "Purchase orders",
                "ordering": ["-created_at", "id"],
            },
        ),
        migrations.CreateModel(
            name="QuickExpense",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "amount",
                    models.DecimalField(
                        decimal_places=2,
                        max_digits=12,
                        validators=[django.core.validators.MinValueValidator(0.01)],
                    ),
                ),
                (
                    "category",
                    models.CharField(
                        choices=[
                            ("office", "office"),
                            ("transport", "transport"),
                            ("catering", "catering"),
                            ("maintenance", "maintenance"),
                            ("other", "other"),
                        ],
                        default="other",
                        max_length=32,
                    ),
                ),
                ("description", models.TextField(blank=True, default="")),
                (
                    "recorded_by",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="quick_expenses",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Quick expense",
                "verbose_name_plural": "Quick expenses",
                "ordering": ["-created_at", "id"],
            },
        ),
    ]
