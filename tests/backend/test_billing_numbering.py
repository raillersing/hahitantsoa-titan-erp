from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone
from tests.backend.test_billing_installments import _issued_invoice

from apps.billing.models import BillingInvoiceNumberingPolicy, BillingInvoiceSourceKind
from apps.billing.services import assign_invoice_number, execute_commercial_closeout

pytestmark = pytest.mark.django_db


def test_assign_invoice_number_generates_unique_number(django_user_model) -> None:
    actor, reservation_draft, invoice = _issued_invoice(django_user_model)

    assert invoice.number is not None
    assert invoice.number.startswith("FACT-ER-")
    assert str(timezone.now().year) in invoice.number


def test_assign_invoice_number_commercial_closeout(
    django_user_model, django_capture_on_commit_callbacks
) -> None:
    from apps.customers.models import Customer
    from apps.reservations.models import ReservationDraft

    reservation_draft = ReservationDraft.objects.create(
        customer=Customer.objects.create(display_name="Numbering Test"),
        start_at=timezone.now(),
        end_at=timezone.now() + timedelta(days=3),
    )
    with django_capture_on_commit_callbacks(execute=True):
        invoice = execute_commercial_closeout(
            reservation_draft=reservation_draft,
            amount=Decimal("10000.00"),
        )

    assert invoice.number is not None
    assert invoice.number.startswith("FACT-CC-")
    assert str(timezone.now().year) in invoice.number


def test_assign_invoice_number_returns_existing_number(django_user_model) -> None:
    actor, reservation_draft, invoice = _issued_invoice(django_user_model)

    result = assign_invoice_number(invoice=invoice)

    assert result == invoice.number


def test_numbering_policy_created_on_first_use(django_user_model) -> None:
    actor, reservation_draft, invoice = _issued_invoice(django_user_model)

    policy = BillingInvoiceNumberingPolicy.objects.get(
        source_kind=BillingInvoiceSourceKind.INVENTORY_DAMAGE_LOSS_EXCESS_RECEIVABLE,
    )

    assert policy.prefix == "FACT-ER-"
    assert policy.next_number >= 1
    assert policy.fiscal_year == timezone.now().year


def test_fiscal_year_reset_restarts_sequence(django_user_model) -> None:
    actor, reservation_draft, invoice = _issued_invoice(django_user_model)

    policy = BillingInvoiceNumberingPolicy.objects.get(
        source_kind=BillingInvoiceSourceKind.INVENTORY_DAMAGE_LOSS_EXCESS_RECEIVABLE,
    )
    policy.fiscal_year = timezone.now().year - 1
    policy.save(update_fields=["fiscal_year"])

    result = assign_invoice_number(invoice=invoice)

    assert result.endswith("-0001")


def test_separate_sequence_per_source_kind(
    django_user_model, django_capture_on_commit_callbacks
) -> None:
    from apps.customers.models import Customer
    from apps.reservations.models import ReservationDraft

    actor, _, _ = _issued_invoice(django_user_model)

    reservation_draft = ReservationDraft.objects.create(
        customer=Customer.objects.create(display_name="Numbering Seq Test"),
        start_at=timezone.now(),
        end_at=timezone.now() + timedelta(days=3),
    )
    with django_capture_on_commit_callbacks(execute=True):
        execute_commercial_closeout(
            reservation_draft=reservation_draft,
            amount=Decimal("20000.00"),
        )

    assert BillingInvoiceNumberingPolicy.objects.count() == 2
    excess_policy = BillingInvoiceNumberingPolicy.objects.get(
        source_kind=BillingInvoiceSourceKind.INVENTORY_DAMAGE_LOSS_EXCESS_RECEIVABLE,
    )
    closeout_policy = BillingInvoiceNumberingPolicy.objects.get(
        source_kind=BillingInvoiceSourceKind.COMMERCIAL_CLOSEOUT,
    )
    assert excess_policy.next_number >= 1
    assert closeout_policy.next_number >= 1
