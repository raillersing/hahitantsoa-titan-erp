from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from threading import Barrier

import pytest
from django.core.exceptions import ValidationError
from django.db import close_old_connections, transaction
from django.utils import timezone

from apps.audit.models import AuditEvent
from apps.finance.models import (
    FinanceAccountKind,
    FinanceBusinessScope,
    FinancialCategory,
    FinancialJournalDirection,
    FinancialJournalEntry,
)
from apps.finance.services import (
    create_finance_account,
    record_financial_transfer,
    reverse_financial_transfer,
)

pytestmark = pytest.mark.django_db


def _actor(django_user_model, username="finance-transfer-operator"):
    return django_user_model.objects.create_user(
        username=username,
        password="test-pass",
        is_staff=True,
    )


def _account(*, actor, business_scope, code, label, kind):
    return create_finance_account(
        actor=actor,
        business_scope=business_scope,
        code=code,
        label=label,
        kind=kind,
    )


def test_cross_scope_transfer_creates_exactly_two_immutable_linked_entries_and_audit(
    django_user_model, django_capture_on_commit_callbacks
) -> None:
    actor = _actor(django_user_model)
    titan_cash = _account(
        actor=actor,
        business_scope=FinanceBusinessScope.TITAN,
        code="CAISSE-01",
        label="Caisse physique — Titan",
        kind=FinanceAccountKind.CASH,
    )
    hahitantsoa_cash = _account(
        actor=actor,
        business_scope=FinanceBusinessScope.HAHITANTSOA,
        code="CAISSE-01",
        label="Caisse physique — Hahitantsoa",
        kind=FinanceAccountKind.CASH,
    )
    category = FinancialCategory.objects.get(code="transfer.titan_hahitantsoa")

    with django_capture_on_commit_callbacks(execute=True):
        outflow, inflow = record_financial_transfer(
            source_account=titan_cash,
            destination_account=hahitantsoa_cash,
            category=category,
            amount=Decimal("125000.00"),
            occurred_at=timezone.now(),
            actor=actor,
            notes="Administrative reassignment of shared physical cash.",
        )

    assert outflow.direction == FinancialJournalDirection.OUTFLOW
    assert outflow.account_id == titan_cash.id
    assert inflow.direction == FinancialJournalDirection.INFLOW
    assert inflow.account_id == hahitantsoa_cash.id
    assert outflow.amount == inflow.amount == Decimal("125000.00")
    assert outflow.transfer_reference == inflow.transfer_reference
    assert outflow.transfer_reference is not None
    assert outflow.category_id == inflow.category_id == category.id
    transfer_entry_count = FinancialJournalEntry.objects.filter(
        transfer_reference=outflow.transfer_reference
    ).count()
    assert transfer_entry_count == 2
    assert (
        FinancialJournalEntry.objects.filter(
            account__business_scope=FinanceBusinessScope.TITAN
        ).count()
        == 1
    )
    assert (
        FinancialJournalEntry.objects.filter(
            account__business_scope=FinanceBusinessScope.HAHITANTSOA
        ).count()
        == 1
    )
    assert AuditEvent.objects.filter(
        action="finance.transfer_recorded", target_id=str(outflow.transfer_reference)
    ).exists()

    outflow.notes = "mutation forbidden"
    with pytest.raises(ValidationError, match="immutable"):
        outflow.save()


@pytest.mark.parametrize(
    "non_cash_kind",
    (FinanceAccountKind.BANK, FinanceAccountKind.MOBILE_MONEY, FinanceAccountKind.CHEQUE),
)
def test_cross_scope_transfer_rejects_non_cash_accounts(django_user_model, non_cash_kind) -> None:
    actor = _actor(django_user_model)
    titan_cash = _account(
        actor=actor,
        business_scope=FinanceBusinessScope.TITAN,
        code="CAISSE-01",
        label="Caisse physique — Titan",
        kind=FinanceAccountKind.CASH,
    )
    hahitantsoa_non_cash = _account(
        actor=actor,
        business_scope=FinanceBusinessScope.HAHITANTSOA,
        code=f"{non_cash_kind}-01",
        label=f"Compte {non_cash_kind} — Hahitantsoa",
        kind=non_cash_kind,
    )
    category = FinancialCategory.objects.get(code="transfer.titan_hahitantsoa")

    with pytest.raises(ValueError, match="shared physical cash"):
        record_financial_transfer(
            source_account=titan_cash,
            destination_account=hahitantsoa_non_cash,
            category=category,
            amount=Decimal("125000.00"),
            occurred_at=timezone.now(),
            actor=actor,
        )


def test_cross_scope_transfer_requires_matching_shared_cashbox_code(django_user_model) -> None:
    actor = _actor(django_user_model)
    titan_cash = _account(
        actor=actor,
        business_scope=FinanceBusinessScope.TITAN,
        code="CAISSE-01",
        label="Caisse physique — Titan",
        kind=FinanceAccountKind.CASH,
    )
    hahitantsoa_cash = _account(
        actor=actor,
        business_scope=FinanceBusinessScope.HAHITANTSOA,
        code="CAISSE-02",
        label="Autre caisse physique — Hahitantsoa",
        kind=FinanceAccountKind.CASH,
    )
    category = FinancialCategory.objects.get(code="transfer.titan_hahitantsoa")

    with pytest.raises(ValueError, match="shared physical cash"):
        record_financial_transfer(
            source_account=titan_cash,
            destination_account=hahitantsoa_cash,
            category=category,
            amount=Decimal("125000.00"),
            occurred_at=timezone.now(),
            actor=actor,
        )


def test_transfer_requires_existing_sensitive_authorization(django_user_model) -> None:
    authorized_actor = _actor(django_user_model)
    denied_actor = django_user_model.objects.create_user(
        username="finance-transfer-denied", password="test-pass"
    )
    source = _account(
        actor=authorized_actor,
        business_scope=FinanceBusinessScope.TITAN,
        code="CASH-01",
        label="Cash",
        kind=FinanceAccountKind.CASH,
    )
    destination = _account(
        actor=authorized_actor,
        business_scope=FinanceBusinessScope.TITAN,
        code="BANK-01",
        label="Bank",
        kind=FinanceAccountKind.BANK,
    )
    category = FinancialCategory.objects.get(code="transfer.cash_bank")

    with pytest.raises(PermissionError):
        record_financial_transfer(
            source_account=source,
            destination_account=destination,
            category=category,
            amount=Decimal("1.00"),
            occurred_at=timezone.now(),
            actor=denied_actor,
        )


def test_transfer_is_reversed_only_by_a_counter_transfer(
    django_user_model, django_capture_on_commit_callbacks
) -> None:
    actor = _actor(django_user_model)
    cash = _account(
        actor=actor,
        business_scope=FinanceBusinessScope.TITAN,
        code="CASH-01",
        label="Cash",
        kind=FinanceAccountKind.CASH,
    )
    bank = _account(
        actor=actor,
        business_scope=FinanceBusinessScope.TITAN,
        code="BANK-01",
        label="Bank",
        kind=FinanceAccountKind.BANK,
    )
    category = FinancialCategory.objects.get(code="transfer.cash_bank")
    original_outflow, _ = record_financial_transfer(
        source_account=cash,
        destination_account=bank,
        category=category,
        amount=Decimal("50000.00"),
        occurred_at=timezone.now(),
        actor=actor,
    )

    with django_capture_on_commit_callbacks(execute=True):
        reversal_outflow, reversal_inflow = reverse_financial_transfer(
            transfer_reference=original_outflow.transfer_reference,
            occurred_at=timezone.now(),
            actor=actor,
            notes="Counter-transfer correction.",
        )

    assert reversal_outflow.account_id == bank.id
    assert reversal_outflow.direction == FinancialJournalDirection.OUTFLOW
    assert reversal_inflow.account_id == cash.id
    assert reversal_inflow.direction == FinancialJournalDirection.INFLOW
    assert reversal_outflow.amount == reversal_inflow.amount == original_outflow.amount
    assert reversal_outflow.reverses_transfer_reference == original_outflow.transfer_reference
    assert reversal_inflow.reverses_transfer_reference == original_outflow.transfer_reference
    assert reversal_outflow.transfer_reference != original_outflow.transfer_reference
    assert AuditEvent.objects.filter(
        action="finance.transfer_reversed", target_id=str(original_outflow.transfer_reference)
    ).exists()

    with pytest.raises(ValueError, match="already countered"):
        reverse_financial_transfer(
            transfer_reference=original_outflow.transfer_reference,
            occurred_at=timezone.now(),
            actor=actor,
        )


def test_transfer_and_audit_rollback_together(django_user_model) -> None:
    actor = _actor(django_user_model)
    source = _account(
        actor=actor,
        business_scope=FinanceBusinessScope.TITAN,
        code="CASH-01",
        label="Cash",
        kind=FinanceAccountKind.CASH,
    )
    destination = _account(
        actor=actor,
        business_scope=FinanceBusinessScope.TITAN,
        code="BANK-01",
        label="Bank",
        kind=FinanceAccountKind.BANK,
    )
    category = FinancialCategory.objects.get(code="transfer.cash_bank")

    with pytest.raises(RuntimeError, match="rollback"):
        with transaction.atomic():
            record_financial_transfer(
                source_account=source,
                destination_account=destination,
                category=category,
                amount=Decimal("10.00"),
                occurred_at=timezone.now(),
                actor=actor,
            )
            raise RuntimeError("rollback")

    assert not FinancialJournalEntry.objects.exists()
    assert not AuditEvent.objects.filter(action="finance.transfer_recorded").exists()


@pytest.mark.django_db(transaction=True)
def test_concurrent_counter_transfers_create_one_pair_only(django_user_model) -> None:
    actor = _actor(django_user_model)
    cash = _account(
        actor=actor,
        business_scope=FinanceBusinessScope.TITAN,
        code="CASH-01",
        label="Cash",
        kind=FinanceAccountKind.CASH,
    )
    bank = _account(
        actor=actor,
        business_scope=FinanceBusinessScope.TITAN,
        code="BANK-01",
        label="Bank",
        kind=FinanceAccountKind.BANK,
    )
    category = FinancialCategory.objects.get(code="transfer.cash_bank")
    original_outflow, _ = record_financial_transfer(
        source_account=cash,
        destination_account=bank,
        category=category,
        amount=Decimal("25000.00"),
        occurred_at=timezone.now(),
        actor=actor,
    )
    barrier = Barrier(2)

    def worker() -> str:
        close_old_connections()
        try:
            worker_actor = django_user_model.objects.get(pk=actor.pk)
            barrier.wait()
            try:
                reverse_financial_transfer(
                    transfer_reference=original_outflow.transfer_reference,
                    occurred_at=timezone.now(),
                    actor=worker_actor,
                )
            except ValueError as exc:
                return str(exc)
            return "success"
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(lambda _: worker(), range(2)))

    assert sorted(results) == ["A transfer is already countered.", "success"]
    assert (
        FinancialJournalEntry.objects.filter(
            reverses_transfer_reference=original_outflow.transfer_reference
        ).count()
        == 2
    )
