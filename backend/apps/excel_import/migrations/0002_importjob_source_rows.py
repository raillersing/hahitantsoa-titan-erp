from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("excel_import", "0001_initial")]

    operations = [
        migrations.AddField(
            model_name="importjob",
            name="source_rows",
            field=models.JSONField(blank=True, default=list),
        ),
    ]
