from django.db import migrations, models
from django.db.models import Count


def check_existing_compositions(apps, schema_editor):
    lines = apps.get_model("material_package", "MaterialPackageLine").objects.using(
        schema_editor.connection.alias
    )
    invalid = lines.filter(quantity__lt=1).exists()
    duplicates = (
        lines.values("package_id", "inventory_item_id")
        .annotate(total=Count("pk"))
        .filter(total__gt=1)
        .exists()
    )
    if invalid or duplicates:
        raise RuntimeError(
            "Material package compositions require review: nonpositive quantities or duplicate "
            "items exist. No historical composition has been modified."
        )


class Migration(migrations.Migration):
    dependencies = [("material_package", "0002_add_materialpackage_image_url")]
    operations = [
        migrations.RunPython(check_existing_compositions, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name="materialpackageline",
            constraint=models.CheckConstraint(
                condition=models.Q(quantity__gt=0), name="material_package_line_quantity_positive"
            ),
        ),
        migrations.AddConstraint(
            model_name="materialpackageline",
            constraint=models.UniqueConstraint(
                fields=("package", "inventory_item"), name="material_package_line_item_unique"
            ),
        ),
    ]
