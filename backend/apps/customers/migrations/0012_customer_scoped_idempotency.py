"""Retain creation identity, including deleted customers.

Rolling back to global uniqueness requires checking cross-actor key collisions
after this migration has been used; do not merge or discard customers to revert.
"""

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def retain_existing_operation_owners(apps, schema_editor):
    customers = apps.get_model("customers", "Customer").objects.using(
        schema_editor.connection.alias
    )
    customers.exclude(idempotency_key="").update(idempotency_actor=models.F("created_by"))
    duplicates = (
        customers.exclude(idempotency_key="")
        .exclude(idempotency_actor=None)
        .values("idempotency_actor", "idempotency_key")
        .annotate(count=models.Count("pk"))
        .filter(count__gt=1)
    )
    if duplicates.exists():
        raise RuntimeError(
            "Duplicate customer creation operations require review; no customers were merged."
        )


class Migration(migrations.Migration):
    dependencies = [
        ("customers", "0011_customer_idempotency_key"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="customer",
            name="idempotency_actor",
            field=models.ForeignKey(
                to=settings.AUTH_USER_MODEL,
                null=True,
                blank=True,
                editable=False,
                related_name="+",
                on_delete=django.db.models.deletion.SET_NULL,
            ),
        ),
        migrations.AddField(
            model_name="customer",
            name="idempotency_fingerprint",
            field=models.CharField(max_length=64, blank=True, default="", editable=False),
        ),
        migrations.RunPython(retain_existing_operation_owners, migrations.RunPython.noop),
        migrations.RemoveConstraint(
            model_name="customer", name="customer_idempotency_key_active_unique"
        ),
        migrations.AddConstraint(
            model_name="customer",
            constraint=models.UniqueConstraint(
                fields=("idempotency_actor", "idempotency_key"),
                condition=~models.Q(idempotency_key=""),
                name="customer_creation_operation_unique",
            ),
        ),
    ]
