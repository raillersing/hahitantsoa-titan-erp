from __future__ import annotations

from decimal import Decimal

from django.db import transaction

from apps.audit.services import record_audit_event_on_commit
from apps.identity.authorization import require_reservation_sensitive_actor

from .models import FinanceAccount, FinancialJournalEntry


@transaction.atomic
def create_finance_account(
    *, actor, business_scope: str, code: str, label: str, kind: str
) -> FinanceAccount:
    require_reservation_sensitive_actor(actor=actor)
    account = FinanceAccount(
        business_scope=business_scope,
        code=code,
        label=label,
        kind=kind,
        created_by=actor,
        updated_by=actor,
    )
    account.full_clean()
    account.save()
    record_audit_event_on_commit(
        actor=actor,
        action="finance.account_created",
        target_type="finance_account",
        target_id=str(account.id),
        metadata={
            "business_scope": account.business_scope,
            "kind": account.kind,
            "code": account.code,
        },
    )
    return account


@transaction.atomic
def configure_finance_account(
    *,
    account: FinanceAccount,
    actor,
    label: str | None = None,
    is_active: bool | None = None,
) -> FinanceAccount:
    """Change the operator-facing configuration without altering journal history."""
    require_reservation_sensitive_actor(actor=actor)
    locked_account = FinanceAccount.objects.select_for_update().get(pk=account.pk)
    if label is not None:
        locked_account.label = label
    if is_active is not None:
        locked_account.is_active = is_active
    locked_account.updated_by = actor
    locked_account.full_clean()
    locked_account.save()
    record_audit_event_on_commit(
        actor=actor,
        action="finance.account_configured",
        target_type="finance_account",
        target_id=str(locked_account.id),
        metadata={"is_active": locked_account.is_active},
    )
    return locked_account


@transaction.atomic
def record_financial_journal_entry(
    *,
    account: FinanceAccount,
    direction: str,
    amount: Decimal,
    occurred_at,
    actor,
    source_label: str = "",
    transfer_reference=None,
    payment=None,
    billing_invoice=None,
    billing_refund_obligation=None,
    reservation_draft=None,
    hahitantsoa_event_draft=None,
    notes: str = "",
) -> FinancialJournalEntry:
    require_reservation_sensitive_actor(actor=actor)
    locked_account = FinanceAccount.objects.select_for_update().get(pk=account.pk)
    if not locked_account.is_active:
        raise ValueError("Financial journal entries require an active finance account.")
    entry = FinancialJournalEntry(
        account=locked_account,
        direction=direction,
        amount=amount,
        occurred_at=occurred_at,
        source_label=source_label,
        transfer_reference=transfer_reference,
        payment=payment,
        billing_invoice=billing_invoice,
        billing_refund_obligation=billing_refund_obligation,
        reservation_draft=reservation_draft,
        hahitantsoa_event_draft=hahitantsoa_event_draft,
        notes=notes,
        recorded_by=actor,
    )
    entry.full_clean()
    entry.save()
    record_audit_event_on_commit(
        actor=actor,
        action="finance.journal_entry_recorded",
        target_type="financial_journal_entry",
        target_id=str(entry.id),
        metadata={
            "account_id": str(locked_account.id),
            "direction": entry.direction,
            "amount": str(entry.amount),
        },
    )
    return entry
