from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("hahitantsoa", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="hahitantsoaeventdraft",
            name="contract_signed_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="hahitantsoaeventdraft",
            name="contract_signed_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.SET_NULL,
                related_name="+",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="hahitantsoaeventdraft",
            name="required_deposit_received_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="hahitantsoaeventdraft",
            name="required_deposit_received_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.SET_NULL,
                related_name="+",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddConstraint(
            model_name="hahitantsoaeventdraft",
            constraint=models.CheckConstraint(
                condition=(
                    (
                        models.Q(("contract_signed_at__isnull", True))
                        & models.Q(("contract_signed_by__isnull", True))
                    )
                    | (
                        models.Q(("contract_signed_at__isnull", False))
                        & models.Q(("contract_signed_by__isnull", False))
                    )
                ),
                name="hahitantsoa_event_draft_contract_signed_marker_complete",
            ),
        ),
        migrations.AddConstraint(
            model_name="hahitantsoaeventdraft",
            constraint=models.CheckConstraint(
                condition=(
                    (
                        models.Q(("required_deposit_received_at__isnull", True))
                        & models.Q(("required_deposit_received_by__isnull", True))
                    )
                    | (
                        models.Q(("required_deposit_received_at__isnull", False))
                        & models.Q(("required_deposit_received_by__isnull", False))
                    )
                ),
                name="hahitantsoa_event_draft_required_deposit_received_marker_complete",
            ),
        ),
    ]
