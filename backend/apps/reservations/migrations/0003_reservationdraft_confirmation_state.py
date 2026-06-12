# Generated manually for F121G after local makemigrations could not run
# without database environment values.

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("reservations", "0002_reservationdraft_confirmation_prerequisites"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name="reservationdraft",
            name="reservation_draft_status_allowed",
        ),
        migrations.AddField(
            model_name="reservationdraft",
            name="confirmed_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="reservationdraft",
            name="confirmed_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="+",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AlterField(
            model_name="reservationdraft",
            name="status",
            field=models.CharField(
                choices=[("draft", "draft"), ("confirmed", "confirmed")],
                default="draft",
                max_length=32,
            ),
        ),
        migrations.AddConstraint(
            model_name="reservationdraft",
            constraint=models.CheckConstraint(
                condition=models.Q(("status__in", ["draft", "confirmed"])),
                name="reservation_draft_status_allowed",
            ),
        ),
    ]
