import sys
from datetime import timedelta
from decimal import Decimal

import pytest
from django.core.files.storage import FileSystemStorage
from django.utils import timezone

import apps.documents.runtime as runtime_module
from apps.audit.models import AuditEvent
from apps.customers.models import Customer
from apps.documents.models import DocumentInstance, DocumentInstanceStatus
from apps.finance.models import (
    FinanceAccount,
    FinanceAccountKind,
    FinanceBusinessScope,
    FinancialJournalEntry,
)
from apps.finance.services import create_finance_account
from apps.hahitantsoa.models import HahitantsoaEventDraft
from apps.notifications.models import SystemNotification
from apps.notifications.services import create_payment_confirmation_notification
from apps.payments.models import PaymentKind, PaymentMethod, PaymentStatus
from apps.payments.services import (
    INVALID_PAYMENT_CANCEL_STATE,
    INVALID_PAYMENT_CONFIRMATION_STATE,
    INVALID_PAYMENT_RECONCILE_STATE,
    PaymentLifecycleError,
    cancel_payment,
    confirm_payment,
    create_payment,
    reconcile_payment,
)
from apps.reservations.models import ReservationDraft

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def isolated_document_storage(tmp_path, monkeypatch):
    storage = FileSystemStorage(location=str(tmp_path))
    monkeypatch.setattr(runtime_module, "default_storage", storage)
    monkeypatch.setattr(sys.modules[__name__], "FileSystemStorage", FileSystemStorage)
    return storage


def _customer() -> Customer:
    return Customer.objects.create(
        display_name="Payment service customer",
        email="payment-service@example.test",
        phone="+261340000333",
        address="Antananarivo",
    )


def _reservation_draft() -> ReservationDraft:
    start_at = timezone.now().replace(microsecond=0) + timedelta(days=3)
    end_at = start_at + timedelta(hours=6)
    return ReservationDraft.objects.create(
        customer=_customer(),
        start_at=start_at,
        end_at=end_at,
        notes="Payment service reservation draft",
    )


def _hahitantsoa_event_draft(*, actor) -> HahitantsoaEventDraft:
    start_at = timezone.now().replace(microsecond=0) + timedelta(days=3)
    end_at = start_at + timedelta(hours=6)
    return HahitantsoaEventDraft.objects.create(
        customer=_customer(),
        event_name="Payment service event",
        start_at=start_at,
        end_at=end_at,
        created_by=actor,
        updated_by=actor,
    )


def test_create_payment_persists_generic_pending_payment(django_user_model) -> None:
    actor = django_user_model.objects.create_user(username="payment-creator", password="test-pass")

    payment = create_payment(
        actor=actor,
        payment_kind=PaymentKind.OWNER_INJECTION,
        payment_method=PaymentMethod.CASH,
        payment_status=PaymentStatus.PENDING,
        amount=Decimal("300000.00"),
        source_label="Owner cashbox",
    )

    assert payment.created_by_id == actor.id
    assert payment.payment_status == PaymentStatus.PENDING
    assert payment.receipt_document_id is None


def test_confirm_payment_generates_and_links_receipt_document(
    django_user_model,
    django_capture_on_commit_callbacks,
) -> None:
    actor = django_user_model.objects.create_user(
        username="payment-confirmer", password="test-pass", is_staff=True
    )
    create_finance_account(
        actor=actor,
        business_scope=FinanceBusinessScope.TITAN,
        code="BANK-TITAN-PAYMENT-TEST",
        label="Titan payment test bank",
        kind=FinanceAccountKind.BANK,
    )
    payment = create_payment(
        actor=actor,
        reservation_draft=_reservation_draft(),
        payment_kind=PaymentKind.DEPOSIT,
        payment_method=PaymentMethod.BANK_TRANSFER,
        payment_status=PaymentStatus.PENDING,
        amount=Decimal("500000.00"),
        source_label="Client deposit",
    )

    with django_capture_on_commit_callbacks(execute=True):
        result = confirm_payment(payment=payment, actor=actor)

    payment.refresh_from_db()
    receipt_document = result.receipt_document
    receipt_document.refresh_from_db()

    assert payment.payment_status == PaymentStatus.CONFIRMED
    assert payment.receipt_document_id == receipt_document.id
    assert payment.confirmed_by_id == actor.id
    assert payment.paid_at is not None
    assert receipt_document.template_key == "titan.payment_receipt.v1"
    assert receipt_document.status == DocumentInstanceStatus.GENERATED
    assert receipt_document.content_checksum
    assert receipt_document.storage_path.endswith(".html")
    notification = SystemNotification.objects.get(
        notification_type="payment",
        link=f"/payments/{payment.id}",
    )
    assert notification.title == "Paiement confirmé"
    assert notification.severity == "success"
    assert notification.recipient_id == actor.id
    create_payment_confirmation_notification(payment=payment)
    assert SystemNotification.objects.filter(link=f"/payments/{payment.id}").count() == 1

    assert AuditEvent.objects.filter(action="payment.confirmed", target_id=str(payment.id)).exists()
    journal_entry = FinancialJournalEntry.objects.get(payment=payment)
    assert journal_entry.account.kind == FinanceAccountKind.BANK
    assert journal_entry.amount == payment.amount


def test_confirm_cash_reservation_payment_creates_operator_cash_journal_entry(
    django_user_model,
    django_capture_on_commit_callbacks,
) -> None:
    actor = django_user_model.objects.create_user(
        username="payment-cash-journal", password="test-pass", is_staff=True
    )
    payment = create_payment(
        actor=actor,
        reservation_draft=_reservation_draft(),
        payment_kind=PaymentKind.DEPOSIT,
        payment_method=PaymentMethod.CASH,
        payment_status=PaymentStatus.PENDING,
        amount=Decimal("125000.00"),
        source_label="Client deposit",
    )

    with django_capture_on_commit_callbacks(execute=True):
        confirm_payment(payment=payment, actor=actor)

    entry = FinancialJournalEntry.objects.get(payment=payment)
    assert entry.account.business_scope == "titan"
    assert entry.account.kind == FinanceAccountKind.CASH
    assert entry.amount == Decimal("125000.00")
    assert FinanceAccount.objects.filter(code=f"cashbox-titan-{actor.pk}").exists()


def test_cash_payments_use_distinct_operator_accounts_per_business_scope(
    django_user_model,
    django_capture_on_commit_callbacks,
) -> None:
    actor = django_user_model.objects.create_user(
        username="payment-cash-two-scopes", password="test-pass", is_staff=True
    )
    titan_payment = create_payment(
        actor=actor,
        reservation_draft=_reservation_draft(),
        payment_kind=PaymentKind.DEPOSIT,
        payment_method=PaymentMethod.CASH,
        payment_status=PaymentStatus.PENDING,
        amount=Decimal("100000.00"),
        source_label="Titan deposit",
    )
    hahitantsoa_payment = create_payment(
        actor=actor,
        hahitantsoa_event_draft=_hahitantsoa_event_draft(actor=actor),
        payment_kind=PaymentKind.DEPOSIT,
        payment_method=PaymentMethod.CASH,
        payment_status=PaymentStatus.PENDING,
        amount=Decimal("150000.00"),
        source_label="Hahitantsoa deposit",
    )

    with django_capture_on_commit_callbacks(execute=True):
        confirm_payment(payment=titan_payment, actor=actor)
        confirm_payment(payment=hahitantsoa_payment, actor=actor)

    titan_entry = FinancialJournalEntry.objects.get(payment=titan_payment)
    hahitantsoa_entry = FinancialJournalEntry.objects.get(payment=hahitantsoa_payment)
    assert titan_entry.account.business_scope == FinanceBusinessScope.TITAN
    assert hahitantsoa_entry.account.business_scope == FinanceBusinessScope.HAHITANTSOA
    assert titan_entry.account_id != hahitantsoa_entry.account_id


def test_confirm_payment_rolls_back_when_receipt_generation_fails(
    django_user_model,
    monkeypatch,
) -> None:
    actor = django_user_model.objects.create_user(
        username="payment-rollback",
        password="test-pass",
    )
    payment = create_payment(
        actor=actor,
        payment_kind=PaymentKind.DATE_RESERVATION,
        payment_method=PaymentMethod.MOBILE_MONEY,
        payment_status=PaymentStatus.PENDING,
        amount=Decimal("200000.00"),
        source_label="Date reservation",
    )
    before_document_count = DocumentInstance.objects.count()

    def _raise_generation_error(*args, **kwargs):
        raise runtime_module.DocumentRuntimeGenerationError(
            "Receipt generation failed.",
            code="empty_generated_html_content",
        )

    monkeypatch.setattr(
        "apps.payments.services.generate_document_instance_html",
        _raise_generation_error,
    )

    with pytest.raises(runtime_module.DocumentRuntimeGenerationError):
        confirm_payment(payment=payment, actor=actor)

    payment.refresh_from_db()
    assert payment.payment_status == PaymentStatus.PENDING
    assert payment.receipt_document_id is None
    assert DocumentInstance.objects.count() == before_document_count


def test_confirm_payment_rejects_non_pending_state(django_user_model) -> None:
    actor = django_user_model.objects.create_user(username="payment-invalid", password="test-pass")
    payment = create_payment(
        actor=actor,
        payment_kind=PaymentKind.OTHER,
        payment_method=PaymentMethod.OTHER,
        payment_status=PaymentStatus.CANCELLED,
        amount=Decimal("1000.00"),
        source_label="Cancelled source",
    )

    with pytest.raises(PaymentLifecycleError) as error_info:
        confirm_payment(payment=payment, actor=actor)

    assert error_info.value.code == INVALID_PAYMENT_CONFIRMATION_STATE


def test_cancel_payment_transitions_pending_to_cancelled(
    django_user_model,
    django_capture_on_commit_callbacks,
) -> None:
    actor = django_user_model.objects.create_user(
        username="payment-canceller", password="test-pass"
    )
    payment = create_payment(
        actor=actor,
        payment_kind=PaymentKind.OTHER,
        payment_method=PaymentMethod.CASH,
        payment_status=PaymentStatus.PENDING,
        amount=Decimal("100000.00"),
        source_label="Standalone payment",
    )

    with django_capture_on_commit_callbacks(execute=True):
        cancelled = cancel_payment(
            payment=payment,
            actor=actor,
            notes="Customer requested cancellation",
        )

    payment.refresh_from_db()
    assert payment.payment_status == PaymentStatus.CANCELLED
    assert payment.notes == "Customer requested cancellation"
    assert cancelled.payment_status == PaymentStatus.CANCELLED
    assert AuditEvent.objects.filter(action="payment.cancelled", target_id=str(payment.id)).exists()


def test_cancel_payment_rejects_non_pending_state(django_user_model) -> None:
    actor = django_user_model.objects.create_user(
        username="payment-invalid-cancel", password="test-pass"
    )
    payment = create_payment(
        actor=actor,
        payment_kind=PaymentKind.OTHER,
        payment_method=PaymentMethod.CASH,
        payment_status=PaymentStatus.CANCELLED,
        amount=Decimal("1000.00"),
        source_label="Already cancelled",
    )

    with pytest.raises(PaymentLifecycleError) as error_info:
        cancel_payment(payment=payment, actor=actor)

    assert error_info.value.code == INVALID_PAYMENT_CANCEL_STATE


def test_reconcile_payment_transitions_confirmed_to_reconciled(
    django_user_model,
    django_capture_on_commit_callbacks,
) -> None:
    actor = django_user_model.objects.create_user(
        username="payment-reconciler", password="test-pass", is_staff=True
    )
    create_finance_account(
        actor=actor,
        business_scope=FinanceBusinessScope.TITAN,
        code="BANK-TITAN-RECONCILE-TEST",
        label="Titan reconcile test bank",
        kind=FinanceAccountKind.BANK,
    )
    reservation = _reservation_draft()
    payment = create_payment(
        actor=actor,
        reservation_draft=reservation,
        payment_kind=PaymentKind.DEPOSIT,
        payment_method=PaymentMethod.BANK_TRANSFER,
        payment_status=PaymentStatus.PENDING,
        amount=Decimal("500000.00"),
        source_label="Client deposit",
    )

    with django_capture_on_commit_callbacks(execute=True):
        result = confirm_payment(payment=payment, actor=actor)

    confirmed_payment = result.payment

    with django_capture_on_commit_callbacks(execute=True):
        reconciled = reconcile_payment(
            payment=confirmed_payment,
            actor=actor,
            notes="Reconciled after bank statement review",
        )

    confirmed_payment.refresh_from_db()
    assert confirmed_payment.payment_status == PaymentStatus.RECONCILED
    assert confirmed_payment.notes == "Reconciled after bank statement review"
    assert reconciled.payment_status == PaymentStatus.RECONCILED
    assert AuditEvent.objects.filter(
        action="payment.reconciled", target_id=str(confirmed_payment.id)
    ).exists()


def test_reconcile_payment_rejects_non_confirmed_state(django_user_model) -> None:
    actor = django_user_model.objects.create_user(
        username="payment-invalid-reconcile", password="test-pass"
    )
    payment = create_payment(
        actor=actor,
        payment_kind=PaymentKind.OTHER,
        payment_method=PaymentMethod.CASH,
        payment_status=PaymentStatus.PENDING,
        amount=Decimal("1000.00"),
        source_label="Pending payment",
    )

    with pytest.raises(PaymentLifecycleError) as error_info:
        reconcile_payment(payment=payment, actor=actor)

    assert error_info.value.code == INVALID_PAYMENT_RECONCILE_STATE
