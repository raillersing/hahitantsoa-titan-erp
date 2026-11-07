import uuid

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("reservations", "0015_wizard_business_replay")]
    operations = [
        migrations.CreateModel(
            name="ReservationWizardProformaOperation",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4, editable=False, primary_key=True, serialize=False
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("client_key", models.UUIDField()),
                ("fingerprint", models.CharField(editable=False, max_length=64)),
                (
                    "document",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="+",
                        to="documents.documentinstance",
                    ),
                ),
                (
                    "session",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="proforma_operations",
                        to="reservations.reservationwizardsession",
                    ),
                ),
            ],
            options={
                "constraints": [
                    models.UniqueConstraint(
                        fields=("session", "client_key"), name="wizard_proforma_operation_unique"
                    )
                ]
            },
        )
    ]
