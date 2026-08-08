from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("customers", "0007_alter_customer_public_reference"),
    ]

    operations = [
        migrations.AddField(
            model_name="customer",
            name="prospect_request_type",
            field=models.CharField(blank=True, max_length=64),
        ),
        migrations.AddField(
            model_name="customer",
            name="prospect_interest_domain",
            field=models.CharField(blank=True, max_length=64),
        ),
        migrations.AddField(
            model_name="customer",
            name="prospect_requested_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="customer",
            name="prospect_budget",
            field=models.CharField(blank=True, max_length=64),
        ),
        migrations.AddField(
            model_name="customer",
            name="prospect_next_follow_up",
            field=models.DateField(blank=True, null=True),
        ),
    ]