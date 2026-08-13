from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("documents", "0015_documentinstance_document_date")]

    operations = [
        migrations.AddField(
            model_name="documentinstance",
            name="amendment_sequence",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="documentinstance",
            name="amendment_source_document_id",
            field=models.UUIDField(blank=True, null=True),
        ),
    ]
