from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("documents", "0013_documentinstance_bank_account_holder_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="documentinstance",
            name="customer_party_type",
            field=models.CharField(blank=True, max_length=16),
        ),
    ]
