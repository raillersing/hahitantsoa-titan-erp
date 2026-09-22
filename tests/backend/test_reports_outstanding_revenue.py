from __future__ import annotations

from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.billing.models import (
    BillingInstallmentStatus,
    BillingInvoice,
    BillingInvoiceInstallment,
    BillingInvoiceSourceKind,
    BillingInvoiceStatus,
)
from apps.common.reports import calculate_revenue_outstanding
from apps.customers.models import Customer
from apps.identity.models import ApplicationRole, UserRoleAssignment
from apps.identity.roles import CompanyRole
from apps.reservations.models import ReservationDraft

pytestmark = pytest.mark.django_db
User = get_user_model()


@pytest.fixture
def accountant_user():
    user = User.objects.create_user(username="accountant_reports", password="password")
    role, _ = ApplicationRole.objects.get_or_create(
        slug=CompanyRole.ACCOUNTANT.value,
        defaults={"name": "Comptable"},
    )
    UserRoleAssignment.objects.create(user=user, role=role)
    return user


@pytest.fixture
def sample_customer():
    return Customer.objects.create(
        display_name="Client Test Rapports",
        nif="2009876543",
        stat="9876543210",
    )


@pytest.fixture
def sample_reservation(sample_customer):
    return ReservationDraft.objects.create(
        customer=sample_customer,
        public_reference="RD-REP-01",
        start_at=timezone.now(),
        end_at=timezone.now() + timezone.timedelta(days=2),
        total_amount=Decimal("1500000.00"),
    )


def test_revenue_outstanding_full_when_unpaid(sample_reservation):
    """An open invoice without installments reports full remaining balance as outstanding."""
    BillingInvoice.objects.create(
        reservation_draft=sample_reservation,
        source_kind=BillingInvoiceSourceKind.COMMERCIAL_CLOSEOUT,
        invoice_status=BillingInvoiceStatus.OPEN,
        amount=Decimal("1500000.00"),
        issued_at=timezone.now(),
        number="FACT-REP-0001",
    )

    result = calculate_revenue_outstanding("month")
    assert Decimal(str(result["value"])) == Decimal("1500000.00")


def test_revenue_outstanding_deducts_paid_installments(sample_reservation):
    """F15: Outstanding revenue deducts paid installment amounts from invoice balance."""
    inv = BillingInvoice.objects.create(
        reservation_draft=sample_reservation,
        source_kind=BillingInvoiceSourceKind.COMMERCIAL_CLOSEOUT,
        invoice_status=BillingInvoiceStatus.OPEN,
        amount=Decimal("2000000.00"),
        issued_at=timezone.now(),
        number="FACT-REP-0002",
    )
    BillingInvoiceInstallment.objects.create(
        invoice=inv,
        amount=Decimal("1000000.00"),
        paid_amount=Decimal("600000.00"),
        due_at=timezone.now() + timezone.timedelta(days=7),
        status=BillingInstallmentStatus.PARTIALLY_PAID,
    )

    result = calculate_revenue_outstanding("month")
    assert Decimal(str(result["value"])) == Decimal("1400000.00")


def test_revenue_outstanding_excludes_settled_and_cancelled(sample_reservation, accountant_user):
    """Settled and cancelled invoices have remaining balance 0 and do not contribute to revenue."""
    BillingInvoice.objects.create(
        reservation_draft=sample_reservation,
        source_kind=BillingInvoiceSourceKind.COMMERCIAL_CLOSEOUT,
        invoice_status=BillingInvoiceStatus.SETTLED,
        amount=Decimal("1000000.00"),
        issued_at=timezone.now(),
        settled_at=timezone.now(),
        settled_by=accountant_user,
        number="FACT-REP-0003",
    )
    BillingInvoice.objects.create(
        reservation_draft=sample_reservation,
        source_kind=BillingInvoiceSourceKind.COMMERCIAL_CLOSEOUT,
        invoice_status=BillingInvoiceStatus.CANCELLED,
        amount=Decimal("500000.00"),
        issued_at=timezone.now(),
        number="FACT-REP-0004",
    )

    result = calculate_revenue_outstanding("month")
    assert Decimal(str(result["value"])) == Decimal("0.00")


def test_revenue_outstanding_api_endpoint(client, accountant_user, sample_reservation):
    """API endpoint /api/v1/reports/sales_billing/revenue_outstanding/ returns accurate KPI data."""
    inv = BillingInvoice.objects.create(
        reservation_draft=sample_reservation,
        source_kind=BillingInvoiceSourceKind.COMMERCIAL_CLOSEOUT,
        invoice_status=BillingInvoiceStatus.OPEN,
        amount=Decimal("3000000.00"),
        issued_at=timezone.now(),
        number="FACT-REP-0005",
    )
    BillingInvoiceInstallment.objects.create(
        invoice=inv,
        amount=Decimal("1500000.00"),
        paid_amount=Decimal("1500000.00"),
        due_at=timezone.now() - timezone.timedelta(days=1),
        status=BillingInstallmentStatus.PAID,
    )

    client.force_login(accountant_user)
    resp = client.get("/api/v1/reports/sales_billing/revenue_outstanding/?period=month")
    assert resp.status_code == 200
    data = resp.json()
    assert data["kpi"] == "revenue_outstanding"
    assert Decimal(str(data["data"]["value"])) == Decimal("1500000.00")
