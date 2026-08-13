from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("reservations", "0009_reservationcloseout"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="reservationdraftamendment",
            name="amendment_sequence",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="reservationdraftamendment",
            name="source_contract_document_id",
            field=models.UUIDField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="reservationdraftamendment",
            name="applied_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="reservationdraftamendment",
            name="applied_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.SET_NULL,
                related_name="+",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddConstraint(
            model_name="reservationdraftamendment",
            constraint=models.UniqueConstraint(
                fields=("reservation_draft", "amendment_sequence"),
                name="reservation_draft_amendment_sequence_unique",
            ),
        ),
    ]
