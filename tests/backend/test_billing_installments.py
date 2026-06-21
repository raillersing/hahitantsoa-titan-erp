from datetime import timedelta
from decimal import Decimal

import pytest
from tests.backend.test_inventory_damage_loss_settlement_execution_services import (
    _validated_settlement,
)

from apps.audit.models import AuditEvent
from apps.billing.models import (
    BillingInstallmentAllocation,
    BillingInstallmentStatus,
    BillingInvoiceInstallment,
    BillingInvoiceStatus,
)
from apps.billing.services import (
    BILLING_INSTALLMENT_ALREADY_PAID,
    BILLING_INSTALLMENT_PAYMENT_ALREADY_USED,
    BILLING_INSTALLMENT_SCHEDULE_EXISTS,
    BILLING_INSTALLMENT_TOTAL_MISMATCH,
    BILLING_INVOICE_HAS_INSTALLMENTS,
    INVALID_BILLING_INSTALLMENT_ALLOCATION,
    INVALID_BILLING_INSTALLMENT_ITEM,
    INVALID_BILLING_INVOICE_STATUS,
    BillingInstallmentItem,
    allocate_payment_to_installment,
    cancel_billing_invoice,
    create_billing_invoice_installments,
    issue_billing_invoice_for_excess_receivable,
    settle_billing_invoice,
)
from apps.inventory.services import (
    create_inventory_damage_loss_settlement_execution,
    execute_inventory_damage_loss_settlement_execution,
)
from apps.payments.models import PaymentKind, PaymentMethod, PaymentStatus
from apps.payments.services import confirm_payment, create_payment

pytestmark = pytest.mark.django_db

BILLING_INVOICE_LIST_URL = "/api/v1/billing/invoices/"


def _issued_invoice(
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
    return actor, reservation_draft, invoice


def _confirmed_payment(actor, reservation_draft, amount, *, source_label="Installment payment"):
    payment = create_payment(
        actor=actor,
        reservation_draft=reservation_draft,
        payment_kind=PaymentKind.BALANCE,
        payment_method=PaymentMethod.BANK_TRANSFER,
        payment_status=PaymentStatus.PENDING,
        amount=amount,
        source_label=source_label,
    )
    return confirm_payment(payment=payment, actor=actor).payment


def _items(*amounts):
    from django.utils import timezone

    base = timezone.now()
    return [
        BillingInstallmentItem(amount=Decimal(a), due_at=base + timedelta(days=i + 1))
        for i, a in enumerate(amounts)
    ]


# schedule creation


def test_create_installment_schedule_creates_installments_matching_invoice_total(
    django_user_model, django_capture_on_commit_callbacks
) -> None:
    actor, _, invoice = _issued_invoice(django_user_model)
    assert invoice.amount == Decimal("15000.00")

    with django_capture_on_commit_callbacks(execute=True):
        installments = create_billing_invoice_installments(
            invoice=invoice,
            installments=_items("10000.00", "5000.00"),
            actor=actor,
            notes="INV-009 schedule",
        )

    assert len(installments) == 2
    assert [i.amount for i in installments] == [Decimal("10000.00"), Decimal("5000.00")]
    assert all(i.status == BillingInstallmentStatus.UNPAID for i in installments)
    assert all(i.paid_amount == Decimal("0.00") for i in installments)
    assert AuditEvent.objects.filter(
        action="billing.installment_schedule_created",
        target_id=str(invoice.id),
    ).exists()


def test_create_installment_schedule_rejects_total_mismatch(django_user_model) -> None:
    actor, _, invoice = _issued_invoice(django_user_model)
    with pytest.raises(Exception) as error_info:
        create_billing_invoice_installments(
            invoice=invoice,
            installments=_items("10000.00", "4000.00"),
            actor=actor,
        )
    assert error_info.value.code == BILLING_INSTALLMENT_TOTAL_MISMATCH
    assert BillingInvoiceInstallment.objects.filter(invoice=invoice).count() == 0


def test_create_installment_schedule_rejects_non_positive_amount(django_user_model) -> None:
    actor, _, invoice = _issued_invoice(django_user_model)
    with pytest.raises(Exception) as error_info:
        create_billing_invoice_installments(
            invoice=invoice,
            installments=_items("0.00", "15000.00"),
            actor=actor,
        )
    assert error_info.value.code == INVALID_BILLING_INSTALLMENT_ITEM


def test_create_installment_schedule_rejects_empty_list(django_user_model) -> None:
    actor, _, invoice = _issued_invoice(django_user_model)
    with pytest.raises(Exception) as error_info:
        create_billing_invoice_installments(invoice=invoice, installments=[], actor=actor)
    assert error_info.value.code == INVALID_BILLING_INSTALLMENT_ITEM


def test_create_installment_schedule_rejects_duplicate_schedule(django_user_model) -> None:
    actor, _, invoice = _issued_invoice(django_user_model)
    create_billing_invoice_installments(
        invoice=invoice, installments=_items("15000.00"), actor=actor
    )
    with pytest.raises(Exception) as error_info:
        create_billing_invoice_installments(
            invoice=invoice, installments=_items("15000.00"), actor=actor
        )
    assert error_info.value.code == BILLING_INSTALLMENT_SCHEDULE_EXISTS


def test_create_installment_schedule_rejects_cancelled_invoice(django_user_model) -> None:
    actor, _, invoice = _issued_invoice(django_user_model)
    cancel_billing_invoice(invoice=invoice, actor=actor)
    with pytest.raises(Exception) as error_info:
        create_billing_invoice_installments(
            invoice=invoice, installments=_items("15000.00"), actor=actor
        )
    assert error_info.value.code == INVALID_BILLING_INVOICE_STATUS


def test_create_installment_schedule_rejects_single_settled_invoice(django_user_model) -> None:
    actor, reservation_draft, invoice = _issued_invoice(django_user_model)
    payment = _confirmed_payment(actor, reservation_draft, invoice.amount)
    settle_billing_invoice(invoice=invoice, payment=payment, actor=actor)
    with pytest.raises(Exception) as error_info:
        create_billing_invoice_installments(
            invoice=invoice, installments=_items("15000.00"), actor=actor
        )
    assert error_info.value.code == INVALID_BILLING_INVOICE_STATUS


# allocation / payment settlement linkage


def test_allocate_payment_partial_then_paid_lifecycle(
    django_user_model, django_capture_on_commit_callbacks
) -> None:
    actor, reservation_draft, invoice = _issued_invoice(django_user_model)
    installments = create_billing_invoice_installments(
        invoice=invoice, installments=_items("10000.00", "5000.00"), actor=actor
    )
    first, second = installments

    with django_capture_on_commit_callbacks(execute=True):
        result_partial = allocate_payment_to_installment(
            installment=first,
            payment=_confirmed_payment(actor, reservation_draft, Decimal("4000.00")),
            actor=actor,
        )
    first.refresh_from_db()
    assert first.status == BillingInstallmentStatus.PARTIALLY_PAID
    assert first.paid_amount == Decimal("4000.00")
    assert result_partial.allocation.amount == Decimal("4000.00")
    assert AuditEvent.objects.filter(
        action="billing.installment_payment_allocated",
        target_id=str(first.id),
    ).exists()

    allocate_payment_to_installment(
        installment=first,
        payment=_confirmed_payment(actor, reservation_draft, Decimal("6000.00")),
        actor=actor,
    )
    first.refresh_from_db()
    assert first.status == BillingInstallmentStatus.PAID
    assert first.paid_amount == Decimal("10000.00")

    allocate_payment_to_installment(
        installment=second,
        payment=_confirmed_payment(actor, reservation_draft, Decimal("5000.00")),
        actor=actor,
    )
    second.refresh_from_db()
    assert second.status == BillingInstallmentStatus.PAID
    assert second.paid_amount == Decimal("5000.00")
    assert BillingInstallmentAllocation.objects.filter(installment=first).count() == 2


def test_allocate_payment_rejects_paid_installment(django_user_model) -> None:
    actor, reservation_draft, invoice = _issued_invoice(django_user_model)
    installments = create_billing_invoice_installments(
        invoice=invoice, installments=_items("5000.00", "10000.00"), actor=actor
    )
    allocate_payment_to_installment(
        installment=installments[0],
        payment=_confirmed_payment(actor, reservation_draft, Decimal("5000.00")),
        actor=actor,
    )
    with pytest.raises(Exception) as error_info:
        allocate_payment_to_installment(
            installment=installments[0],
            payment=_confirmed_payment(actor, reservation_draft, Decimal("1000.00")),
            actor=actor,
        )
    assert error_info.value.code == BILLING_INSTALLMENT_ALREADY_PAID


def test_allocate_payment_rejects_reused_payment(django_user_model) -> None:
    actor, reservation_draft, invoice = _issued_invoice(django_user_model)
    installments = create_billing_invoice_installments(
        invoice=invoice, installments=_items("10000.00", "5000.00"), actor=actor
    )
    payment = _confirmed_payment(actor, reservation_draft, Decimal("4000.00"))
    allocate_payment_to_installment(installment=installments[0], payment=payment, actor=actor)
    with pytest.raises(Exception) as error_info:
        allocate_payment_to_installment(installment=installments[1], payment=payment, actor=actor)
    assert error_info.value.code == BILLING_INSTALLMENT_PAYMENT_ALREADY_USED


def test_allocate_payment_rejects_unconfirmed_payment(django_user_model) -> None:
    actor, reservation_draft, invoice = _issued_invoice(django_user_model)
    installments = create_billing_invoice_installments(
        invoice=invoice, installments=_items("15000.00"), actor=actor
    )
    pending = create_payment(
        actor=actor,
        reservation_draft=reservation_draft,
        payment_kind=PaymentKind.BALANCE,
        payment_method=PaymentMethod.CASH,
        payment_status=PaymentStatus.PENDING,
        amount=Decimal("5000.00"),
        source_label="Pending installment payment",
    )
    with pytest.raises(Exception) as error_info:
        allocate_payment_to_installment(installment=installments[0], payment=pending, actor=actor)
    assert error_info.value.code == INVALID_BILLING_INSTALLMENT_ALLOCATION


def test_allocate_payment_rejects_overpayment(django_user_model) -> None:
    actor, reservation_draft, invoice = _issued_invoice(django_user_model)
    installments = create_billing_invoice_installments(
        invoice=invoice, installments=_items("10000.00", "5000.00"), actor=actor
    )
    with pytest.raises(Exception) as error_info:
        allocate_payment_to_installment(
            installment=installments[0],
            payment=_confirmed_payment(actor, reservation_draft, Decimal("11000.00")),
            actor=actor,
        )
    assert error_info.value.code == INVALID_BILLING_INSTALLMENT_ALLOCATION
    installments[0].refresh_from_db()
    assert installments[0].status == BillingInstallmentStatus.UNPAID


def test_allocate_payment_rejects_reservation_mismatch(django_user_model) -> None:
    actor, _, invoice = _issued_invoice(django_user_model)
    installments = create_billing_invoice_installments(
        invoice=invoice, installments=_items("15000.00"), actor=actor
    )
    external_payment = create_payment(
        actor=actor,
        reservation_draft=None,
        payment_kind=PaymentKind.OTHER,
        payment_method=PaymentMethod.CASH,
        payment_status=PaymentStatus.PENDING,
        amount=Decimal("5000.00"),
        source_label="External payer",
    )
    confirmed_external = confirm_payment(payment=external_payment, actor=actor).payment
    with pytest.raises(Exception) as error_info:
        allocate_payment_to_installment(
            installment=installments[0], payment=confirmed_external, actor=actor
        )
    assert error_info.value.code == INVALID_BILLING_INSTALLMENT_ALLOCATION


def test_allocate_payment_rejects_non_open_invoice(django_user_model) -> None:
    actor, reservation_draft, invoice = _issued_invoice(django_user_model)
    installments = create_billing_invoice_installments(
        invoice=invoice, installments=_items("15000.00"), actor=actor
    )
    cancel_billing_invoice(invoice=invoice, actor=actor)
    with pytest.raises(Exception) as error_info:
        allocate_payment_to_installment(
            installment=installments[0],
            payment=_confirmed_payment(actor, reservation_draft, Decimal("5000.00")),
            actor=actor,
        )
    assert error_info.value.code == INVALID_BILLING_INVOICE_STATUS


def test_settle_billing_invoice_rejects_invoice_with_installments(django_user_model) -> None:
    actor, reservation_draft, invoice = _issued_invoice(django_user_model)
    create_billing_invoice_installments(
        invoice=invoice, installments=_items("15000.00"), actor=actor
    )
    payment = _confirmed_payment(actor, reservation_draft, invoice.amount)
    with pytest.raises(Exception) as error_info:
        settle_billing_invoice(invoice=invoice, payment=payment, actor=actor)
    assert error_info.value.code == BILLING_INVOICE_HAS_INSTALLMENTS
    invoice.refresh_from_db()
    assert invoice.invoice_status == BillingInvoiceStatus.OPEN


# model invariants


def test_installment_clean_rejects_paid_exceeding_amount(django_user_model) -> None:
    from django.core.exceptions import ValidationError

    actor, _, invoice = _issued_invoice(django_user_model)
    installment = BillingInvoiceInstallment(
        invoice=invoice,
        amount=Decimal("1000.00"),
        paid_amount=Decimal("1500.00"),
        due_at=invoice.issued_at,
        status=BillingInstallmentStatus.PARTIALLY_PAID,
        created_by=actor,
        updated_by=actor,
    )
    with pytest.raises(ValidationError) as error_info:
        installment.full_clean()
    assert "paid_amount" in error_info.value.message_dict


def test_installment_clean_rejects_inconsistent_status(django_user_model) -> None:
    from django.core.exceptions import ValidationError

    actor, _, invoice = _issued_invoice(django_user_model)
    installment = BillingInvoiceInstallment(
        invoice=invoice,
        amount=Decimal("1000.00"),
        paid_amount=Decimal("0.00"),
        due_at=invoice.issued_at,
        status=BillingInstallmentStatus.PAID,
        created_by=actor,
        updated_by=actor,
    )
    with pytest.raises(ValidationError) as error_info:
        installment.full_clean()
    assert "status" in error_info.value.message_dict


# API


@pytest.fixture
def authenticated_client(client, django_user_model):
    user = django_user_model.objects.create_user(
        username="installment-api-user", password="test-pass"
    )
    client.force_login(user)
    return client


@pytest.fixture
def sensitive_user(django_user_model):
    return django_user_model.objects.create_user(
        username="installment-sensitive-user", password="test-pass", is_staff=True
    )


@pytest.fixture
def sensitive_client(sensitive_user):
    from django.test import Client

    client = Client()
    client.force_login(sensitive_user)
    return client


def _iso_due_at(days=1):
    from django.utils import timezone

    return (timezone.now() + timedelta(days=days)).isoformat()


def test_create_installments_api_requires_sensitive_access(authenticated_client, django_user_model):
    _, _, invoice = _issued_invoice(django_user_model)
    response = authenticated_client.post(
        f"{BILLING_INVOICE_LIST_URL}{invoice.id}/installments/",
        data={"installments": [{"amount": "15000.00", "due_at": _iso_due_at()}]},
        content_type="application/json",
    )
    assert response.status_code == 403


def test_sensitive_user_can_create_installment_schedule(sensitive_client, django_user_model):
    actor, _, invoice = _issued_invoice(django_user_model)
    response = sensitive_client.post(
        f"{BILLING_INVOICE_LIST_URL}{invoice.id}/installments/",
        data={
            "installments": [
                {"amount": "10000.00", "due_at": _iso_due_at(1)},
                {"amount": "5000.00", "due_at": _iso_due_at(10)},
            ],
            "notes": "INV-009 schedule",
        },
        content_type="application/json",
    )
    assert response.status_code == 201
    payload = response.json()
    assert len(payload) == 2
    assert payload[0]["status"] == "unpaid"
    assert payload[0]["amount"] == "10000.00"
    assert payload[1]["amount"] == "5000.00"


def test_create_installments_api_rejects_total_mismatch(sensitive_client, django_user_model):
    _, _, invoice = _issued_invoice(django_user_model)
    response = sensitive_client.post(
        f"{BILLING_INVOICE_LIST_URL}{invoice.id}/installments/",
        data={"installments": [{"amount": "10000.00", "due_at": _iso_due_at()}]},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert response.json()["code"] == "billing_installment_total_mismatch"


def test_invoice_serializer_exposes_installments(
    sensitive_client, authenticated_client, django_user_model
):
    _, _, invoice = _issued_invoice(django_user_model)
    sensitive_client.post(
        f"{BILLING_INVOICE_LIST_URL}{invoice.id}/installments/",
        data={"installments": [{"amount": "15000.00", "due_at": _iso_due_at()}]},
        content_type="application/json",
    )
    detail = authenticated_client.get(f"{BILLING_INVOICE_LIST_URL}{invoice.id}/")
    assert detail.status_code == 200
    payload = detail.json()
    assert len(payload["installments"]) == 1
    assert payload["installments"][0]["status"] == "unpaid"
    assert payload["installments"][0]["paid_amount"] == "0.00"


def test_allocate_api_requires_sensitive_access(authenticated_client, django_user_model):
    actor, reservation_draft, invoice = _issued_invoice(django_user_model)
    installments = create_billing_invoice_installments(
        invoice=invoice, installments=_items("15000.00"), actor=actor
    )
    payment = _confirmed_payment(actor, reservation_draft, Decimal("5000.00"))
    response = authenticated_client.post(
        f"/api/v1/billing/installments/{installments[0].id}/allocate/",
        data={"payment": str(payment.id)},
        content_type="application/json",
    )
    assert response.status_code == 403


def test_sensitive_user_can_allocate_payment(sensitive_client, django_user_model):
    actor, reservation_draft, invoice = _issued_invoice(django_user_model)
    installments = create_billing_invoice_installments(
        invoice=invoice, installments=_items("10000.00", "5000.00"), actor=actor
    )
    payment = _confirmed_payment(actor, reservation_draft, Decimal("4000.00"))
    response = sensitive_client.post(
        f"/api/v1/billing/installments/{installments[0].id}/allocate/",
        data={"payment": str(payment.id), "notes": "First allocation"},
        content_type="application/json",
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "partially_paid"
    assert payload["paid_amount"] == "4000.00"
    assert len(payload["allocations"]) == 1
    assert payload["allocations"][0]["payment"]["id"] == str(payment.id)


def test_allocate_api_rejects_reused_payment(sensitive_client, django_user_model):
    actor, reservation_draft, invoice = _issued_invoice(django_user_model)
    installments = create_billing_invoice_installments(
        invoice=invoice, installments=_items("10000.00", "5000.00"), actor=actor
    )
    payment = _confirmed_payment(actor, reservation_draft, Decimal("4000.00"))
    first = sensitive_client.post(
        f"/api/v1/billing/installments/{installments[0].id}/allocate/",
        data={"payment": str(payment.id)},
        content_type="application/json",
    )
    assert first.status_code == 200

    second = sensitive_client.post(
        f"/api/v1/billing/installments/{installments[1].id}/allocate/",
        data={"payment": str(payment.id)},
        content_type="application/json",
    )
    assert second.status_code == 400
    assert second.json()["code"] == "billing_installment_payment_already_used"


# cross-path payment-reuse integrity (single settlement <-> installment allocation)


def test_settle_rejects_payment_already_allocated_to_installment(django_user_model) -> None:
    from apps.billing.services import BILLING_SETTLEMENT_PAYMENT_ALREADY_USED

    actor, reservation_draft_a, invoice_a = _issued_invoice(django_user_model)
    _, _, invoice_b = _issued_invoice(
        django_user_model,
        caution_amount=Decimal("20000.00"),
        unit_amount=Decimal("35000.00"),
    )
    installments_a = create_billing_invoice_installments(
        invoice=invoice_a, installments=_items("15000.00"), actor=actor
    )
    payment = _confirmed_payment(actor, reservation_draft_a, Decimal("15000.00"))
    allocate_payment_to_installment(installment=installments_a[0], payment=payment, actor=actor)

    with pytest.raises(Exception) as error_info:
        settle_billing_invoice(invoice=invoice_b, payment=payment, actor=actor)
    assert error_info.value.code == BILLING_SETTLEMENT_PAYMENT_ALREADY_USED
    invoice_b.refresh_from_db()
    assert invoice_b.invoice_status == BillingInvoiceStatus.OPEN


def test_allocate_rejects_payment_already_used_in_single_settlement(django_user_model) -> None:
    actor, reservation_draft_a, invoice_a = _issued_invoice(django_user_model)
    _, _, invoice_b = _issued_invoice(
        django_user_model,
        caution_amount=Decimal("20000.00"),
        unit_amount=Decimal("35000.00"),
    )
    payment = _confirmed_payment(actor, reservation_draft_a, Decimal("15000.00"))
    settle_billing_invoice(invoice=invoice_a, payment=payment, actor=actor)

    installments_b = create_billing_invoice_installments(
        invoice=invoice_b, installments=_items("15000.00"), actor=actor
    )
    with pytest.raises(Exception) as error_info:
        allocate_payment_to_installment(installment=installments_b[0], payment=payment, actor=actor)
    assert error_info.value.code == BILLING_INSTALLMENT_PAYMENT_ALREADY_USED
    installments_b[0].refresh_from_db()
    assert installments_b[0].status == BillingInstallmentStatus.UNPAID
