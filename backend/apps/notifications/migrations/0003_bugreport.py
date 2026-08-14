# Generated manually for the persisted support workflow.
import uuid

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("notifications", "0002_paymentreminderdispatch"),
    ]

    operations = [
        migrations.CreateModel(
            name="BugReport",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("title", models.CharField(max_length=160)),
                ("description", models.TextField()),
                ("severity", models.CharField(choices=[("low", "Faible"), ("medium", "Moyenne"), ("high", "Élevée"), ("critical", "Critique")], default="medium", max_length=16)),
                ("status", models.CharField(choices=[("new", "Nouveau"), ("in_progress", "En cours"), ("resolved", "Résolu")], default="new", max_length=16)),
                ("page_url", models.CharField(blank=True, default="", max_length=512)),
                ("user_agent", models.TextField(blank=True, default="")),
                ("error_message", models.TextField(blank=True, default="")),
                ("correlation_id", models.CharField(blank=True, default="", max_length=64)),
                ("reporter", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="bug_reports", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-created_at", "id"]},
        ),
    ]
