from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("documents", "0008_documentinstance_proforma_issuance_validity"),
    ]

    operations = [
        migrations.AddField(
            model_name="documentinstance",
            name="customer_civilite",
            field=models.CharField(blank=True, max_length=16),
        ),
        migrations.AddField(
            model_name="documentinstance",
            name="customer_birth_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="documentinstance",
            name="customer_birth_place",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="documentinstance",
            name="customer_id_type",
            field=models.CharField(blank=True, max_length=32),
        ),
        migrations.AddField(
            model_name="documentinstance",
            name="customer_id_number",
            field=models.CharField(blank=True, max_length=128),
        ),
        migrations.AddField(
            model_name="documentinstance",
            name="customer_id_issue_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="documentinstance",
            name="customer_id_issue_place",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="documentinstance",
            name="customer_id_duplicata_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="documentinstance",
            name="customer_id_duplicata_place",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="documentinstance",
            name="customer_nif",
            field=models.CharField(blank=True, max_length=128),
        ),
        migrations.AddField(
            model_name="documentinstance",
            name="customer_stat",
            field=models.CharField(blank=True, max_length=128),
        ),
        migrations.AddField(
            model_name="documentinstance",
            name="customer_rcs",
            field=models.CharField(blank=True, max_length=128),
        ),
        migrations.AddField(
            model_name="documentinstance",
            name="customer_representative_name",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="documentinstance",
            name="customer_representative_role",
            field=models.CharField(blank=True, max_length=255),
        ),
    ]
