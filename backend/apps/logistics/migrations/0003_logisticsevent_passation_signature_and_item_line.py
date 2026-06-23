# Manually written for F163 — Logistics operator-ready expansion

import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("inventory", "0001_initial"),
        ("logistics", "0002_alter_logisticsevent_event_type_choices"),
    ]

    operations = [
        # Add passation signature fields to LogisticsEvent
        migrations.AddField(
            model_name="logisticsevent",
            name="signature_required",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="logisticsevent",
            name="signature_received",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="logisticsevent",
            name="signed_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="logisticsevent",
            name="signed_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="+",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        # Create LogisticsEventItemLine
        migrations.CreateModel(
            name="LogisticsEventItemLine",
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
                    "updated_by",
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
                        related_name="logistics_event_lines",
                        to="inventory.inventoryitem",
                    ),
                ),
                (
                    "logistics_event",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="item_lines",
                        to="logistics.logisticsevent",
                    ),
                ),
            ],
            options={
                "ordering": ["created_at", "id"],
                "verbose_name": "Logistics Event Item Line",
                "verbose_name_plural": "Logistics Event Item Lines",
            },
        ),
        migrations.AddConstraint(
            model_name="logisticseventitemline",
            constraint=models.UniqueConstraint(
                fields=["logistics_event", "inventory_item"],
                name="logistics_event_item_line_unique_item_per_event",
            ),
        ),
    ]
