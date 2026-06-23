from decimal import Decimal

import pytest
from tests.backend.test_inventory_damage_loss_settlement_execution_services import (
    _validated_settlement,
)

from apps.audit.models import AuditEvent
from apps.billing.models import BillingCreditNote, BillingCreditNoteStatus, BillingInvoiceStatus
from apps.billing.services import (
    BILLING_INVOICE_ALREADY_CORRECTED,
    INVALID_BILLING_INVOICE_SOURCE_STATE,
    BillingLifecycleError,
    issue_billing_invoice_for_excess_receivable,
    issue_credit_note,
)
from apps.inventory.services import (
    create_inventory_damage_loss_settlement_execution,
    execute_inventory_damage_loss_settlement_execution,
)

pytestmark = pytest.mark.django_db

CREDIT_NOTE_URL_TEMPLATE = "/api/v1/billing/invoices/{id}/credit-notes/"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _open_invoice(
    django_user_model,
    *,
    caution_amount: Decimal = Decimal("10000.00"),
    unit_amount: Decimal = Decimal("25000.00"),
):
    actor, reservation_draft, settlement = _validated_settlement(
        django_user_model,
        caution_amount=caution_amount,
        unit_amount=unit_amount,
    )
    execution = create_inventory_damage_loss_settlement_execution(
        actor=actor, settlement=settlement
    )
    result = execute_inventory_damage_loss_settlement_execution(execution=execution, actor=actor)
    invoice = issue_billing_invoice_for_excess_receivable(
        excess_receivable=result.excess_receivable, actor=actor
    )
    invoice.refresh_from_db()
    assert invoice.invoice_status == BillingInvoiceStatus.OPEN
    return actor, invoice


@pytest.fixture
def authenticated_client(client, django_user_model):
    user = django_user_model.objects.create_user(
        username="credit-note-user",
        password="test-pass",
    )
    client.force_login(user)
    return client


@pytest.fixture
def sensitive_client(client, django_user_model):
    user = django_user_model.objects.create_user(
        username="credit-note-sensitive",
        password="test-pass",
        is_staff=True,
    )
    client.force_login(user)
    return client


# ---------------------------------------------------------------------------
# Model constraints
# ---------------------------------------------------------------------------


def test_credit_note_amount_must_be_positive(django_user_model) -> None:
    actor, invoice = _open_invoice(django_user_model)
    with pytest.raises(Exception):  # django.db.utils.IntegrityError or ValidationError
        BillingCreditNote.objects.create(
            invoice=invoice,
            amount=Decimal("0.00"),
            reason="Zero amount",
            issued_at="2026-06-22T00:00:00Z",
        )


def test_credit_note_status_markers_consistency(django_user_model) -> None:
    actor, invoice = _open_invoice(django_user_model)
    # applied without applied_at/applied_by should fail at DB level
    with pytest.raises(Exception):
        BillingCreditNote.objects.create(
            invoice=invoice,
            amount=Decimal("100.00"),
            reason="Inconsistent",
            status=BillingCreditNoteStatus.APPLIED,
            issued_at="2026-06-22T00:00:00Z",
        )


# ---------------------------------------------------------------------------
# Service: issue_credit_note
# ---------------------------------------------------------------------------


def test_issue_credit_note_success(django_user_model, django_capture_on_commit_callbacks) -> None:
    actor, invoice = _open_invoice(django_user_model)

    with django_capture_on_commit_callbacks(execute=True):
        credit_note = issue_credit_note(
            invoice=invoice,
            amount=Decimal("5000.00"),
            reason="Partial correction",
            actor=actor,
            notes="Test note",
        )

    assert credit_note.invoice_id == invoice.id
    assert credit_note.amount == Decimal("5000.00")
    assert credit_note.reason == "Partial correction"
    assert credit_note.status == BillingCreditNoteStatus.ISSUED
    assert credit_note.notes == "Test note"
    assert AuditEvent.objects.filter(
        action="billing.credit_note_issued",
        target_id=str(credit_note.id),
    ).exists()


def test_issue_credit_note_rejects_settled_invoice(django_user_model) -> None:
    from apps.billing.services import settle_billing_invoice
    from apps.payments.models import PaymentKind, PaymentMethod, PaymentStatus
    from apps.payments.services import confirm_payment, create_payment

    actor, invoice = _open_invoice(django_user_model)
    payment = create_payment(
        actor=actor,
        reservation_draft=invoice.reservation_draft,
        payment_kind=PaymentKind.BALANCE,
        payment_method=PaymentMethod.BANK_TRANSFER,
        payment_status=PaymentStatus.PENDING,
        amount=invoice.amount,
        source_label="Settle invoice",
    )
    confirm_payment(payment=payment, actor=actor)
    settle_billing_invoice(invoice=invoice, payment=payment, actor=actor)
    invoice.refresh_from_db()
    assert invoice.invoice_status == BillingInvoiceStatus.SETTLED

    with pytest.raises(BillingLifecycleError) as exc_info:
        issue_credit_note(
            invoice=invoice,
            amount=Decimal("1000.00"),
            reason="Should fail",
            actor=actor,
        )
    assert exc_info.value.code == BILLING_INVOICE_ALREADY_CORRECTED


def test_issue_credit_note_rejects_zero_amount(django_user_model) -> None:
    actor, invoice = _open_invoice(django_user_model)
    with pytest.raises(BillingLifecycleError) as exc_info:
        issue_credit_note(
            invoice=invoice,
            amount=Decimal("0.00"),
            reason="Zero",
            actor=actor,
        )
    assert exc_info.value.code == INVALID_BILLING_INVOICE_SOURCE_STATE


def test_issue_credit_note_rejects_amount_exceeding_invoice(django_user_model) -> None:
    actor, invoice = _open_invoice(django_user_model)
    with pytest.raises(BillingLifecycleError) as exc_info:
        issue_credit_note(
            invoice=invoice,
            amount=invoice.amount + Decimal("1.00"),
            reason="Too much",
            actor=actor,
        )
    assert exc_info.value.code == INVALID_BILLING_INVOICE_SOURCE_STATE


# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------


def test_credit_note_post_requires_authentication(client, django_user_model) -> None:
    _, invoice = _open_invoice(django_user_model)
    response = client.post(
        CREDIT_NOTE_URL_TEMPLATE.format(id=invoice.id),
        data={"amount": "5000.00", "reason": "No auth"},
        content_type="application/json",
    )
    assert response.status_code == 403


def test_credit_note_post_requires_sensitive_permission(
    authenticated_client, django_user_model
) -> None:
    _, invoice = _open_invoice(django_user_model)
    response = authenticated_client.post(
        CREDIT_NOTE_URL_TEMPLATE.format(id=invoice.id),
        data={"amount": "5000.00", "reason": "No perm"},
        content_type="application/json",
    )
    assert response.status_code == 403


def test_credit_note_post_success(sensitive_client, django_user_model) -> None:
    _, invoice = _open_invoice(django_user_model)
    response = sensitive_client.post(
        CREDIT_NOTE_URL_TEMPLATE.format(id=invoice.id),
        data={"amount": "5000.00", "reason": "Customer complaint", "notes": "Applied 50%"},
        content_type="application/json",
    )
    assert response.status_code == 201
    data = response.json()
    assert data["amount"] == "5000.00"
    assert data["reason"] == "Customer complaint"
    assert data["notes"] == "Applied 50%"
    assert data["status"] == BillingCreditNoteStatus.ISSUED


def test_credit_note_post_rejects_invalid_invoice(sensitive_client) -> None:
    import uuid

    response = sensitive_client.post(
        CREDIT_NOTE_URL_TEMPLATE.format(id=uuid.uuid4()),
        data={"amount": "5000.00", "reason": "Missing invoice"},
        content_type="application/json",
    )
    assert response.status_code == 404


def test_credit_note_post_rejects_amount_exceeding_invoice(
    sensitive_client, django_user_model
) -> None:
    _, invoice = _open_invoice(django_user_model)
    response = sensitive_client.post(
        CREDIT_NOTE_URL_TEMPLATE.format(id=invoice.id),
        data={"amount": str(invoice.amount + Decimal("1.00")), "reason": "Too much"},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert (
        "amount" in response.json()["detail"].lower()
        or "exceed" in response.json()["detail"].lower()
    )
