from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("documents", "0008_documentinstance_proforma_issuance_validity")]

    operations = [
        migrations.AddField(
            model_name="documentinstance",
            name="document_date",
            field=models.DateField(blank=True, null=True),
        ),
    ]
