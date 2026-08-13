from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("hahitantsoa", "0001_initial"),
        ("logistics", "0006_logisticsevent_operation"),
    ]

    operations = [
        migrations.AlterField(
            model_name="logisticsevent",
            name="reservation_draft",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="logistics_events",
                to="reservations.reservationdraft",
            ),
        ),
        migrations.AddField(
            model_name="logisticsevent",
            name="hahitantsoa_event_draft",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="logistics_events",
                to="hahitantsoa.hahitantsoaeventdraft",
            ),
        ),
        migrations.AddConstraint(
            model_name="logisticsevent",
            constraint=models.CheckConstraint(
                condition=(
                    models.Q(
                        reservation_draft__isnull=False,
                        hahitantsoa_event_draft__isnull=True,
                    )
                    | models.Q(
                        reservation_draft__isnull=True,
                        hahitantsoa_event_draft__isnull=False,
                    )
                ),
                name="logistics_event_single_business_draft",
            ),
        ),
    ]
