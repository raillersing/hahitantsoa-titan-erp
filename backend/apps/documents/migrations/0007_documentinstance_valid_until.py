from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("documents", "0006_add_template_and_version_models"),
    ]

    operations = [
        migrations.AddField(
            model_name="documentinstance",
            name="valid_until",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
