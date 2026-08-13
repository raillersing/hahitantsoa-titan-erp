from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("billing", "0009_sync_credit_note_status_constraint"),
        ("hahitantsoa", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="billinginvoice",
            name="hahitantsoa_event_draft",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="billing_invoices",
                to="hahitantsoa.hahitantsoaeventdraft",
            ),
        ),
    ]
