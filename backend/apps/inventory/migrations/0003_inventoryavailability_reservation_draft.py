# Generated manually for F121G after local makemigrations could not run
# without database environment values.

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("inventory", "0002_inventoryavailability"),
        ("reservations", "0003_reservationdraft_confirmation_state"),
    ]

    operations = [
        migrations.AddField(
            model_name="inventoryavailability",
            name="reservation_draft",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="inventory_availability_blocks",
                to="reservations.reservationdraft",
            ),
        ),
    ]
