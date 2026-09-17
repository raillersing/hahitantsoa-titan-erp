from __future__ import annotations

from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.customers.models import Customer
from apps.documents.models import DocumentInstance
from apps.identity.models import ApplicationRole, UserRoleAssignment
from apps.identity.roles import CompanyRole
from apps.inventory.models import (
    InventoryDamageLossSettlement,
    InventoryDamageLossSettlementLine,
    InventoryItem,
    InventoryReturnOperation,
    InventoryReturnOperationLine,
)
from apps.payments.models import Payment, PaymentKind, PaymentMethod, PaymentStatus
from apps.reservations.models import ReservationDraft

pytestmark = pytest.mark.django_db
User = get_user_model()


@pytest.fixture
def staff_user():
    return User.objects.create_user(username="admin_user", password="password", is_staff=True)


@pytest.fixture
def accountant_user():
    user = User.objects.create_user(username="accountant_user", password="password")
    role, _ = ApplicationRole.objects.get_or_create(
        slug=CompanyRole.ACCOUNTANT.value,
        defaults={"name": "Comptable"},
    )
    UserRoleAssignment.objects.create(user=user, role=role)
    return user


@pytest.fixture
def driver_user():
    user = User.objects.create_user(username="driver_user", password="password")
    role, _ = ApplicationRole.objects.get_or_create(
        slug=CompanyRole.DELIVERY_DRIVER.value,
        defaults={"name": "Livreur"},
    )
    UserRoleAssignment.objects.create(user=user, role=role)
    return user


@pytest.fixture
def sample_customer():
    return Customer.objects.create(
        display_name="Entreprise Alpha SARL",
        nif="2003456789",
        stat="1234567890",
    )


@pytest.fixture
def sample_reservation(sample_customer):
    return ReservationDraft.objects.create(
        customer=sample_customer,
        public_reference="RD-TITAN-EXP-01",
        start_at=timezone.now(),
        end_at=timezone.now() + timezone.timedelta(days=2),
        total_amount=Decimal("1200000.00"),
        subtotal_amount=Decimal("1000000.00"),
        delivery_fee=Decimal("200000.00"),
    )


def test_unauthenticated_requests_denied(client):
    """Unauthenticated requests must be rejected with 401 or 403."""
    urls = [
        "/api/v1/reports/exports/sales/",
        "/api/v1/reports/exports/payments/",
        "/api/v1/reports/exports/cautions/",
        "/api/v1/reports/exports/breakage/",
    ]
    for url in urls:
        response = client.get(url)
        assert response.status_code in (401, 403)


def test_unauthorized_role_denied(client, driver_user):
    """Users without export permissions (e.g. delivery driver) must receive 403."""
    client.force_login(driver_user)
    urls = [
        "/api/v1/reports/exports/sales/",
        "/api/v1/reports/exports/payments/",
        "/api/v1/reports/exports/cautions/",
        "/api/v1/reports/exports/breakage/",
    ]
    for url in urls:
        response = client.get(url)
        assert response.status_code == 403


def test_accountant_can_export_sales_csv_and_json(
    client, accountant_user, sample_reservation, sample_customer
):
    """Accountant can export the sales journal in CSV and JSON formats."""
    # Create an invoice DocumentInstance
    DocumentInstance.objects.create(
        reservation_draft=sample_reservation,
        template_key="titan.invoice.v1",
        document_reference="2026/0001-FA",
        customer_display_name=sample_customer.display_name,
        customer_nif=sample_customer.nif,
        customer_stat=sample_customer.stat,
        reservation_public_reference=sample_reservation.public_reference,
        status="generated",
    )

    client.force_login(accountant_user)

    # Test CSV export
    response = client.get("/api/v1/reports/exports/sales/?format=csv")
    assert response.status_code == 200
    assert "text/csv; charset=utf-8" in response["Content-Type"]
    assert 'attachment; filename="journal-ventes-' in response["Content-Disposition"]

    content = response.content.decode("utf-8")
    assert content.startswith("\ufeff")  # UTF-8 BOM
    assert (
        "N° Facture;Date Facture;Réf. Dossier;Volet;Client;NIF;STAT;"
        "Montant HT (Ar);Taux TVA;Montant TVA (Ar);Montant TTC (Ar);Statut Facture" in content
    )
    assert "2026/0001-FA" in content
    assert "Entreprise Alpha SARL" in content
    assert "1200000,00" in content

    # Test JSON export
    json_response = client.get("/api/v1/reports/exports/sales/?format=json")
    assert json_response.status_code == 200
    data = json_response.json()
    assert data["count"] >= 1
    item = next(r for r in data["results"] if r["reference"] == "2026/0001-FA")
    assert item["customer_name"] == "Entreprise Alpha SARL"
    assert item["scope"] == "Titan"


def test_payments_export_and_filtering(client, accountant_user, sample_reservation):
    """Payment journal exports confirmed and reconciled payments and respects filters."""
    receipt_1 = DocumentInstance.objects.create(
        reservation_draft=sample_reservation,
        template_key="titan.payment_receipt.v1",
        document_reference="REC-2026-0001",
        customer_display_name="Client",
        status="generated",
    )
    receipt_2 = DocumentInstance.objects.create(
        reservation_draft=sample_reservation,
        template_key="titan.payment_receipt.v1",
        document_reference="REC-2026-0002",
        customer_display_name="Client",
        status="generated",
    )
    Payment.objects.create(
        reservation_draft=sample_reservation,
        amount=Decimal("500000.00"),
        payment_kind=PaymentKind.DEPOSIT,
        payment_method=PaymentMethod.CASH,
        payment_status=PaymentStatus.CONFIRMED,
        paid_at=timezone.now(),
        receipt_document=receipt_1,
    )
    Payment.objects.create(
        reservation_draft=sample_reservation,
        amount=Decimal("700000.00"),
        payment_kind=PaymentKind.BALANCE,
        payment_method=PaymentMethod.MVOLA,
        payment_status=PaymentStatus.RECONCILED,
        paid_at=timezone.now(),
        receipt_document=receipt_2,
    )

    client.force_login(accountant_user)

    # All methods
    response = client.get("/api/v1/reports/exports/payments/?format=json")
    assert response.status_code == 200
    data = response.json()
    assert data["count"] >= 2

    # Filter by method
    cash_response = client.get("/api/v1/reports/exports/payments/?format=json&method=cash")
    assert cash_response.status_code == 200
    cash_data = cash_response.json()
    assert all(r["payment_method"] == "CASH" for r in cash_data["results"])

    # Filter by scope
    titan_response = client.get("/api/v1/reports/exports/payments/?format=json&scope=titan")
    assert titan_response.status_code == 200
    assert titan_response.json()["count"] >= 2


def test_cautions_balance_and_breakage_exports(client, staff_user, sample_reservation):
    """Caution balances and breakage register exports reflect damage settlements accurately."""
    inv_item = InventoryItem.objects.create(name="Chaise Banquet Blanche", kind="material")
    ro = InventoryReturnOperation.objects.create(
        reservation_draft=sample_reservation,
        notes="Retour d'inspection",
    )
    ro_line = InventoryReturnOperationLine.objects.create(
        return_operation=ro,
        inventory_item=inv_item,
        expected_quantity=50,
        returned_quantity=48,
        damaged_quantity=2,
        missing_quantity=0,
        condition_status="damaged",
    )
    settlement = InventoryDamageLossSettlement.objects.create(
        return_operation=ro,
        damage_loss_total=Decimal("40000.00"),
        caution_available=Decimal("200000.00"),
        caution_applied=Decimal("40000.00"),
        refund_due=Decimal("160000.00"),
        excess_due=Decimal("0.00"),
        settlement_status="validated",
        validated_at=timezone.now(),
        validated_by=staff_user,
    )
    InventoryDamageLossSettlementLine.objects.create(
        settlement=settlement,
        return_operation_line=ro_line,
        settlement_line_kind="damage",
        quantity=2,
        unit_amount=Decimal("20000.00"),
        total_amount=Decimal("40000.00"),
        manual_label="Chaise Banquet Blanche",
    )

    client.force_login(staff_user)

    # Caution balance export
    caution_resp = client.get("/api/v1/reports/exports/cautions/?format=json")
    assert caution_resp.status_code == 200
    c_data = caution_resp.json()
    assert c_data["count"] >= 1
    c_item = next(r for r in c_data["results"] if r["settlement_id"] == str(settlement.id)[:8])
    assert c_item["caution_available"] == "200000,00"
    assert c_item["caution_applied"] == "40000,00"
    assert c_item["refund_due"] == "160000,00"

    # Breakage register export
    breakage_resp = client.get("/api/v1/reports/exports/breakage/?format=csv")
    assert breakage_resp.status_code == 200
    content = breakage_resp.content.decode("utf-8")
    assert "Chaise Banquet Blanche" in content
    assert "40000,00" in content
