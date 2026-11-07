import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("reservations", "0014_reservationwizardsession_reservationwizardfile_and_more"),
        ("documents", "0023_documentinstance_event_period_snapshot"),
    ]
    operations = [
        migrations.AddField(
            model_name="reservationwizardsession",
            name="proforma",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="+",
                to="documents.documentinstance",
            ),
        ),
        migrations.AddField(
            model_name="reservationwizardsession",
            name="proforma_write_fingerprint",
            field=models.CharField(blank=True, default="", editable=False, max_length=64),
        ),
        migrations.AddField(
            model_name="reservationwizardsession",
            name="discharge",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="+",
                to="documents.documentinstance",
            ),
        ),
        migrations.AddField(
            model_name="reservationwizardsession",
            name="discharge_fingerprint",
            field=models.CharField(blank=True, default="", editable=False, max_length=64),
        ),
        migrations.AddField(
            model_name="reservationwizardsession",
            name="draft_creation_fingerprint",
            field=models.CharField(blank=True, default="", editable=False, max_length=64),
        ),
        migrations.AddField(
            model_name="reservationwizardfile",
            name="promoted_attachment",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="+",
                to="documents.uploadedattachment",
            ),
        ),
        migrations.AddField(
            model_name="reservationwizardfile",
            name="promotion_target",
            field=models.CharField(blank=True, default="", max_length=16),
        ),
    ]
