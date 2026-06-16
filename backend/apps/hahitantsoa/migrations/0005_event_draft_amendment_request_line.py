from django.conf import settings
import django.db.models.deletion
from django.db import migrations, models
import uuid


class Migration(migrations.Migration):
    dependencies = [
        ("inventory", "0004_inventoryavailability_hahitantsoa_event_draft"),
        ("hahitantsoa", "0004_event_draft_amendment_request"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="HahitantsoaEventDraftAmendmentRequestLine",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("is_deleted", models.BooleanField(default=False)),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                (
                    "quantity",
                    models.PositiveIntegerField(default=1),
                ),
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
                    "amendment_request",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="lines",
                        to="hahitantsoa.hahitantsoaeventdraftamendmentrequest",
                    ),
                ),
                (
                    "inventory_item",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="hahitantsoa_event_draft_amendment_request_lines",
                        to="inventory.inventoryitem",
                    ),
                ),
            ],
            options={
                "verbose_name": "Hahitantsoa event draft amendment request line",
                "verbose_name_plural": "Hahitantsoa event draft amendment request lines",
                "ordering": ["created_at", "id"],
            },
        ),
        migrations.AddConstraint(
            model_name="hahitantsoaeventdraftamendmentrequestline",
            constraint=models.CheckConstraint(
                condition=models.Q(("quantity__gte", 1)),
                name="hahitantsoa_event_draft_amendment_request_line_quantity_positive",
            ),
        ),
        migrations.AddConstraint(
            model_name="hahitantsoaeventdraftamendmentrequestline",
            constraint=models.UniqueConstraint(
                fields=("amendment_request", "inventory_item"),
                name="hahitantsoa_event_draft_amendment_request_line_unique_item",
            ),
        ),
    ]
