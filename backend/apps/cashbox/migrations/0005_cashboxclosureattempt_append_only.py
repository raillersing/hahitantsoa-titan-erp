# Generated manually for F2-2 data-integrity enforcement.

import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("cashbox", "0004_alter_cashboxsession_status_cashboxreopenevent"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="CashboxClosureValidation",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("validated_at", models.DateTimeField()),
                ("idempotency_key", models.CharField(max_length=128)),
                (
                    "closure_attempt",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="validation",
                        to="cashbox.cashboxclosureattempt",
                    ),
                ),
                (
                    "validated_by",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="+",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"ordering": ["-validated_at", "-created_at", "id"]},
        ),
        migrations.AddConstraint(
            model_name="cashboxclosureattempt",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    ("validated_at__isnull", True),
                    ("validated_by__isnull", True),
                    ("validation_idempotency_key", ""),
                ),
                name="cashbox_closure_attempt_validation_is_separate_evidence",
            ),
        ),
        migrations.RunSQL(
            sql="""
                CREATE FUNCTION cashbox_prevent_cashbox_closure_attempt_mutation()
                RETURNS trigger
                LANGUAGE plpgsql
                AS $$
                BEGIN
                    RAISE EXCEPTION 'Cashbox closure attempts are append-only.';
                END;
                $$;

                CREATE TRIGGER cashbox_closure_attempt_append_only
                BEFORE UPDATE OR DELETE ON cashbox_cashboxclosureattempt
                FOR EACH ROW
                EXECUTE FUNCTION cashbox_prevent_cashbox_closure_attempt_mutation();

                CREATE FUNCTION cashbox_prevent_cashbox_closure_validation_mutation()
                RETURNS trigger
                LANGUAGE plpgsql
                AS $$
                BEGIN
                    RAISE EXCEPTION 'Cashbox validation evidence is append-only.';
                END;
                $$;

                CREATE TRIGGER cashbox_closure_validation_append_only
                BEFORE UPDATE OR DELETE ON cashbox_cashboxclosurevalidation
                FOR EACH ROW
                EXECUTE FUNCTION cashbox_prevent_cashbox_closure_validation_mutation();

                CREATE FUNCTION cashbox_prevent_cashbox_reopen_event_mutation()
                RETURNS trigger
                LANGUAGE plpgsql
                AS $$
                BEGIN
                    RAISE EXCEPTION 'Cashbox reopen evidence is append-only.';
                END;
                $$;

                CREATE TRIGGER cashbox_reopen_event_append_only
                BEFORE UPDATE OR DELETE ON cashbox_cashboxreopenevent
                FOR EACH ROW
                EXECUTE FUNCTION cashbox_prevent_cashbox_reopen_event_mutation();
            """,
            reverse_sql="""
                DROP TRIGGER IF EXISTS cashbox_reopen_event_append_only
                ON cashbox_cashboxreopenevent;
                DROP FUNCTION IF EXISTS cashbox_prevent_cashbox_reopen_event_mutation();
                DROP TRIGGER IF EXISTS cashbox_closure_validation_append_only
                ON cashbox_cashboxclosurevalidation;
                DROP FUNCTION IF EXISTS cashbox_prevent_cashbox_closure_validation_mutation();
                DROP TRIGGER IF EXISTS cashbox_closure_attempt_append_only
                ON cashbox_cashboxclosureattempt;
                DROP FUNCTION IF EXISTS cashbox_prevent_cashbox_closure_attempt_mutation();
            """,
        ),
    ]
