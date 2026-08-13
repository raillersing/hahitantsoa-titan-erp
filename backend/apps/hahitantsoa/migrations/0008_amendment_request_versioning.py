from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("hahitantsoa", "0007_hahitantsoaeventdraft_event_type"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name="hahitantsoaeventdraftamendmentrequest",
            name="hahitantsoa_event_draft_amendment_request_status_allowed",
        ),
        migrations.AlterField(
            model_name="hahitantsoaeventdraftamendmentrequest",
            name="status",
            field=models.CharField(
                choices=[("draft", "draft"), ("applied", "applied")],
                default="draft",
                max_length=32,
            ),
        ),
        migrations.AddField(
            model_name="hahitantsoaeventdraftamendmentrequest",
            name="changed_start_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="hahitantsoaeventdraftamendmentrequest",
            name="changed_end_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="hahitantsoaeventdraftamendmentrequest",
            name="changed_event_name",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="hahitantsoaeventdraftamendmentrequest",
            name="changed_event_type",
            field=models.CharField(blank=True, max_length=32),
        ),
        migrations.AddField(
            model_name="hahitantsoaeventdraftamendmentrequest",
            name="changed_venue_name",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="hahitantsoaeventdraftamendmentrequest",
            name="changed_location_details",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="hahitantsoaeventdraftamendmentrequest",
            name="changed_service_notes",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="hahitantsoaeventdraftamendmentrequest",
            name="changed_notes",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="hahitantsoaeventdraftamendmentrequest",
            name="amendment_sequence",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="hahitantsoaeventdraftamendmentrequest",
            name="document_instance_id",
            field=models.UUIDField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="hahitantsoaeventdraftamendmentrequest",
            name="source_contract_document_id",
            field=models.UUIDField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="hahitantsoaeventdraftamendmentrequest",
            name="applied_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="hahitantsoaeventdraftamendmentrequest",
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
            model_name="hahitantsoaeventdraftamendmentrequest",
            constraint=models.CheckConstraint(
                condition=models.Q(status__in=["draft", "applied"]),
                name="hahitantsoa_event_draft_amendment_request_status_allowed",
            ),
        ),
    ]
