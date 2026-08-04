from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("customers", "0003_desired_date_waitlist"),
    ]

    operations = [
        migrations.AddField(
            model_name="customer",
            name="civilite",
            field=models.CharField(blank=True, max_length=16),
        ),
        migrations.AddField(
            model_name="customer",
            name="birth_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="customer",
            name="birth_place",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="customer",
            name="id_type",
            field=models.CharField(blank=True, max_length=32),
        ),
        migrations.AddField(
            model_name="customer",
            name="id_number",
            field=models.CharField(blank=True, max_length=128),
        ),
        migrations.AddField(
            model_name="customer",
            name="id_issue_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="customer",
            name="id_issue_place",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="customer",
            name="id_duplicata_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="customer",
            name="id_duplicata_place",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="customer",
            name="nif",
            field=models.CharField(blank=True, max_length=128),
        ),
        migrations.AddField(
            model_name="customer",
            name="stat",
            field=models.CharField(blank=True, max_length=128),
        ),
        migrations.AddField(
            model_name="customer",
            name="rcs",
            field=models.CharField(blank=True, max_length=128),
        ),
        migrations.AddField(
            model_name="customer",
            name="representative_name",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="customer",
            name="representative_role",
            field=models.CharField(blank=True, max_length=255),
        ),
    ]
