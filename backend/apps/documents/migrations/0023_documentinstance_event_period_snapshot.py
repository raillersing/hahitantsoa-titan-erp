from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("documents", "0022_documentinstance_bare_rental_composition_snapshot")]

    operations = [
        migrations.AddField(
            model_name="documentinstance",
            name="event_period_snapshot",
            field=models.JSONField(default=None, editable=False, null=True),
        ),
    ]
