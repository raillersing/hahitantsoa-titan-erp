import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("inventory", "0003_inventoryavailability_reservation_draft"),
        ("hahitantsoa", "0003_event_draft_confirmation_contract"),
    ]

    operations = [
        migrations.AddField(
            model_name="inventoryavailability",
            name="hahitantsoa_event_draft",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="inventory_availability_blocks",
                to="hahitantsoa.hahitantsoaeventdraft",
            ),
        ),
    ]
