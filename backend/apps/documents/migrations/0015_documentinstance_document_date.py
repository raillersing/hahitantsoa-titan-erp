from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("documents", "0014_documentinstance_customer_party_type")]

    operations = [
        migrations.AddField(
            model_name="documentinstance",
            name="document_date",
            field=models.DateField(blank=True, null=True),
        ),
    ]
