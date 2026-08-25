from decimal import Decimal

import pytest
from django.utils import timezone

from apps.documents.models import DocumentInstance, DocumentInstanceStatus
from apps.finance.models import FinanceAccount, FinanceAccountKind, FinanceBusinessScope
from apps.payments.models import Payment, PaymentKind, PaymentMethod, PaymentStatus
from apps.payments.serializers import ReconciliationCommitSerializer
from apps.payments.services import commit_reconciliation_import, stage_reconciliation_csv

pytestmark = pytest.mark.django_db


def _receipt() -> DocumentInstance:
    return DocumentInstance.objects.create(
        template_key="titan.payment_receipt.v1",
        template_version="v1",
        template_label="Receipt",
        business_scope="shared",
        document_type="payment_receipt",
        template_status="generated_draft_template",
        template_source_kind="generated_from_brand_style",
        template_source_reference="test",
        template_path="test.html",
        template_preview_path="test.pdf",
        template_validated_by_client=False,
        template_notes="",
        reservation_public_reference="",
        reservation_status="",
        customer_display_name="Customer",
        customer_email="",
        customer_phone="",
        customer_address="",
        status=DocumentInstanceStatus.GENERATED,
        content_checksum="a" * 64,
        storage_path="documents/test/receipt.html",
        generated_content_size_bytes=128,
    )


def _confirmed_payment(*, actor, amount: str) -> Payment:
    return Payment.objects.create(
        payment_kind=PaymentKind.DEPOSIT,
        payment_method=PaymentMethod.BANK_TRANSFER,
        payment_status=PaymentStatus.CONFIRMED,
        amount=Decimal(amount),
        paid_at=timezone.now(),
        source_label="Bank transfer",
        receipt_document=_receipt(),
        confirmed_at=timezone.now(),
        confirmed_by=actor,
        created_by=actor,
        updated_by=actor,
    )


def test_committing_staged_csv_grouped_deposit_reconciles_all_fully_allocated_payments(
    django_user_model,
    django_capture_on_commit_callbacks,
) -> None:
    actor = django_user_model.objects.create_user(username="reconciliation-operator")
    account = FinanceAccount.objects.create(
        business_scope=FinanceBusinessScope.HAHITANTSOA,
        code="BANK-PRIMARY",
        label="Primary bank",
        kind=FinanceAccountKind.BANK,
        created_by=actor,
        updated_by=actor,
    )
    first_payment = _confirmed_payment(actor=actor, amount="60000.00")
    second_payment = _confirmed_payment(actor=actor, amount="40000.00")

    reconciliation_import = stage_reconciliation_csv(
        account=account,
        actor=actor,
        csv_content=(
            "transaction_date,amount,reference,description\n"
            "2026-07-23,100000.00,DEP-100,Grouped deposit\n"
        ),
    )
    statement_line = reconciliation_import.lines.get()

    with django_capture_on_commit_callbacks(execute=True):
        committed = commit_reconciliation_import(
            reconciliation_import=reconciliation_import,
            actor=actor,
            idempotency_key="commit-grouped-deposit-1",
            allocations=[
                {
                    "line_id": statement_line.id,
                    "payment_id": first_payment.id,
                    "amount": "60000.00",
                },
                {
                    "line_id": statement_line.id,
                    "payment_id": second_payment.id,
                    "amount": "40000.00",
                },
            ],
        )

    first_payment.refresh_from_db()
    second_payment.refresh_from_db()
    statement_line.refresh_from_db()
    assert committed.status == "committed"
    assert statement_line.status == "reconciled"
    assert statement_line.allocations.count() == 2
    assert first_payment.payment_status == PaymentStatus.RECONCILED
    assert second_payment.payment_status == PaymentStatus.RECONCILED


def test_csv_preview_requires_sensitive_access(client, django_user_model) -> None:
    user = django_user_model.objects.create_user(username="ordinary-reconciliation-user")
    client.force_login(user)

    response = client.post(
        "/api/v1/payments/reconciliation/imports/csv/",
        data={"account_id": "00000000-0000-0000-0000-000000000000", "csv_content": ""},
        content_type="application/json",
    )

    assert response.status_code == 403


def test_reconciliation_commit_serializer_coerces_json_uuid_values() -> None:
    serializer = ReconciliationCommitSerializer(
        data={
            "idempotency_key": "reconciliation-json-uuid",
            "allocations": [
                {
                    "line_id": "00000000-0000-0000-0000-000000000001",
                    "payment_id": "00000000-0000-0000-0000-000000000002",
                    "amount": "100.00",
                }
            ],
        }
    )

    assert serializer.is_valid(), serializer.errors
    allocation = serializer.validated_data["allocations"][0]
    assert str(allocation["line_id"]) == "00000000-0000-0000-0000-000000000001"
    assert str(allocation["payment_id"]) == "00000000-0000-0000-0000-000000000002"
