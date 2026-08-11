from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("reservations", "0007_reservationdraftamendment")]

    operations = [
        migrations.AddField(
            model_name="reservationdraftamendment",
            name="changed_start_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="reservationdraftamendment",
            name="changed_end_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="reservationdraftamendment",
            name="changed_lines",
            field=models.JSONField(blank=True, default=list),
        ),
    ]
