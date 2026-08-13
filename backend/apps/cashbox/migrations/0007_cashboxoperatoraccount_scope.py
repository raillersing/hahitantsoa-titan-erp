import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("cashbox", "0006_cashboxoperatoraccount"),
    ]

    operations = [
        migrations.AlterField(
            model_name="cashboxoperatoraccount",
            name="operator",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name="cashbox_operator_accounts",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="cashboxoperatoraccount",
            name="business_scope",
            field=models.CharField(
                choices=[("hahitantsoa", "Hahitantsoa"), ("titan", "Titan")],
                default="titan",
                max_length=32,
            ),
            preserve_default=False,
        ),
        migrations.AddConstraint(
            model_name="cashboxoperatoraccount",
            constraint=models.UniqueConstraint(
                fields=("operator", "business_scope"),
                name="cashbox_operator_account_scope_unique",
            ),
        ),
    ]
