from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("logistics", "0005_titanclosedday")]

    operations = [
        migrations.AddField(
            model_name="logisticsevent",
            name="operation",
            field=models.CharField(
                choices=[
                    ("outbound", "Sortie / livraison"),
                    ("return", "Retour / récupération"),
                ],
                default="outbound",
                max_length=16,
            ),
        ),
    ]
