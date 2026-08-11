import uuid

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("reservations", "0008_reservationdraftamendment_changed_fields"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="ReservationCloseout",
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
                ("closed_at", models.DateTimeField()),
                ("status", models.CharField(choices=[("closed", "closed")], default="closed", max_length=16)),
                ("idempotency_key", models.CharField(blank=True, default="", max_length=128)),
                ("summary_snapshot", models.JSONField(default=dict)),
                (
                    "closed_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="reservation_closeouts",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "reservation_draft",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="closeout_record",
                        to="reservations.reservationdraft",
                    ),
                ),
            ],
            options={
                "verbose_name": "Reservation closeout",
                "verbose_name_plural": "Reservation closeouts",
                "ordering": ["-closed_at", "-created_at", "id"],
            },
        ),
        migrations.RunSQL(
            sql="""
                CREATE FUNCTION reservations_prevent_closeout_mutation()
                RETURNS trigger
                LANGUAGE plpgsql
                AS $$
                BEGIN
                    RAISE EXCEPTION 'Reservation closeouts are append-only.';
                END;
                $$;

                CREATE TRIGGER reservations_closeout_append_only
                BEFORE UPDATE OR DELETE ON reservations_reservationcloseout
                FOR EACH ROW
                EXECUTE FUNCTION reservations_prevent_closeout_mutation();
            """,
            reverse_sql="""
                DROP TRIGGER IF EXISTS reservations_closeout_append_only
                ON reservations_reservationcloseout;
                DROP FUNCTION IF EXISTS reservations_prevent_closeout_mutation();
            """,
        ),
    ]
