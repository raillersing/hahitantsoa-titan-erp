from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError
from django.core.management import call_command
from django.db import DatabaseError, IntegrityError, connection, transaction
from django.utils import timezone

from apps.audit.models import AuditEvent
from apps.finance.models import (
    FIXED_FINANCIAL_CATEGORY_DEFINITIONS,
    FinanceAccountKind,
    FinanceBusinessScope,
    FinanceCurrency,
    FinancialCategory,
    FinancialCategoryKind,
    FinancialJournalDirection,
    FinancialJournalEntry,
)
from apps.finance.services import (
    configure_finance_account,
    create_finance_account,
    record_financial_journal_entry,
    seed_fixed_financial_categories,
)
from apps.identity.models import ApplicationRole, UserRoleAssignment
from apps.identity.roles import CompanyRole

pytestmark = pytest.mark.django_db


def _actor(django_user_model, username="finance-operator"):
    return django_user_model.objects.create_user(
        username=username,
        password="test-pass",
        is_staff=True,
    )


def _manager(django_user_model, username="finance-manager"):
    manager = django_user_model.objects.create_user(username=username, password="test-pass")
    role = ApplicationRole.objects.create(name="Finance manager", slug=CompanyRole.MANAGER)
    UserRoleAssignment.objects.create(user=manager, role=role)
    return manager


def test_fixed_financial_categories_are_idempotent_and_manager_managed(
    django_user_model, django_capture_on_commit_callbacks
) -> None:
    manager = _manager(django_user_model)
    denied_actor = _actor(django_user_model, "finance-sensitive-operator")

    with pytest.raises(PermissionError, match="manager"):
        seed_fixed_financial_categories(actor=denied_actor)

    with django_capture_on_commit_callbacks(execute=True):
        first_seed = seed_fixed_financial_categories(actor=manager)
        second_seed = seed_fixed_financial_categories(actor=manager)

    assert {category.code for category in first_seed} == {
        "income.rental",
        "income.service_sale",
        "income.deposit",
        "income.invoice_settlement",
        "income.other",
        "expense.purchase",
        "expense.supplier",
        "expense.transport_delivery",
        "expense.fuel",
        "expense.salary_labor",
        "expense.maintenance",
        "expense.rent_charges",
        "expense.bank_mobile_money_fees",
        "expense.reimbursement",
        "expense.other",
        "transfer.cash_bank",
        "transfer.cash_mobile_money",
        "transfer.bank_mobile_money",
        "transfer.titan_hahitantsoa",
    }
    assert len(first_seed) == len(second_seed) == FinancialCategory.objects.count() == 19
    assert FinancialCategory.objects.filter(kind=FinancialCategoryKind.TRANSFER).count() == 4


@pytest.mark.django_db(transaction=True)
def test_flush_rehydrates_the_exact_fixed_financial_category_catalog() -> None:
    expected_categories = set(FIXED_FINANCIAL_CATEGORY_DEFINITIONS)

    actual_categories = set(FinancialCategory.objects.values_list("code", "label", "kind"))
    assert actual_categories == expected_categories
    assert FinancialCategory.objects.filter(code="transfer.cash_bank").exists()

    call_command("flush", interactive=False, verbosity=0)

    actual_categories = set(FinancialCategory.objects.values_list("code", "label", "kind"))
    assert actual_categories == expected_categories
    assert FinancialCategory.objects.filter(code="transfer.cash_bank").exists()


def test_fixed_financial_categories_reject_direct_orm_creation_and_sql_mutation() -> None:
    category = FinancialCategory.objects.get(code="income.rental")

    with pytest.raises(DatabaseError, match="Fixed financial categories"):
        with transaction.atomic():
            FinancialCategory.objects.create(
                code="income.arbitrary",
                label="Recettes arbitraires",
                kind=FinancialCategoryKind.INCOME,
            )

    for field, value in (
        ("code", "income.changed"),
        ("label", "Recettes modifiées"),
        ("kind", FinancialCategoryKind.EXPENSE),
    ):
        with pytest.raises(DatabaseError, match="Fixed financial categories"):
            with transaction.atomic():
                FinancialCategory.objects.filter(pk=category.pk).update(**{field: value})
        with pytest.raises(DatabaseError, match="Fixed financial categories"):
            with transaction.atomic():
                with connection.cursor() as cursor:
                    cursor.execute(
                        f"UPDATE finance_financialcategory SET {field} = %s WHERE id = %s",
                        [value, category.id],
                    )

    with pytest.raises(DatabaseError, match="Fixed financial categories"):
        with transaction.atomic():
            FinancialCategory.objects.filter(pk=category.pk).delete()
    with pytest.raises(DatabaseError, match="Fixed financial categories"):
        with transaction.atomic():
            with connection.cursor() as cursor:
                cursor.execute("DELETE FROM finance_financialcategory WHERE id = %s", [category.id])


def test_finance_accounts_are_mga_only(django_user_model) -> None:
    actor = _actor(django_user_model)
    account = create_finance_account(
        actor=actor,
        business_scope=FinanceBusinessScope.TITAN,
        code="MGA-CASH-01",
        label="Caisse MGA",
        kind=FinanceAccountKind.CASH,
    )

    assert account.currency == FinanceCurrency.MGA
    account.currency = "EUR"
    with pytest.raises(ValidationError, match="MGA"):
        account.full_clean()


def test_accounts_are_configurable_per_business_scope_and_audited(
    django_user_model, django_capture_on_commit_callbacks
) -> None:
    actor = _actor(django_user_model)

    with django_capture_on_commit_callbacks(execute=True):
        titan = create_finance_account(
            actor=actor,
            business_scope=FinanceBusinessScope.TITAN,
            code="CAISSE-01",
            label="Caisse Titan",
            kind=FinanceAccountKind.CASH,
        )
        hahitantsoa = create_finance_account(
            actor=actor,
            business_scope=FinanceBusinessScope.HAHITANTSOA,
            code="CAISSE-01",
            label="Caisse Hahitantsoa",
            kind=FinanceAccountKind.CASH,
        )

    assert titan.code == hahitantsoa.code
    assert titan.business_scope != hahitantsoa.business_scope
    assert AuditEvent.objects.filter(
        action="finance.account_created", target_id=str(titan.id)
    ).exists()


def test_finance_account_code_is_unique_inside_scope(django_user_model) -> None:
    actor = _actor(django_user_model)
    create_finance_account(
        actor=actor,
        business_scope=FinanceBusinessScope.TITAN,
        code="BANK-01",
        label="Banque Titan",
        kind=FinanceAccountKind.BANK,
    )

    with pytest.raises(ValidationError):
        create_finance_account(
            actor=actor,
            business_scope=FinanceBusinessScope.TITAN,
            code="BANK-01",
            label="Autre banque Titan",
            kind=FinanceAccountKind.BANK,
        )


def test_journal_entries_are_positive_append_only_and_audited(
    django_user_model, django_capture_on_commit_callbacks
) -> None:
    actor = _actor(django_user_model)
    account = create_finance_account(
        actor=actor,
        business_scope=FinanceBusinessScope.TITAN,
        code="CHEQUE-01",
        label="Chèques Titan",
        kind=FinanceAccountKind.CHEQUE,
    )

    with django_capture_on_commit_callbacks(execute=True):
        entry = record_financial_journal_entry(
            account=account,
            actor=actor,
            direction=FinancialJournalDirection.INFLOW,
            amount=Decimal("150000.00"),
            occurred_at=timezone.now(),
            source_label="Chèque reçu",
        )

    assert entry.account_id == account.id
    assert entry.amount == Decimal("150000.00")
    assert AuditEvent.objects.filter(
        action="finance.journal_entry_recorded", target_id=str(entry.id)
    ).exists()

    entry.notes = "mutation forbidden"
    with pytest.raises(ValidationError, match="immutable"):
        entry.save()
    with pytest.raises(ValidationError, match="immutable"):
        entry.delete()

    with pytest.raises(DatabaseError, match="immutable"):
        with transaction.atomic():
            FinancialJournalEntry.objects.filter(pk=entry.pk).update(notes="queryset mutation")
    with pytest.raises(DatabaseError, match="immutable"):
        with transaction.atomic():
            FinancialJournalEntry.objects.filter(pk=entry.pk).delete()

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            FinancialJournalEntry.objects.create(
                account=account,
                direction=FinancialJournalDirection.INFLOW,
                amount=Decimal("0.00"),
                occurred_at=timezone.now(),
                source_label="invalid",
                recorded_by=actor,
            )


def test_journal_entries_require_sensitive_actor_and_active_account(django_user_model) -> None:
    actor = _actor(django_user_model, "finance-owner")
    denied_actor = django_user_model.objects.create_user(
        username="finance-denied", password="test-pass"
    )
    account = create_finance_account(
        actor=actor,
        business_scope=FinanceBusinessScope.HAHITANTSOA,
        code="MVOLA-01",
        label="MVola Hahitantsoa",
        kind=FinanceAccountKind.MOBILE_MONEY,
    )

    with pytest.raises(PermissionError):
        record_financial_journal_entry(
            account=account,
            actor=denied_actor,
            direction=FinancialJournalDirection.INFLOW,
            amount=Decimal("1.00"),
            occurred_at=timezone.now(),
            source_label="forbidden",
        )

    account = configure_finance_account(account=account, actor=actor, is_active=False)
    with pytest.raises(ValueError, match="active finance account"):
        record_financial_journal_entry(
            account=account,
            actor=actor,
            direction=FinancialJournalDirection.OUTFLOW,
            amount=Decimal("1.00"),
            occurred_at=timezone.now(),
            source_label="inactive",
        )
