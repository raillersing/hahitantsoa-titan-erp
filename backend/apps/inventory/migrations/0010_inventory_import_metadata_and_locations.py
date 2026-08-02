# Generated manually for the inventory import contract.

import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("inventory", "0009_add_return_operation_logistics_event_fk"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="InventoryStorageLocation",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=255, unique=True)),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to=settings.AUTH_USER_MODEL)),
                ("updated_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["name"],
                "verbose_name": "Inventory storage location",
                "verbose_name_plural": "Inventory storage locations",
            },
        ),
        migrations.AddField(
            model_name="inventoryitem",
            name="breakage_price",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=14, null=True),
        ),
        migrations.AddField(model_name="inventoryitem", name="code", field=models.CharField(blank=True, max_length=128)),
        migrations.AddField(model_name="inventoryitem", name="purchase_price", field=models.DecimalField(blank=True, decimal_places=2, max_digits=14, null=True)),
        migrations.AddField(model_name="inventoryitem", name="rental_price", field=models.DecimalField(blank=True, decimal_places=2, max_digits=14, null=True)),
        migrations.AddField(model_name="inventoryitem", name="reported_inventory_quantity", field=models.PositiveIntegerField(default=0)),
        migrations.AddField(model_name="inventoryitem", name="reported_damaged_quantity", field=models.PositiveIntegerField(default=0)),
        migrations.AddField(model_name="inventoryitem", name="section", field=models.CharField(blank=True, max_length=255)),
        migrations.AddField(model_name="inventoryitem", name="unit", field=models.CharField(blank=True, max_length=32)),
        migrations.AddField(
            model_name="inventorystockmovement",
            name="storage_location",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="stock_movements", to="inventory.inventorystoragelocation"),
        ),
    ]
