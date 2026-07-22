import uuid

from django.db import migrations, models
from django.db.models import deletion

FIXED_FINANCIAL_CATEGORIES = (
    ("income.rental", "Recettes location", "income"),
    ("income.service_sale", "Recettes prestation-vente", "income"),
    ("income.deposit", "Recettes acompte", "income"),
    ("income.invoice_settlement", "Recettes règlement facture", "income"),
    ("income.other", "Recettes autre", "income"),
    ("expense.purchase", "Dépenses achat", "expense"),
    ("expense.supplier", "Dépenses fournisseur", "expense"),
    ("expense.transport_delivery", "Dépenses transport-livraison", "expense"),
    ("expense.fuel", "Dépenses carburant", "expense"),
    ("expense.salary_labor", "Dépenses salaire-main-d’œuvre", "expense"),
    ("expense.maintenance", "Dépenses maintenance", "expense"),
    ("expense.rent_charges", "Dépenses loyer-charges", "expense"),
    ("expense.bank_mobile_money_fees", "Dépenses frais bancaire-mobile money", "expense"),
    ("expense.reimbursement", "Dépenses remboursement", "expense"),
    ("expense.other", "Dépenses autre", "expense"),
    ("transfer.cash_bank", "Transfert caisse↔banque", "transfer"),
    ("transfer.cash_mobile_money", "Transfert caisse↔mobile money", "transfer"),
    ("transfer.bank_mobile_money", "Transfert banque↔mobile money", "transfer"),
    ("transfer.titan_hahitantsoa", "Transfert Titan↔Hahitantsoa", "transfer"),
)


def seed_fixed_financial_categories(apps, schema_editor):
    FinancialCategory = apps.get_model("finance", "FinancialCategory")
    categories = FinancialCategory.objects.using(schema_editor.connection.alias)
    for code, label, kind in FIXED_FINANCIAL_CATEGORIES:
        categories.get_or_create(
            code=code,
            defaults={"label": label, "kind": kind},
        )


class Migration(migrations.Migration):
    dependencies = [("finance", "0001_initial")]

    operations = [
        migrations.AddField(
            model_name="financeaccount",
            name="currency",
            field=models.CharField(
                choices=[("MGA", "Malagasy ariary")], default="MGA", max_length=3
            ),
        ),
        migrations.AddConstraint(
            model_name="financeaccount",
            constraint=models.CheckConstraint(
                condition=models.Q(("currency", "MGA")),
                name="finance_account_currency_mga_only",
            ),
        ),
        migrations.CreateModel(
            name="FinancialCategory",
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
                ("code", models.CharField(max_length=96, unique=True)),
                ("label", models.CharField(max_length=255)),
                (
                    "kind",
                    models.CharField(
                        choices=[
                            ("income", "Income"),
                            ("expense", "Expense"),
                            ("transfer", "Transfer"),
                        ],
                        max_length=16,
                    ),
                ),
            ],
            options={"ordering": ["kind", "code", "id"]},
        ),
        migrations.AddField(
            model_name="financialjournalentry",
            name="category",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=deletion.PROTECT,
                related_name="journal_entries",
                to="finance.financialcategory",
            ),
        ),
        migrations.AddField(
            model_name="financialjournalentry",
            name="reverses_transfer_reference",
            field=models.UUIDField(blank=True, db_index=True, null=True),
        ),
        migrations.AddConstraint(
            model_name="financialjournalentry",
            constraint=models.CheckConstraint(
                condition=(
                    models.Q(("reverses_transfer_reference__isnull", True))
                    | models.Q(("transfer_reference__isnull", False))
                ),
                name="financial_journal_entry_reversal_requires_transfer",
            ),
        ),
        migrations.AddConstraint(
            model_name="financialjournalentry",
            constraint=models.UniqueConstraint(
                condition=models.Q(("transfer_reference__isnull", False)),
                fields=("transfer_reference", "direction"),
                name="financial_journal_entry_transfer_pair_direction_unique",
            ),
        ),
        migrations.AddConstraint(
            model_name="financialjournalentry",
            constraint=models.UniqueConstraint(
                condition=models.Q(("reverses_transfer_reference__isnull", False)),
                fields=("reverses_transfer_reference", "direction"),
                name="financial_journal_entry_counter_pair_direction_unique",
            ),
        ),
        migrations.RunPython(seed_fixed_financial_categories, migrations.RunPython.noop),
        migrations.RunSQL(
            sql="""
                CREATE FUNCTION finance_prevent_financial_category_mutation()
                RETURNS trigger
                LANGUAGE plpgsql
                AS $$
                BEGIN
                    IF TG_OP = 'INSERT' AND (NEW.code, NEW.label, NEW.kind) IN (
                        VALUES
                            ('income.rental', 'Recettes location', 'income'),
                            ('income.service_sale', 'Recettes prestation-vente', 'income'),
                            ('income.deposit', 'Recettes acompte', 'income'),
                            ('income.invoice_settlement', 'Recettes règlement facture', 'income'),
                            ('income.other', 'Recettes autre', 'income'),
                            ('expense.purchase', 'Dépenses achat', 'expense'),
                            ('expense.supplier', 'Dépenses fournisseur', 'expense'),
                            (
                                'expense.transport_delivery',
                                'Dépenses transport-livraison',
                                'expense'
                            ),
                            ('expense.fuel', 'Dépenses carburant', 'expense'),
                            ('expense.salary_labor', 'Dépenses salaire-main-d’œuvre', 'expense'),
                            ('expense.maintenance', 'Dépenses maintenance', 'expense'),
                            ('expense.rent_charges', 'Dépenses loyer-charges', 'expense'),
                            (
                                'expense.bank_mobile_money_fees',
                                'Dépenses frais bancaire-mobile money',
                                'expense'
                            ),
                            ('expense.reimbursement', 'Dépenses remboursement', 'expense'),
                            ('expense.other', 'Dépenses autre', 'expense'),
                            ('transfer.cash_bank', 'Transfert caisse↔banque', 'transfer'),
                            (
                                'transfer.cash_mobile_money',
                                'Transfert caisse↔mobile money',
                                'transfer'
                            ),
                            (
                                'transfer.bank_mobile_money',
                                'Transfert banque↔mobile money',
                                'transfer'
                            ),
                            (
                                'transfer.titan_hahitantsoa',
                                'Transfert Titan↔Hahitantsoa',
                                'transfer'
                            )
                    ) THEN
                        RETURN NEW;
                    END IF;
                    RAISE EXCEPTION 'Fixed financial categories are immutable.';
                END;
                $$;

                CREATE TRIGGER finance_financial_category_fixed_catalog
                BEFORE INSERT OR UPDATE OR DELETE ON finance_financialcategory
                FOR EACH ROW
                EXECUTE FUNCTION finance_prevent_financial_category_mutation();
            """,
            reverse_sql="""
                DROP TRIGGER IF EXISTS finance_financial_category_fixed_catalog
                ON finance_financialcategory;
                DROP FUNCTION IF EXISTS finance_prevent_financial_category_mutation();
            """,
        ),
    ]
