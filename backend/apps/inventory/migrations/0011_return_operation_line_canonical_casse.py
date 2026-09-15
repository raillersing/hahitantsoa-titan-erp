from django.db import migrations, models


def backfill_canonical_return_quantities(apps, schema_editor):
    ReturnLine = apps.get_model("inventory", "InventoryReturnOperationLine")
    for line in ReturnLine.objects.all().iterator():
        conforming_quantity = line.returned_quantity - line.damaged_quantity
        breakage_quantity = line.damaged_quantity + line.missing_quantity
        ReturnLine.objects.filter(pk=line.pk).update(
            conforming_quantity=conforming_quantity,
            breakage_quantity=breakage_quantity,
        )


class Migration(migrations.Migration):
    dependencies = [
        ("inventory", "0008_inventoryreturnoperation_hahitantsoa_event_draft_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="inventoryreturnoperationline",
            name="breakage_quantity",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="inventoryreturnoperationline",
            name="conforming_quantity",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.RunPython(
            backfill_canonical_return_quantities,
            migrations.RunPython.noop,
        ),
        migrations.AddConstraint(
            model_name="inventoryreturnoperationline",
            constraint=models.CheckConstraint(
                condition=models.Q(("breakage_quantity__gte", 0)),
                name="inventory_return_operation_line_breakage_quantity_non_negative",
            ),
        ),
        migrations.AlterField(
            model_name="inventoryreturnoperationline",
            name="condition_status",
            field=models.CharField(
                choices=[
                    ("intact", "intact"),
                    ("breakage", "breakage"),
                    ("damaged", "damaged"),
                    ("missing", "missing"),
                    ("mixed", "mixed"),
                ],
                default="intact",
                max_length=32,
            ),
        ),
        migrations.AddConstraint(
            model_name="inventoryreturnoperationline",
            constraint=models.CheckConstraint(
                condition=models.Q(("conforming_quantity__gte", 0)),
                name="inventory_return_operation_line_conforming_quantity_non_negative",
            ),
        ),
    ]
