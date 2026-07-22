import uuid
from decimal import Decimal

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("billing", "0009_sync_credit_note_status_constraint"),
        ("hahitantsoa", "0006_add_venue_and_service_models"),
        ("payments", "0004_payment_billing_refund_obligation"),
        ("reservations", "0006_reservationdraft_prerequisite_marker_constraints"),
    ]

    operations = [
        migrations.CreateModel(
            name="FinanceAccount",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4, editable=False, primary_key=True, serialize=False
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "business_scope",
                    models.CharField(
                        choices=[("hahitantsoa", "Hahitantsoa"), ("titan", "Titan")], max_length=32
                    ),
                ),
                ("code", models.CharField(max_length=64)),
                ("label", models.CharField(max_length=255)),
                (
                    "kind",
                    models.CharField(
                        choices=[
                            ("cash", "Cash"),
                            ("bank", "Bank"),
                            ("mobile_money", "Mobile money"),
                            ("cheque", "Cheque"),
                        ],
                        max_length=32,
                    ),
                ),
                ("is_active", models.BooleanField(default=True)),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "updated_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"ordering": ["business_scope", "code", "id"]},
        ),
        migrations.CreateModel(
            name="FinancialJournalEntry",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4, editable=False, primary_key=True, serialize=False
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "direction",
                    models.CharField(
                        choices=[("inflow", "Inflow"), ("outflow", "Outflow")], max_length=16
                    ),
                ),
                ("amount", models.DecimalField(decimal_places=2, max_digits=12)),
                ("occurred_at", models.DateTimeField()),
                ("source_label", models.CharField(blank=True, max_length=255)),
                ("transfer_reference", models.UUIDField(blank=True, db_index=True, null=True)),
                ("notes", models.TextField(blank=True)),
                (
                    "account",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="journal_entries",
                        to="finance.financeaccount",
                    ),
                ),
                (
                    "billing_invoice",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="financial_journal_entries",
                        to="billing.billinginvoice",
                    ),
                ),
                (
                    "billing_refund_obligation",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="financial_journal_entries",
                        to="billing.billingrefundobligation",
                    ),
                ),
                (
                    "hahitantsoa_event_draft",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="financial_journal_entries",
                        to="hahitantsoa.hahitantsoaeventdraft",
                    ),
                ),
                (
                    "payment",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="financial_journal_entries",
                        to="payments.payment",
                    ),
                ),
                (
                    "recorded_by",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="+",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "reservation_draft",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="financial_journal_entries",
                        to="reservations.reservationdraft",
                    ),
                ),
            ],
            options={"ordering": ["-occurred_at", "-created_at", "id"]},
        ),
        migrations.AddConstraint(
            model_name="financeaccount",
            constraint=models.UniqueConstraint(
                fields=("business_scope", "code"), name="finance_account_scope_code_unique"
            ),
        ),
        migrations.AddConstraint(
            model_name="financialjournalentry",
            constraint=models.CheckConstraint(
                condition=models.Q(("amount__gt", Decimal("0.00"))),
                name="financial_journal_entry_amount_positive",
            ),
        ),
        migrations.AddConstraint(
            model_name="financialjournalentry",
            constraint=models.CheckConstraint(
                condition=(
                    models.Q(
                        payment__isnull=False,
                        billing_invoice__isnull=True,
                        billing_refund_obligation__isnull=True,
                        reservation_draft__isnull=True,
                        hahitantsoa_event_draft__isnull=True,
                    )
                    | models.Q(
                        payment__isnull=True,
                        billing_invoice__isnull=False,
                        billing_refund_obligation__isnull=True,
                        reservation_draft__isnull=True,
                        hahitantsoa_event_draft__isnull=True,
                    )
                    | models.Q(
                        payment__isnull=True,
                        billing_invoice__isnull=True,
                        billing_refund_obligation__isnull=False,
                        reservation_draft__isnull=True,
                        hahitantsoa_event_draft__isnull=True,
                    )
                    | models.Q(
                        payment__isnull=True,
                        billing_invoice__isnull=True,
                        billing_refund_obligation__isnull=True,
                        reservation_draft__isnull=False,
                        hahitantsoa_event_draft__isnull=True,
                    )
                    | models.Q(
                        payment__isnull=True,
                        billing_invoice__isnull=True,
                        billing_refund_obligation__isnull=True,
                        reservation_draft__isnull=True,
                        hahitantsoa_event_draft__isnull=False,
                    )
                    | models.Q(
                        payment__isnull=True,
                        billing_invoice__isnull=True,
                        billing_refund_obligation__isnull=True,
                        reservation_draft__isnull=True,
                        hahitantsoa_event_draft__isnull=True,
                    )
                ),
                name="financial_journal_entry_single_source",
            ),
        ),
        migrations.RunSQL(
            sql="""
                CREATE FUNCTION finance_prevent_financial_journal_entry_mutation()
                RETURNS trigger
                LANGUAGE plpgsql
                AS $$
                BEGIN
                    RAISE EXCEPTION
                        'Financial journal entries are immutable; record a counter-entry.';
                END;
                $$;

                CREATE TRIGGER finance_financial_journal_entry_append_only
                BEFORE UPDATE OR DELETE ON finance_financialjournalentry
                FOR EACH ROW
                EXECUTE FUNCTION finance_prevent_financial_journal_entry_mutation();
            """,
            reverse_sql="""
                DROP TRIGGER IF EXISTS finance_financial_journal_entry_append_only
                ON finance_financialjournalentry;
                DROP FUNCTION IF EXISTS finance_prevent_financial_journal_entry_mutation();
            """,
        ),
    ]
