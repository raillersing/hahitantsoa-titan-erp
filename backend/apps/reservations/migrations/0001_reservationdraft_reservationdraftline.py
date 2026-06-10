# Generated manually for F100 after local makemigrations could not run
# without database environment values.

import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models

import apps.reservations.models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("customers", "0001_initial"),
        ("inventory", "0002_inventoryavailability"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="ReservationDraft",
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
                ("is_deleted", models.BooleanField(default=False)),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                (
                    "public_reference",
                    models.CharField(
                        default=apps.reservations.models.generate_reservation_draft_public_reference,
                        max_length=32,
                        unique=True,
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[("draft", "draft")],
                        default="draft",
                        max_length=32,
                    ),
                ),
                ("start_at", models.DateTimeField()),
                ("end_at", models.DateTimeField()),
                ("notes", models.TextField(blank=True)),
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
                    "customer",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="reservation_drafts",
                        to="customers.customer",
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
                "verbose_name": "Reservation draft",
                "verbose_name_plural": "Reservation drafts",
                "ordering": ["-created_at", "public_reference"],
                "constraints": [
                    models.CheckConstraint(
                        condition=models.Q(("status__in", ["draft"])),
                        name="reservation_draft_status_allowed",
                    ),
                    models.CheckConstraint(
                        condition=models.Q(("end_at__gt", models.F("start_at"))),
                        name="reservation_draft_end_after_start",
                    ),
                ],
            },
        ),
        migrations.CreateModel(
            name="ReservationDraftLine",
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
                ("is_deleted", models.BooleanField(default=False)),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                ("quantity", models.PositiveIntegerField(default=1)),
                ("notes", models.TextField(blank=True)),
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
                    "inventory_item",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="reservation_draft_lines",
                        to="inventory.inventoryitem",
                    ),
                ),
                (
                    "reservation_draft",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="lines",
                        to="reservations.reservationdraft",
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
                "verbose_name": "Reservation draft line",
                "verbose_name_plural": "Reservation draft lines",
                "ordering": ["created_at", "id"],
                "constraints": [
                    models.CheckConstraint(
                        condition=models.Q(("quantity__gte", 1)),
                        name="reservation_draft_line_quantity_positive",
                    ),
                    models.UniqueConstraint(
                        fields=("reservation_draft", "inventory_item"),
                        name="reservation_draft_line_unique_item",
                    ),
                ],
            },
        ),
    ]
