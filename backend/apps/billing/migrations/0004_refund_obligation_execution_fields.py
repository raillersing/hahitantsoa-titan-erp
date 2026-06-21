# Generated manually for billing refund obligation execution

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("documents", "0004_documentinstance_hahitantsoa_event_draft_and_more"),
        ("billing", "0003_refund_obligation_foundation"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="billingrefundobligation",
            name="document_instance",
            field=models.OneToOneField(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="billing_refund_obligation",
                to="documents.documentinstance",
            ),
        ),
        migrations.AddField(
            model_name="billingrefundobligation",
            name="executed_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="billingrefundobligation",
            name="executed_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="+",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AlterField(
            model_name="billingrefundobligation",
            name="status",
            field=models.CharField(
                choices=[("pending", "pending"), ("executed", "executed")],
                default="pending",
                max_length=32,
            ),
        ),
        migrations.AddConstraint(
            model_name="billingrefundobligation",
            constraint=models.CheckConstraint(
                condition=(
                    models.Q(
                        ("status", "pending"),
                        ("executed_at__isnull", True),
                        ("executed_by__isnull", True),
                        ("document_instance__isnull", True),
                    )
                    | models.Q(
                        ("status", "executed"),
                        ("executed_at__isnull", False),
                        ("executed_by__isnull", False),
                        ("document_instance__isnull", False),
                    )
                ),
                name="billing_refund_obligation_status_markers_consistent",
            ),
        ),
    ]
