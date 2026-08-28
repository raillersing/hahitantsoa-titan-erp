from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("documents", "0018_documentinstance_customer_contact_points_snapshot")]

    operations = [
        migrations.AddField(
            model_name="documentinstance",
            name="document_reference",
            field=models.CharField(blank=True, default="", max_length=64),
        ),
    ]
