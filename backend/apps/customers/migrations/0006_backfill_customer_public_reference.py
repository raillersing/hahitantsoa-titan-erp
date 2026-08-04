import uuid

from django.db import migrations


def populate_customer_references(apps, schema_editor):
    Customer = apps.get_model("customers", "Customer")
    for customer in Customer.objects.filter(public_reference__isnull=True).iterator():
        customer.public_reference = f"CLI-{uuid.uuid4().hex[:12].upper()}"
        customer.save(update_fields=["public_reference"])


class Migration(migrations.Migration):
    dependencies = [("customers", "0005_customer_public_reference")]

    operations = [migrations.RunPython(populate_customer_references, migrations.RunPython.noop)]
