from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("hahitantsoa", "0001_initial"),
        ("inventory", "0010_inventory_import_metadata_and_locations"),
    ]

    operations = [
        migrations.AddConstraint(
            model_name="inventoryavailability",
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
                    | models.Q(
                        reservation_draft__isnull=True,
                        hahitantsoa_event_draft__isnull=True,
                    )
                ),
                name="inventory_availability_single_business_draft",
            ),
        ),
        migrations.AddField(
            model_name="inventorystockmovement",
            name="hahitantsoa_event_draft",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="stock_movements",
                to="hahitantsoa.hahitantsoaeventdraft",
            ),
        ),
        migrations.RemoveConstraint(
            model_name="inventorystockmovement",
            name="inventory_stock_movement_standalone_requires_source_and_notes",
        ),
        migrations.AddConstraint(
            model_name="inventorystockmovement",
            constraint=models.CheckConstraint(
                condition=(
                    models.Q(reservation_draft__isnull=False)
                    | models.Q(hahitantsoa_event_draft__isnull=False)
                    | models.Q(document_instance__isnull=False)
                    | (~models.Q(source_label="") & ~models.Q(notes=""))
                ),
                name="inventory_stock_movement_standalone_requires_source_and_notes",
            ),
        ),
        migrations.AddConstraint(
            model_name="inventorystockmovement",
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
                    | models.Q(
                        reservation_draft__isnull=True,
                        hahitantsoa_event_draft__isnull=True,
                    )
                ),
                name="inventory_stock_movement_single_business_draft",
            ),
        ),
    ]
