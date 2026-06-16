import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("hahitantsoa", "0002_event_draft_confirmation_prerequisites"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="hahitantsoaeventdraft",
            name="confirmed_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="hahitantsoaeventdraft",
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
            model_name="hahitantsoaeventdraft",
            name="status",
            field=models.CharField(
                choices=[("draft", "draft"), ("confirmed", "confirmed")],
                default="draft",
                max_length=32,
            ),
        ),
        migrations.RemoveConstraint(
            model_name="hahitantsoaeventdraft",
            name="hahitantsoa_event_draft_status_allowed",
        ),
        migrations.AddConstraint(
            model_name="hahitantsoaeventdraft",
            constraint=models.CheckConstraint(
                condition=models.Q(("status__in", ["draft", "confirmed"])),
                name="hahitantsoa_event_draft_status_allowed",
            ),
        ),
        migrations.AddConstraint(
            model_name="hahitantsoaeventdraft",
            constraint=models.CheckConstraint(
                condition=(
                    (
                        models.Q(("confirmed_at__isnull", True))
                        & models.Q(("confirmed_by__isnull", True))
                    )
                    | (
                        models.Q(("confirmed_at__isnull", False))
                        & models.Q(("confirmed_by__isnull", False))
                    )
                ),
                name="hahitantsoa_event_draft_confirmed_marker_complete",
            ),
        ),
    ]
