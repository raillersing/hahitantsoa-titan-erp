from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):
    dependencies = [
        ("hahitantsoa", "0003_event_draft_confirmation_contract"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="HahitantsoaEventDraftAmendmentRequest",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to=settings.AUTH_USER_MODEL)),
                ("updated_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to=settings.AUTH_USER_MODEL)),
                ("status", models.CharField(choices=[("draft", "draft")], default="draft", max_length=32)),
                ("reason", models.CharField(blank=True, max_length=255)),
                ("notes", models.TextField(blank=True)),
                ("event_draft", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="amendment_requests", to="hahitantsoa.hahitantsoaeventdraft")),
            ],
            options={
                "verbose_name": "Hahitantsoa event draft amendment request",
                "verbose_name_plural": "Hahitantsoa event draft amendment requests",
                "ordering": ["created_at", "id"],
            },
        ),
        migrations.AddConstraint(
            model_name="hahitantsoaeventdraftamendmentrequest",
            constraint=models.CheckConstraint(
                condition=models.Q(("status__in", ["draft"])),
                name="hahitantsoa_event_draft_amendment_request_status_allowed",
            ),
        ),
    ]
