from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.audit.models import AuditEvent
from apps.finance.models import (
    FinanceAccountKind,
    FinanceBusinessScope,
    FinancialJournalDirection,
    FinancialJournalEntry,
)
from apps.finance.services import (
    configure_finance_account,
    create_finance_account,
    record_financial_journal_entry,
)

pytestmark = pytest.mark.django_db


def _actor(django_user_model, username="finance-operator"):
    return django_user_model.objects.create_user(
        username=username,
        password="test-pass",
        is_staff=True,
    )


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
