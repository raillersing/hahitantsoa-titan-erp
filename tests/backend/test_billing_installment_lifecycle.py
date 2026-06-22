from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone
from tests.backend.test_billing_installments import (
    _confirmed_payment,
    _issued_invoice,
)

from apps.audit.models import AuditEvent
from apps.billing.models import (
    BillingInstallmentStatus,
    BillingInvoiceSourceKind,
    BillingInvoiceStatus,
)
from apps.billing.services import (
    BILLING_INSTALLMENT_INV009_VIOLATION,
    BILLING_INSTALLMENT_LIFECYCLE_OPEN,
    BILLING_INSTALLMENT_LIFECYCLE_OVERDUE,
    BILLING_INSTALLMENT_LIFECYCLE_PAID,
    BILLING_INSTALLMENT_LIFECYCLE_PARTIALLY_PAID,
    BillingInstallmentItem,
    allocate_payment_to_installment,
    billing_installment_due_date_presets,
    compute_billing_invoice_installment_lifecycle,
    create_billing_invoice_installments,
    installment_is_overdue,
    issue_billing_invoice_for_commercial_closeout,
)

pytestmark = pytest.mark.django_db

BILLING_INVOICE_LIST_URL = "/api/v1/billing/invoices/"


def _item(amount, *, due_at):
    return BillingInstallmentItem(amount=Decimal(amount), due_at=due_at)


def _future(days=10):
    return timezone.now() + timedelta(days=days)


def _past(days=10):
    return timezone.now() - timedelta(days=days)


# auto-settlement


def test_auto_settle_when_all_installments_paid(
    django_user_model, django_capture_on_commit_callbacks
) -> None:
    actor, reservation_draft, invoice = _issued_invoice(django_user_model)
    installments = create_billing_invoice_installments(
        invoice=invoice,
        installments=[_item("10000.00", due_at=_future(30)), _item("5000.00", due_at=_future(10))],
        actor=actor,
    )

    with django_capture_on_commit_callbacks(execute=True):
        allocate_payment_to_installment(
            installment=installments[0],
            payment=_confirmed_payment(actor, reservation_draft, Decimal("10000.00")),
            actor=actor,
        )
    invoice.refresh_from_db()
    assert invoice.invoice_status == BillingInvoiceStatus.OPEN

    with django_capture_on_commit_callbacks(execute=True):
        allocate_payment_to_installment(
            installment=installments[1],
            payment=_confirmed_payment(actor, reservation_draft, Decimal("5000.00")),
            actor=actor,
        )
    invoice.refresh_from_db()
    assert invoice.invoice_status == BillingInvoiceStatus.SETTLED
    assert invoice.settled_at is not None
    assert invoice.settled_by_id == actor.id
    assert AuditEvent.objects.filter(
        action="billing.invoice_auto_settled",
        target_id=str(invoice.id),
    ).exists()


def test_no_auto_settle_when_installments_remain_unpaid(django_user_model) -> None:
    actor, reservation_draft, invoice = _issued_invoice(django_user_model)
    installments = create_billing_invoice_installments(
        invoice=invoice,
        installments=[_item("10000.00", due_at=_future(30)), _item("5000.00", due_at=_future(10))],
        actor=actor,
    )
    allocate_payment_to_installment(
        installment=installments[0],
        payment=_confirmed_payment(actor, reservation_draft, Decimal("10000.00")),
        actor=actor,
    )
    invoice.refresh_from_db()
    assert invoice.invoice_status == BillingInvoiceStatus.OPEN
    assert invoice.settled_at is None


# lifecycle read helpers


def test_lifecycle_open_when_schedule_unpaid(django_user_model) -> None:
    actor, _, invoice = _issued_invoice(django_user_model)
    create_billing_invoice_installments(
        invoice=invoice,
        installments=[_item("15000.00", due_at=_future(30))],
        actor=actor,
    )
    assert (
        compute_billing_invoice_installment_lifecycle(invoice) == BILLING_INSTALLMENT_LIFECYCLE_OPEN
    )


def test_lifecycle_partially_paid_when_some_payment_applied(django_user_model) -> None:
    actor, reservation_draft, invoice = _issued_invoice(django_user_model)
    installments = create_billing_invoice_installments(
        invoice=invoice,
        installments=[_item("10000.00", due_at=_future(30)), _item("5000.00", due_at=_future(10))],
        actor=actor,
    )
    allocate_payment_to_installment(
        installment=installments[0],
        payment=_confirmed_payment(actor, reservation_draft, Decimal("4000.00")),
        actor=actor,
    )
    invoice.refresh_from_db()
    assert (
        compute_billing_invoice_installment_lifecycle(invoice)
        == BILLING_INSTALLMENT_LIFECYCLE_PARTIALLY_PAID
    )


def test_lifecycle_paid_when_all_installments_paid(django_user_model) -> None:
    actor, reservation_draft, invoice = _issued_invoice(django_user_model)
    installments = create_billing_invoice_installments(
        invoice=invoice,
        installments=[_item("15000.00", due_at=_future(30))],
        actor=actor,
    )
    allocate_payment_to_installment(
        installment=installments[0],
        payment=_confirmed_payment(actor, reservation_draft, Decimal("15000.00")),
        actor=actor,
    )
    invoice.refresh_from_db()
    assert invoice.invoice_status == BillingInvoiceStatus.SETTLED
    assert (
        compute_billing_invoice_installment_lifecycle(invoice) == BILLING_INSTALLMENT_LIFECYCLE_PAID
    )


def test_lifecycle_overdue_when_installment_past_due_and_unpaid(django_user_model) -> None:
    actor, _, invoice = _issued_invoice(django_user_model)
    installments = create_billing_invoice_installments(
        invoice=invoice,
        installments=[_item("15000.00", due_at=_past(5))],
        actor=actor,
    )
    assert installment_is_overdue(installments[0]) is True
    assert (
        compute_billing_invoice_installment_lifecycle(invoice)
        == BILLING_INSTALLMENT_LIFECYCLE_OVERDUE
    )


def test_lifecycle_overdue_takes_precedence_over_partially_paid(django_user_model) -> None:
    actor, reservation_draft, invoice = _issued_invoice(django_user_model)
    installments = create_billing_invoice_installments(
        invoice=invoice,
        installments=[_item("10000.00", due_at=_past(5)), _item("5000.00", due_at=_future(10))],
        actor=actor,
    )
    allocate_payment_to_installment(
        installment=installments[0],
        payment=_confirmed_payment(actor, reservation_draft, Decimal("4000.00")),
        actor=actor,
    )
    invoice.refresh_from_db()
    assert (
        compute_billing_invoice_installment_lifecycle(invoice)
        == BILLING_INSTALLMENT_LIFECYCLE_OVERDUE
    )


def test_lifecycle_none_when_no_installments(django_user_model) -> None:
    _, _, invoice = _issued_invoice(django_user_model)
    assert compute_billing_invoice_installment_lifecycle(invoice) is None


def test_lifecycle_none_when_invoice_cancelled(django_user_model) -> None:
    from apps.billing.services import cancel_billing_invoice

    actor, _, invoice = _issued_invoice(django_user_model)
    create_billing_invoice_installments(
        invoice=invoice,
        installments=[_item("15000.00", due_at=_past(5))],
        actor=actor,
    )
    cancel_billing_invoice(invoice=invoice, actor=actor)
    invoice.refresh_from_db()
    assert compute_billing_invoice_installment_lifecycle(invoice) is None


def test_installment_is_overdue_false_when_paid(django_user_model) -> None:
    actor, reservation_draft, invoice = _issued_invoice(django_user_model)
    installments = create_billing_invoice_installments(
        invoice=invoice,
        installments=[_item("15000.00", due_at=_past(5))],
        actor=actor,
    )
    allocate_payment_to_installment(
        installment=installments[0],
        payment=_confirmed_payment(actor, reservation_draft, Decimal("15000.00")),
        actor=actor,
    )
    installments[0].refresh_from_db()
    assert installments[0].status == BillingInstallmentStatus.PAID
    assert installment_is_overdue(installments[0]) is False


# J-30 / J-10 presets (read helpers only)


def test_due_date_presets_j30_and_j10():
    start_at = timezone.now()
    presets = billing_installment_due_date_presets(start_at=start_at)
    assert presets.j30 == start_at - timedelta(days=30)
    assert presets.j10 == start_at - timedelta(days=10)


def test_due_date_presets_none_without_start_at():
    assert billing_installment_due_date_presets(start_at=None) is None


# INV-009 installment schedule enforcement


def test_inv009_accepts_valid_commercial_closeout_schedule(
    django_user_model, django_capture_on_commit_callbacks
) -> None:
    from apps.customers.models import Customer
    from apps.reservations.models import ReservationDraft

    start_at = timezone.now() + timedelta(days=60)
    reservation_draft = ReservationDraft.objects.create(
        customer=Customer.objects.create(display_name="INV-009 Valid"),
        start_at=start_at,
        end_at=start_at + timedelta(days=3),
    )

    with django_capture_on_commit_callbacks(execute=True):
        invoice = issue_billing_invoice_for_commercial_closeout(
            reservation_draft=reservation_draft,
            amount=Decimal("10000.00"),
        )

    presets = billing_installment_due_date_presets(start_at=start_at)
    with django_capture_on_commit_callbacks(execute=True):
        installments = create_billing_invoice_installments(
            invoice=invoice,
            installments=[
                _item("5000.00", due_at=presets.j30),
                _item("5000.00", due_at=presets.j10),
            ],
            actor=django_user_model.objects.create_user(
                username="inv009-actor-1", password="test-pass"
            ),
        )

    assert len(installments) == 2
    assert installments[0].amount == Decimal("5000.00")
    assert installments[1].amount == Decimal("5000.00")


def test_inv009_rejects_wrong_due_dates(
    django_user_model, django_capture_on_commit_callbacks
) -> None:
    from apps.customers.models import Customer
    from apps.reservations.models import ReservationDraft

    start_at = timezone.now() + timedelta(days=60)
    reservation_draft = ReservationDraft.objects.create(
        customer=Customer.objects.create(display_name="INV-009 Wrong Dates"),
        start_at=start_at,
        end_at=start_at + timedelta(days=3),
    )

    with django_capture_on_commit_callbacks(execute=True):
        invoice = issue_billing_invoice_for_commercial_closeout(
            reservation_draft=reservation_draft,
            amount=Decimal("10000.00"),
        )

    with pytest.raises(Exception) as error_info:
        create_billing_invoice_installments(
            invoice=invoice,
            installments=[
                _item("5000.00", due_at=timezone.now() + timedelta(days=1)),
                _item("5000.00", due_at=timezone.now() + timedelta(days=15)),
            ],
            actor=django_user_model.objects.create_user(
                username="inv009-actor-2", password="test-pass"
            ),
        )
    assert error_info.value.code == BILLING_INSTALLMENT_INV009_VIOLATION


def test_inv009_rejects_wrong_amount_split(
    django_user_model, django_capture_on_commit_callbacks
) -> None:
    from apps.customers.models import Customer
    from apps.reservations.models import ReservationDraft

    start_at = timezone.now() + timedelta(days=60)
    reservation_draft = ReservationDraft.objects.create(
        customer=Customer.objects.create(display_name="INV-009 Wrong Split"),
        start_at=start_at,
        end_at=start_at + timedelta(days=3),
    )

    with django_capture_on_commit_callbacks(execute=True):
        invoice = issue_billing_invoice_for_commercial_closeout(
            reservation_draft=reservation_draft,
            amount=Decimal("10000.00"),
        )

    presets = billing_installment_due_date_presets(start_at=start_at)
    with pytest.raises(Exception) as error_info:
        create_billing_invoice_installments(
            invoice=invoice,
            installments=[
                _item("7000.00", due_at=presets.j30),
                _item("3000.00", due_at=presets.j10),
            ],
            actor=django_user_model.objects.create_user(
                username="inv009-actor-3", password="test-pass"
            ),
        )
    assert error_info.value.code == BILLING_INSTALLMENT_INV009_VIOLATION


def test_inv009_skipped_for_non_commercial_source_kind(
    django_user_model, django_capture_on_commit_callbacks
) -> None:
    actor, _, invoice = _issued_invoice(django_user_model)
    assert invoice.source_kind != BillingInvoiceSourceKind.COMMERCIAL_CLOSEOUT

    with django_capture_on_commit_callbacks(execute=True):
        installments = create_billing_invoice_installments(
            invoice=invoice,
            installments=[
                _item("10000.00", due_at=_future(30)),
                _item("5000.00", due_at=_future(10)),
            ],
            actor=actor,
        )

    assert len(installments) == 2
    assert installments[0].amount == Decimal("10000.00")
    assert installments[1].amount == Decimal("5000.00")


@pytest.fixture
def authenticated_client(client, django_user_model):
    user = django_user_model.objects.create_user(
        username="lifecycle-api-user", password="test-pass"
    )
    client.force_login(user)
    return client


@pytest.fixture
def sensitive_user(django_user_model):
    return django_user_model.objects.create_user(
        username="lifecycle-sensitive-user", password="test-pass", is_staff=True
    )


@pytest.fixture
def sensitive_client(sensitive_user):
    from django.test import Client

    client = Client()
    client.force_login(sensitive_user)
    return client


def test_invoice_serializer_exposes_overdue_lifecycle_and_due_presets(
    sensitive_client, authenticated_client, django_user_model
):
    actor, _, invoice = _issued_invoice(django_user_model)
    create_billing_invoice_installments(
        invoice=invoice,
        installments=[_item("15000.00", due_at=_past(5))],
        actor=actor,
    )
    detail = authenticated_client.get(f"{BILLING_INVOICE_LIST_URL}{invoice.id}/")
    assert detail.status_code == 200
    payload = detail.json()
    assert payload["installment_lifecycle"] == "overdue"
    assert payload["installments"][0]["is_overdue"] is True
    assert payload["suggested_due_dates"] is not None
    assert "j30" in payload["suggested_due_dates"]
    assert "j10" in payload["suggested_due_dates"]


def test_invoice_serializer_lifecycle_paid_after_full_allocation(
    sensitive_client, authenticated_client, django_user_model
):
    actor, reservation_draft, invoice = _issued_invoice(django_user_model)
    installments = create_billing_invoice_installments(
        invoice=invoice,
        installments=[_item("15000.00", due_at=_future(30))],
        actor=actor,
    )
    payment = _confirmed_payment(actor, reservation_draft, Decimal("15000.00"))
    allocate_response = sensitive_client.post(
        f"/api/v1/billing/installments/{installments[0].id}/allocate/",
        data={"payment": str(payment.id)},
        content_type="application/json",
    )
    assert allocate_response.status_code == 200

    detail = authenticated_client.get(f"{BILLING_INVOICE_LIST_URL}{invoice.id}/")
    assert detail.status_code == 200
    payload = detail.json()
    assert payload["invoice_status"] == "settled"
    assert payload["installment_lifecycle"] == "paid"
    assert payload["installments"][0]["is_overdue"] is False
