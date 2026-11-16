from __future__ import annotations

import uuid
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from apps.billing.models import (
    BillingInvoice,
    BillingInvoiceSourceKind,
    BillingInvoiceStatus,
)
from apps.customers.models import Customer
from apps.documents.models import DocumentInstance, DocumentInstanceStatus
from apps.finance.models import FinanceAccount, FinanceAccountKind
from apps.finance.services import create_finance_bank_profile
from apps.identity.models import ApplicationRole, UserRoleAssignment
from apps.payments.models import (
    Payment,
    PaymentKind,
    PaymentMethod,
    PaymentReconciliationImport,
    PaymentStatus,
)
from apps.reservations.models import ReservationDraft

User = get_user_model()
pytestmark = pytest.mark.django_db


def _create_user_with_role(username: str, role_slug: str, *, is_active: bool = True) -> User:
    user = User.objects.create_user(
        username=username,
        email=f"{username}@example.com",
        password="test-password-123",
        is_active=is_active,
    )
    role, _ = ApplicationRole.objects.get_or_create(
        slug=role_slug,
        defaults={"name": role_slug.replace("_", " ").title(), "is_active": True},
    )
    UserRoleAssignment.objects.create(
        user=user,
        role=role,
        is_active=True,
    )
    return user


def _create_sensitive_user(username: str) -> User:
    """User possessing canSensitiveWrite (e.g. manager) without canManageFinance if possible."""
    return _create_user_with_role(username, "reservation_sensitive_operator")


def _create_accountant_user(username: str, *, is_active: bool = True) -> User:
    """User possessing canManageFinance (accountant) and NOT canSensitiveWrite."""
    return _create_user_with_role(username, "accountant", is_active=is_active)


def _create_unprivileged_user(username: str) -> User:
    """User without financial or sensitive capabilities (storekeeper)."""
    return _create_user_with_role(username, "storekeeper")


def _client_for(user: User) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _create_test_customer(creator: User) -> Customer:
    return Customer.objects.create(
        display_name="Client Test",
        phone="+261340000001",
        email="client.test@example.com",
        created_by=creator,
        updated_by=creator,
    )


def _create_test_draft(
    creator: User,
    customer: Customer,
    *,
    contract_signed: bool = True,
    days_in_future: int = 60,
) -> ReservationDraft:
    now = timezone.now()
    start_at = now + timezone.timedelta(days=days_in_future)
    end_at = start_at + timezone.timedelta(days=3)
    return ReservationDraft.objects.create(
        customer=customer,
        start_at=start_at,
        end_at=end_at,
        created_by=creator,
        updated_by=creator,
        contract_signed_at=now if contract_signed else None,
        contract_signed_by=creator if contract_signed else None,
    )


def _create_test_bank_account(code: str = "BANK-TEST-01") -> FinanceAccount:
    admin = User.objects.create_superuser(
        f"admin-{code.lower()}-{uuid.uuid4().hex[:4]}", password="pwd"
    )
    from apps.finance.services import create_finance_account

    return create_finance_account(
        actor=admin,
        business_scope="titan",
        code=code,
        label=f"Compte {code}",
        kind=FinanceAccountKind.BANK,
    )


def _create_confirmed_payment(
    *,
    creator: User,
    draft: ReservationDraft,
    amount: Decimal,
    payment_kind: str = PaymentKind.DEPOSIT,
) -> Payment:
    receipt = DocumentInstance.objects.create(
        status=DocumentInstanceStatus.GENERATED,
        content_checksum="a" * 64,
        storage_path="documents/test/receipt.html",
        generated_content_size_bytes=128,
    )
    now = timezone.now()
    return Payment.objects.create(
        reservation_draft=draft,
        payment_kind=payment_kind,
        payment_method=PaymentMethod.BANK_TRANSFER,
        payment_status=PaymentStatus.CONFIRMED,
        amount=amount,
        paid_at=now,
        receipt_document=receipt,
        confirmed_at=now,
        confirmed_by=creator,
        created_by=creator,
        updated_by=creator,
    )


def _create_test_invoice(creator: User, draft: ReservationDraft) -> BillingInvoice:
    return BillingInvoice.objects.create(
        reservation_draft=draft,
        source_kind=BillingInvoiceSourceKind.COMMERCIAL_CLOSEOUT,
        invoice_status=BillingInvoiceStatus.OPEN,
        amount=Decimal("500000.00"),
        issued_at=timezone.now(),
        number=f"INV-{uuid.uuid4().hex[:8].upper()}",
        created_by=creator,
        updated_by=creator,
    )


# ==============================================================================
# 1. Bank Profiles Access Tests (/api/v1/finance/banks/)
# ==============================================================================


def test_bank_profile_list_create_accountant_authorized():
    accountant = _create_accountant_user("acct-bank-create")
    client = _client_for(accountant)

    # 1. Create bank profile with account creation
    response = client.post(
        "/api/v1/finance/banks/",
        {
            "business_scope": "titan",
            "account_code": "BANK-ACCT-01",
            "account_label": "Compte Principal",
            "bank_name": "BNI Madagascar",
            "branch": "Analakely",
            "account_holder": "Titan SARL",
            "rib": "000010000200003",
            "is_default_for_documents": True,
        },
        format="json",
    )
    assert response.status_code == 201
    profile_id = response.data["id"]

    # 2. List bank profiles
    list_response = client.get("/api/v1/finance/banks/")
    assert list_response.status_code == 200
    assert any(item["id"] == profile_id for item in list_response.data)

    # 3. Patch bank profile
    patch_response = client.patch(
        f"/api/v1/finance/banks/{profile_id}/",
        {"branch": "Ankorondrano"},
        format="json",
    )
    assert patch_response.status_code == 200
    assert patch_response.data["branch"] == "Ankorondrano"


def test_bank_profile_create_preserves_historical_sensitive_operator_rights():
    """Verify that a commercial operator with canSensitiveWrite (and NOT canManageFinance)
    retains full ability to create and update bank profiles."""
    sensitive_op = _create_sensitive_user("sens-bank-create")
    client = _client_for(sensitive_op)

    response = client.post(
        "/api/v1/finance/banks/",
        {
            "business_scope": "titan",
            "account_code": "BANK-SENS-01",
            "account_label": "Compte Sensitive",
            "bank_name": "BMOI",
            "branch": "Antaninarenina",
            "account_holder": "Titan SARL",
            "rib": "000010000200004",
            "is_default_for_documents": False,
        },
        format="json",
    )
    assert response.status_code == 201


def test_bank_profile_create_refuses_unprivileged_role():
    storekeeper = _create_unprivileged_user("storekeeper-bank")
    client = _client_for(storekeeper)

    response = client.post(
        "/api/v1/finance/banks/",
        {
            "business_scope": "titan",
            "account_code": "BANK-UNPRIV-01",
            "account_label": "Compte Unpriv",
            "bank_name": "BOA",
            "account_holder": "Titan SARL",
            "rib": "000010000200005",
        },
        format="json",
    )
    assert response.status_code == 403


def test_bank_profile_create_refuses_inactive_accountant():
    inactive_acct = _create_accountant_user("inactive-acct-bank", is_active=False)
    client = _client_for(inactive_acct)

    response = client.post(
        "/api/v1/finance/banks/",
        {
            "business_scope": "titan",
            "account_code": "BANK-INACTIVE-01",
            "account_label": "Compte Inactive",
            "bank_name": "BOA",
            "account_holder": "Titan SARL",
            "rib": "000010000200006",
        },
        format="json",
    )
    assert response.status_code in {401, 403}


def test_bank_profile_create_refuses_stale_in_memory_deactivated_accountant():
    acct = _create_accountant_user("stale-acct-bank")
    client = _client_for(acct)

    # Deactivate directly in database without updating in-memory object
    User.objects.filter(pk=acct.pk).update(is_active=False)

    response = client.post(
        "/api/v1/finance/banks/",
        {
            "business_scope": "titan",
            "account_code": "BANK-STALE-01",
            "account_label": "Compte Stale",
            "bank_name": "BOA",
            "account_holder": "Titan SARL",
            "rib": "000010000200007",
        },
        format="json",
    )
    assert response.status_code in {401, 403}
    assert not FinanceAccount.objects.filter(code="BANK-STALE-01").exists()


def test_bank_profile_service_direct_authorization_and_refusal():
    accountant = _create_accountant_user("acct-srv-direct")
    sensitive_op = _create_sensitive_user("sens-srv-direct")
    unprivileged = _create_unprivileged_user("unpriv-srv-direct")

    account1 = _create_test_bank_account("BANK-SRV-01")
    account2 = _create_test_bank_account("BANK-SRV-02")
    account3 = _create_test_bank_account("BANK-SRV-03")

    # Accountant succeeds
    p1 = create_finance_bank_profile(
        account=account1,
        actor=accountant,
        bank_name="Banque A",
        account_holder="Titan",
        rib="000010000200008",
    )
    assert p1.pk is not None

    # Sensitive operator succeeds
    p2 = create_finance_bank_profile(
        account=account2,
        actor=sensitive_op,
        bank_name="Banque B",
        account_holder="Titan",
        rib="000010000200009",
    )
    assert p2.pk is not None

    # Unprivileged raises PermissionError
    with pytest.raises(PermissionError):
        create_finance_bank_profile(
            account=account3,
            actor=unprivileged,
            bank_name="Banque C",
            account_holder="Titan",
            rib="000010000200010",
        )


# ==============================================================================
# 2. Payment Recording Access Tests (/api/v1/payments/)
# ==============================================================================


def test_payment_create_contract_signed_prerequisite():
    colleague = _create_sensitive_user("colleague-author-1")
    customer = _create_test_customer(colleague)
    draft_unsigned = _create_test_draft(colleague, customer, contract_signed=False)

    accountant = _create_accountant_user("acct-pay-create-1")
    client = _client_for(accountant)

    # Payment on unsigned draft must be rejected
    response = client.post(
        "/api/v1/payments/",
        {
            "reservation_draft": str(draft_unsigned.id),
            "payment_kind": PaymentKind.DEPOSIT,
            "payment_method": PaymentMethod.BANK_TRANSFER,
            "amount": "100000.00",
        },
        format="json",
    )
    assert response.status_code == 400
    assert "contract_signature_required_before_payment" in response.data.get("code", "")


def test_payment_create_and_confirm_accountant_authorized():
    colleague = _create_sensitive_user("colleague-author-2")
    customer = _create_test_customer(colleague)
    draft = _create_test_draft(colleague, customer, contract_signed=True)

    accountant = _create_accountant_user("acct-pay-create-2")
    client = _client_for(accountant)

    # 1. Record payment on colleague's draft (Shared Dossier R01)
    response = client.post(
        "/api/v1/payments/",
        {
            "reservation_draft": str(draft.id),
            "payment_kind": PaymentKind.DEPOSIT,
            "payment_method": PaymentMethod.BANK_TRANSFER,
            "amount": "150000.00",
            "external_reference": "VIR-2026-001",
        },
        format="json",
    )
    assert response.status_code == 201
    payment_id = response.data["id"]

    # 2. Confirm payment
    confirm_response = client.post(
        f"/api/v1/payments/{payment_id}/confirm/",
        {"paid_at": timezone.now().isoformat(), "external_reference": "VIR-2026-001-CONF"},
        format="json",
    )
    assert confirm_response.status_code == 200
    assert confirm_response.data["payment_status"] == PaymentStatus.CONFIRMED


def test_payment_create_preserves_historical_sensitive_operator_rights():
    creator = _create_sensitive_user("author-sens-op")
    customer = _create_test_customer(creator)
    draft = _create_test_draft(creator, customer, contract_signed=True)

    other_sensitive_op = _create_sensitive_user("other-sens-op")
    client = _client_for(other_sensitive_op)

    response = client.post(
        "/api/v1/payments/",
        {
            "reservation_draft": str(draft.id),
            "payment_kind": PaymentKind.DEPOSIT,
            "payment_method": PaymentMethod.CASH,
            "amount": "80000.00",
        },
        format="json",
    )
    assert response.status_code == 201


def test_payment_create_refuses_unprivileged_role():
    colleague = _create_sensitive_user("author-colleague-3")
    customer = _create_test_customer(colleague)
    draft = _create_test_draft(colleague, customer, contract_signed=True)

    storekeeper = _create_unprivileged_user("storekeeper-pay")
    client = _client_for(storekeeper)

    response = client.post(
        "/api/v1/payments/",
        {
            "reservation_draft": str(draft.id),
            "payment_kind": PaymentKind.DEPOSIT,
            "payment_method": PaymentMethod.CASH,
            "amount": "80000.00",
        },
        format="json",
    )
    assert response.status_code == 403


def test_deposit_recording_atomic_endpoint():
    colleague = _create_sensitive_user("colleague-author-dep")
    customer = _create_test_customer(colleague)
    draft = _create_test_draft(colleague, customer, contract_signed=True)

    client = _client_for(colleague)

    # Atomic deposit recording
    response = client.post(
        "/api/v1/payments/deposits/record/",
        {
            "reservation_draft": str(draft.id),
            "payment_method": PaymentMethod.BANK_TRANSFER,
            "amount": "200000.00",
            "idempotency_key": "IDEMP-DEP-001",
            "external_reference": "REF-DEP-001",
        },
        format="json",
    )
    assert response.status_code == 200
    assert response.data["payment"]["payment_status"] == PaymentStatus.CONFIRMED

    # Replay safe
    replay_response = client.post(
        "/api/v1/payments/deposits/record/",
        {
            "reservation_draft": str(draft.id),
            "payment_method": PaymentMethod.BANK_TRANSFER,
            "amount": "200000.00",
            "idempotency_key": "IDEMP-DEP-001",
            "external_reference": "REF-DEP-001",
        },
        format="json",
    )
    assert replay_response.status_code == 200
    assert replay_response.data["replayed"] is True


def test_reconciliation_csv_staging_and_commit():
    accountant = _create_accountant_user("acct-reconcile")
    client = _client_for(accountant)

    colleague = _create_sensitive_user("colleague-rec-draft")
    customer = _create_test_customer(colleague)
    draft = _create_test_draft(colleague, customer, contract_signed=True)
    payment = _create_confirmed_payment(creator=colleague, draft=draft, amount=Decimal("100000.00"))

    account = _create_test_bank_account("BANK-REC-01")

    csv_data = (
        "transaction_date,amount,reference,description\n"
        "2026-11-16,100000.00,REF-001,Virement client\n"
    )

    # Stage CSV
    response = client.post(
        "/api/v1/payments/reconciliation/imports/csv/",
        {"account_id": str(account.id), "csv_content": csv_data},
        format="json",
    )
    assert response.status_code == 201
    import_id = response.data["id"]

    statement_line = PaymentReconciliationImport.objects.get(id=import_id).lines.first()
    assert statement_line is not None

    # Commit import
    commit_response = client.post(
        f"/api/v1/payments/reconciliation/imports/{import_id}/commit/",
        {
            "idempotency_key": "REC-COMMIT-001",
            "allocations": [
                {
                    "line_id": str(statement_line.id),
                    "payment_id": str(payment.id),
                    "amount": "100000.00",
                }
            ],
        },
        format="json",
    )
    assert commit_response.status_code == 200
    assert commit_response.data["status"] == "committed"

    # Unprivileged user refuses
    storekeeper = _create_unprivileged_user("storekeeper-rec")
    client_unpriv = _client_for(storekeeper)
    assert (
        client_unpriv.post(
            "/api/v1/payments/reconciliation/imports/csv/",
            {"account_id": str(account.id), "csv_content": csv_data},
            format="json",
        ).status_code
        == 403
    )


# ==============================================================================
# 3. Billing Operations Access Tests (/api/v1/billing/)
# ==============================================================================


def test_billing_installment_creation_and_allocation():
    from apps.billing.services import billing_installment_due_date_presets

    colleague = _create_sensitive_user("colleague-author-bill")
    customer = _create_test_customer(colleague)
    draft = _create_test_draft(colleague, customer, contract_signed=True, days_in_future=60)
    invoice = _create_test_invoice(colleague, draft)

    accountant = _create_accountant_user("acct-billing-installments")
    client = _client_for(accountant)

    presets = billing_installment_due_date_presets(start_at=draft.start_at)
    assert presets is not None
    half = invoice.amount / Decimal("2")

    # 1. Create installment schedule adhering to INV-009
    response = client.post(
        f"/api/v1/billing/invoices/{invoice.id}/installments/",
        {
            "installments": [
                {"amount": str(half), "due_at": presets.j30.isoformat()},
                {"amount": str(half), "due_at": presets.j10.isoformat()},
            ],
            "notes": "Echeancier valide",
        },
        format="json",
    )
    assert response.status_code == 201
    installment_id = response.data[0]["id"]

    # 2. Record a confirmed payment to allocate
    payment = _create_confirmed_payment(
        creator=accountant,
        draft=draft,
        amount=half,
    )

    # 3. Allocate payment to installment (Imputation)
    alloc_response = client.post(
        f"/api/v1/billing/installments/{installment_id}/allocate/",
        {"payment": str(payment.id), "notes": "Imputation acompte"},
        format="json",
    )
    assert alloc_response.status_code == 200


def test_billing_invoice_settlement():
    colleague = _create_sensitive_user("colleague-author-settle")
    customer = _create_test_customer(colleague)
    draft = _create_test_draft(colleague, customer, contract_signed=True)
    invoice = _create_test_invoice(colleague, draft)

    accountant = _create_accountant_user("acct-billing-settle")
    client = _client_for(accountant)

    payment = _create_confirmed_payment(
        creator=accountant,
        draft=draft,
        amount=Decimal("500000.00"),
        payment_kind=PaymentKind.BALANCE,
    )

    response = client.post(
        f"/api/v1/billing/invoices/{invoice.id}/settle/",
        {"payment": str(payment.id), "notes": "Solde complet facture"},
        format="json",
    )
    assert response.status_code == 200
    assert response.data["invoice_status"] == BillingInvoiceStatus.SETTLED


# ==============================================================================
# 4. Strict D01 Reserves Tests (Negative Proofs)
# ==============================================================================


def test_strict_d01_accountant_cannot_sign_contract():
    colleague = _create_sensitive_user("colleague-draft-sign")
    customer = _create_test_customer(colleague)
    draft = _create_test_draft(colleague, customer, contract_signed=False)

    accountant = _create_accountant_user("acct-attempt-sign")
    client = _client_for(accountant)

    response = client.post(
        f"/api/v1/reservations/drafts/{draft.id}/contract-signed/",
        format="json",
    )
    assert response.status_code == 403


def test_strict_d01_accountant_cannot_confirm_reservation():
    colleague = _create_sensitive_user("colleague-draft-confirm")
    customer = _create_test_customer(colleague)
    draft = _create_test_draft(colleague, customer, contract_signed=True)

    accountant = _create_accountant_user("acct-attempt-confirm")
    client = _client_for(accountant)

    response = client.post(
        f"/api/v1/reservations/drafts/{draft.id}/confirm/",
        format="json",
    )
    assert response.status_code == 403


def test_strict_d01_accountant_cannot_cancel_payment():
    accountant = _create_accountant_user("acct-attempt-cancel")
    client = _client_for(accountant)

    dummy_id = uuid.uuid4()
    response = client.post(
        f"/api/v1/payments/{dummy_id}/cancel/",
        {"reason": "test"},
        format="json",
    )
    assert response.status_code == 403


def test_strict_d01_accountant_cannot_create_refund():
    accountant = _create_accountant_user("acct-attempt-refund")
    client = _client_for(accountant)

    response = client.post(
        "/api/v1/payments/refund/",
        {"refund_obligation_id": str(uuid.uuid4())},
        format="json",
    )
    assert response.status_code == 403


def test_strict_d01_accountant_cannot_cancel_invoice():
    colleague = _create_sensitive_user("colleague-inv-cancel")
    customer = _create_test_customer(colleague)
    draft = _create_test_draft(colleague, customer, contract_signed=True)
    invoice = _create_test_invoice(colleague, draft)

    accountant = _create_accountant_user("acct-attempt-inv-cancel")
    client = _client_for(accountant)

    response = client.post(
        f"/api/v1/billing/invoices/{invoice.id}/cancel/",
        {"reason": "annulation demandee"},
        format="json",
    )
    assert response.status_code == 403


def test_strict_d01_accountant_cannot_issue_credit_note():
    colleague = _create_sensitive_user("colleague-credit-note")
    customer = _create_test_customer(colleague)
    draft = _create_test_draft(colleague, customer, contract_signed=True)
    invoice = _create_test_invoice(colleague, draft)

    accountant = _create_accountant_user("acct-attempt-credit-note")
    client = _client_for(accountant)

    response = client.post(
        f"/api/v1/billing/invoices/{invoice.id}/credit-notes/",
        {"reason": "Avoir commercial", "lines": []},
        format="json",
    )
    assert response.status_code == 403


def test_strict_d01_accountant_cannot_use_deposit_recording_atomic_endpoint():
    colleague = _create_sensitive_user("colleague-author-dep-acct")
    customer = _create_test_customer(colleague)
    draft = _create_test_draft(colleague, customer, contract_signed=True)

    accountant = _create_accountant_user("acct-deposit-record-refuse")
    client = _client_for(accountant)

    response = client.post(
        "/api/v1/payments/deposits/record/",
        {
            "reservation_draft": str(draft.id),
            "payment_method": PaymentMethod.BANK_TRANSFER,
            "amount": "200000.00",
            "idempotency_key": "IDEMP-DEP-ACCT-001",
        },
        format="json",
    )
    assert response.status_code == 403
