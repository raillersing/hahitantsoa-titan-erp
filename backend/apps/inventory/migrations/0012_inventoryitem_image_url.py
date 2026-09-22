# Generated on 2026-09-22 for F28 inventory item image_url persistence

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0011_return_operation_line_canonical_casse"),
    ]

    operations = [
        migrations.AddField(
            model_name="inventoryitem",
            name="image_url",
            field=models.CharField(blank=True, default="", max_length=500),
        ),
    ]
