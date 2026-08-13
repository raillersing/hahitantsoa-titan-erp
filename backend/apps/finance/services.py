from __future__ import annotations

import uuid
from decimal import Decimal

from django.db import transaction

from apps.audit.services import record_audit_event_on_commit
from apps.identity.authorization import (
    actor_has_application_role,
    require_reservation_sensitive_actor,
)
from apps.identity.roles import CompanyRole

from .models import (
    FIXED_FINANCIAL_CATEGORY_DEFINITIONS,
    FinanceAccount,
    FinanceAccountKind,
    FinanceBankProfile,
    FinancialCategory,
    FinancialCategoryKind,
    FinancialJournalDirection,
    FinancialJournalEntry,
)


def _validate_bank_profile_scope(*, bank_profile: FinanceBankProfile, business_scope: str) -> None:
    if bank_profile.account.business_scope != business_scope:
        raise ValueError("The selected bank belongs to another business scope.")
    if not bank_profile.account.is_active:
        raise ValueError("The selected bank account is inactive.")


def _set_default_bank_profile(*, profile: FinanceBankProfile) -> None:
    FinanceBankProfile.objects.filter(
        account__business_scope=profile.account.business_scope,
        is_default_for_documents=True,
    ).exclude(pk=profile.pk).update(is_default_for_documents=False)


@transaction.atomic
def create_finance_bank_profile(
    *,
    account: FinanceAccount,
    actor,
    bank_name: str,
    account_holder: str,
    branch: str = "",
    account_number: str = "",
    rib: str = "",
    iban: str = "",
    swift_bic: str = "",
    is_default_for_documents: bool = False,
) -> FinanceBankProfile:
    require_reservation_sensitive_actor(actor=actor)
    account_scope = FinanceAccount.objects.only("business_scope").get(pk=account.pk).business_scope
    locked_accounts = list(
        FinanceAccount.objects.select_for_update()
        .filter(business_scope=account_scope)
        .order_by("id")
    )
    locked_account = next(item for item in locked_accounts if item.pk == account.pk)
    if locked_account.kind != FinanceAccountKind.BANK:
        raise ValueError("A bank profile requires a bank finance account.")
    profile = FinanceBankProfile(
        account=locked_account,
        bank_name=bank_name,
        account_holder=account_holder,
        branch=branch,
        account_number=account_number,
        rib=rib,
        iban=iban,
        swift_bic=swift_bic,
        is_default_for_documents=is_default_for_documents,
    )
    profile.full_clean()
    profile.save()
    if profile.is_default_for_documents:
        _set_default_bank_profile(profile=profile)
    record_audit_event_on_commit(
        actor=actor,
        action="finance.bank_profile_created",
        target_type="finance_bank_profile",
        target_id=str(profile.id),
        metadata={
            "business_scope": locked_account.business_scope,
            "default": profile.is_default_for_documents,
        },
    )
    return profile


@transaction.atomic
def create_finance_bank_profile_with_account(
    *,
    actor,
    business_scope: str,
    account_code: str,
    account_label: str,
    **profile_fields,
) -> FinanceBankProfile:
    account = create_finance_account(
        actor=actor,
        business_scope=business_scope,
        code=account_code,
        label=account_label,
        kind=FinanceAccountKind.BANK,
    )
    return create_finance_bank_profile(
        account=account,
        actor=actor,
        **profile_fields,
    )


@transaction.atomic
def configure_finance_bank_profile(
    *, profile: FinanceBankProfile, actor, is_default_for_documents: bool | None = None, **fields
) -> FinanceBankProfile:
    require_reservation_sensitive_actor(actor=actor)
    account_scope = (
        FinanceBankProfile.objects.select_related("account")
        .only("account__business_scope")
        .get(pk=profile.pk)
        .account.business_scope
    )
    list(
        FinanceAccount.objects.select_for_update()
        .filter(business_scope=account_scope)
        .order_by("id")
    )
    locked = (
        FinanceBankProfile.objects.select_for_update().select_related("account").get(pk=profile.pk)
    )
    allowed = {
        "bank_name",
        "branch",
        "account_holder",
        "account_number",
        "rib",
        "iban",
        "swift_bic",
    }
    for field, value in fields.items():
        if field not in allowed:
            raise ValueError(f"Unsupported bank profile field: {field}")
        setattr(locked, field, value)
    if is_default_for_documents is not None:
        locked.is_default_for_documents = is_default_for_documents
    locked.full_clean()
    locked.save()
    if locked.is_default_for_documents:
        _set_default_bank_profile(profile=locked)
    record_audit_event_on_commit(
        actor=actor,
        action="finance.bank_profile_configured",
        target_type="finance_bank_profile",
        target_id=str(locked.id),
        metadata={"default": locked.is_default_for_documents},
    )
    return locked


def get_default_finance_bank_profile(*, business_scope: str) -> FinanceBankProfile | None:
    return (
        FinanceBankProfile.objects.select_related("account")
        .filter(
            account__business_scope=business_scope,
            account__kind=FinanceAccountKind.BANK,
            account__is_active=True,
            is_default_for_documents=True,
        )
        .first()
    )


FINANCIAL_CATEGORY_MANAGER_PERMISSION_DENIED_MESSAGE = (
    "Actor is not allowed to manage fixed financial categories; manager access is required."
)


def require_financial_category_manager(*, actor) -> None:
    if actor_has_application_role(actor=actor, role_slug=CompanyRole.OWNER_MANAGER) or (
        actor_has_application_role(actor=actor, role_slug=CompanyRole.MANAGER)
    ):
        return
    raise PermissionError(FINANCIAL_CATEGORY_MANAGER_PERMISSION_DENIED_MESSAGE)


@transaction.atomic
def seed_fixed_financial_categories(*, actor) -> list[FinancialCategory]:
    """Verify the migration-seeded catalog for a financial-category manager."""
    require_financial_category_manager(actor=actor)
    expected_by_code = {
        code: (label, kind) for code, label, kind in FIXED_FINANCIAL_CATEGORY_DEFINITIONS
    }
    categories_by_code = {category.code: category for category in FinancialCategory.objects.all()}
    if set(categories_by_code) != set(expected_by_code) or any(
        (category.label, category.kind) != expected_by_code[code]
        for code, category in categories_by_code.items()
    ):
        raise RuntimeError("Fixed financial categories are missing or inconsistent.")
    return [categories_by_code[code] for code in expected_by_code]


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
    category: FinancialCategory | None = None,
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
        category=category,
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


def _expected_transfer_category_code(
    *, source_account: FinanceAccount, destination_account: FinanceAccount
) -> str:
    if source_account.business_scope != destination_account.business_scope:
        if (
            source_account.kind != FinanceAccountKind.CASH
            or destination_account.kind != FinanceAccountKind.CASH
            or source_account.code != destination_account.code
        ):
            raise ValueError("Cross-scope transfers require shared physical cash accounts.")
        return "transfer.titan_hahitantsoa"

    account_kinds = frozenset((source_account.kind, destination_account.kind))
    category_by_account_kinds = {
        frozenset((FinanceAccountKind.CASH, FinanceAccountKind.BANK)): "transfer.cash_bank",
        frozenset((FinanceAccountKind.CASH, FinanceAccountKind.MOBILE_MONEY)): (
            "transfer.cash_mobile_money"
        ),
        frozenset((FinanceAccountKind.BANK, FinanceAccountKind.MOBILE_MONEY)): (
            "transfer.bank_mobile_money"
        ),
    }
    try:
        return category_by_account_kinds[account_kinds]
    except KeyError as exc:
        raise ValueError("Unsupported finance-account transfer route.") from exc


def _locked_active_transfer_accounts(
    *, source_account: FinanceAccount, destination_account: FinanceAccount
) -> tuple[FinanceAccount, FinanceAccount]:
    if source_account.pk == destination_account.pk:
        raise ValueError("A financial transfer requires two distinct finance accounts.")

    account_ids = sorted((source_account.pk, destination_account.pk), key=str)
    locked_accounts = {
        account.pk: account
        for account in FinanceAccount.objects.select_for_update().filter(pk__in=account_ids)
    }
    locked_source = locked_accounts.get(source_account.pk)
    locked_destination = locked_accounts.get(destination_account.pk)
    if locked_source is None or locked_destination is None:
        raise ValueError("Financial transfer account no longer exists.")
    if not locked_source.is_active or not locked_destination.is_active:
        raise ValueError("Financial transfers require active finance accounts.")
    return locked_source, locked_destination


def _record_financial_transfer(
    *,
    source_account: FinanceAccount,
    destination_account: FinanceAccount,
    category: FinancialCategory,
    amount: Decimal,
    occurred_at,
    actor,
    notes: str,
    transfer_reference=None,
    reverses_transfer_reference=None,
    audit_action: str,
    audit_target_id: str,
) -> tuple[FinancialJournalEntry, FinancialJournalEntry]:
    locked_source, locked_destination = _locked_active_transfer_accounts(
        source_account=source_account,
        destination_account=destination_account,
    )
    locked_category = FinancialCategory.objects.select_for_update().get(pk=category.pk)
    expected_category_code = _expected_transfer_category_code(
        source_account=locked_source,
        destination_account=locked_destination,
    )
    if (
        locked_category.kind != FinancialCategoryKind.TRANSFER
        or locked_category.code != expected_category_code
    ):
        raise ValueError("Financial transfer category does not match the transfer route.")
    if amount is None or amount <= Decimal("0.00"):
        raise ValueError("Financial transfer amount must be positive.")

    transfer_reference = transfer_reference or uuid.uuid4()
    common_entry_values = {
        "amount": amount,
        "occurred_at": occurred_at,
        "source_label": "Financial transfer",
        "transfer_reference": transfer_reference,
        "reverses_transfer_reference": reverses_transfer_reference,
        "category": locked_category,
        "notes": notes,
        "recorded_by": actor,
    }
    outflow = FinancialJournalEntry(
        account=locked_source,
        direction=FinancialJournalDirection.OUTFLOW,
        **common_entry_values,
    )
    inflow = FinancialJournalEntry(
        account=locked_destination,
        direction=FinancialJournalDirection.INFLOW,
        **common_entry_values,
    )
    outflow.full_clean()
    inflow.full_clean()
    outflow.save()
    inflow.save()
    record_audit_event_on_commit(
        actor=actor,
        action=audit_action,
        target_type="financial_transfer",
        target_id=audit_target_id,
        metadata={
            "transfer_reference": str(transfer_reference),
            "source_account_id": str(locked_source.id),
            "destination_account_id": str(locked_destination.id),
            "outflow_entry_id": str(outflow.id),
            "inflow_entry_id": str(inflow.id),
            "amount": str(amount),
            "category_code": locked_category.code,
            "reverses_transfer_reference": str(reverses_transfer_reference or ""),
        },
    )
    return outflow, inflow


@transaction.atomic
def record_financial_transfer(
    *,
    source_account: FinanceAccount,
    destination_account: FinanceAccount,
    category: FinancialCategory,
    amount: Decimal,
    occurred_at,
    actor,
    notes: str = "",
) -> tuple[FinancialJournalEntry, FinancialJournalEntry]:
    """Record an immutable, balanced transfer pair between two finance accounts."""
    require_reservation_sensitive_actor(actor=actor)
    transfer_reference = uuid.uuid4()
    return _record_financial_transfer(
        source_account=source_account,
        destination_account=destination_account,
        category=category,
        amount=amount,
        occurred_at=occurred_at,
        actor=actor,
        notes=notes,
        transfer_reference=transfer_reference,
        audit_action="finance.transfer_recorded",
        audit_target_id=str(transfer_reference),
    )


@transaction.atomic
def reverse_financial_transfer(
    *, transfer_reference, occurred_at, actor, notes: str = ""
) -> tuple[FinancialJournalEntry, FinancialJournalEntry]:
    """Correct a transfer only by recording its immutable counter-transfer pair."""
    require_reservation_sensitive_actor(actor=actor)
    original_entries = list(
        FinancialJournalEntry.objects.select_for_update(of=("self",))
        .select_related("account", "category")
        .filter(transfer_reference=transfer_reference)
        .order_by("id")
    )
    if len(original_entries) != 2:
        raise ValueError("A counter-transfer requires exactly two original transfer entries.")
    original_by_direction = {entry.direction: entry for entry in original_entries}
    original_outflow = original_by_direction.get(FinancialJournalDirection.OUTFLOW)
    original_inflow = original_by_direction.get(FinancialJournalDirection.INFLOW)
    if original_outflow is None or original_inflow is None:
        raise ValueError("A counter-transfer requires opposing original transfer entries.")
    if (
        original_outflow.amount != original_inflow.amount
        or original_outflow.category_id != original_inflow.category_id
        or original_outflow.category is None
    ):
        raise ValueError("Original transfer entries are inconsistent.")
    if FinancialJournalEntry.objects.filter(
        reverses_transfer_reference=transfer_reference
    ).exists():
        raise ValueError("A transfer is already countered.")

    return _record_financial_transfer(
        source_account=original_inflow.account,
        destination_account=original_outflow.account,
        category=original_outflow.category,
        amount=original_outflow.amount,
        occurred_at=occurred_at,
        actor=actor,
        notes=notes,
        reverses_transfer_reference=transfer_reference,
        audit_action="finance.transfer_reversed",
        audit_target_id=str(transfer_reference),
    )
