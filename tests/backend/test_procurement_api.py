"""Backend API tests for apps.procurement.

Covers list/create for PurchaseOrder and QuickExpense
plus unauthenticated access denial.
"""

from __future__ import annotations

from decimal import Decimal

import pytest
from django.contrib.auth.models import User

from apps.procurement.models import PurchaseOrder, QuickExpense

pytestmark = pytest.mark.django_db

# ---------------------------------------------------------------------------
# URL constants
# ---------------------------------------------------------------------------

PURCHASE_ORDER_LIST_URL = "/api/v1/procurement/purchase-orders/"
EXPENSE_LIST_URL = "/api/v1/procurement/expenses/"

ALL_LIST_URLS = [PURCHASE_ORDER_LIST_URL, EXPENSE_LIST_URL]


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def authenticated_client(client):
    """Return a Django test client force-logged-in as a regular user."""
    user = User.objects.create_user(
        username="procurement_test_user",
        password="test-pass",
        is_active=True,
        is_staff=True,
    )
    client.force_login(user)
    return client


@pytest.fixture
def authenticated_user():
    """Return the User object used by authenticated_client."""
    user, _ = User.objects.get_or_create(
        username="procurement_test_user",
        defaults={"password": "test-pass", "is_active": True, "is_staff": True},
    )
    return user


# ---------------------------------------------------------------------------
# PurchaseOrder
# ---------------------------------------------------------------------------


class TestPurchaseOrderAPI:
    def test_list_purchase_orders_authenticated(self, authenticated_client):
        response = authenticated_client.get(PURCHASE_ORDER_LIST_URL)
        assert response.status_code == 200
        assert response.json() == []

    def test_list_purchase_orders_with_data(self, authenticated_client):
        PurchaseOrder.objects.create(
            supplier_name="Fournisseur A",
            amount=Decimal("100000.00"),
            subject="Bureau supplies",
        )
        response = authenticated_client.get(PURCHASE_ORDER_LIST_URL)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["supplier_name"] == "Fournisseur A"
        assert data[0]["reference"].startswith("BC-")

    def test_create_purchase_order(self, authenticated_client):
        payload = {
            "supplier_name": "Fournisseur B",
            "subject": "Matériel informatique",
            "amount": "250000.00",
            "notes": "Commande urgente",
        }
        response = authenticated_client.post(
            PURCHASE_ORDER_LIST_URL, payload, content_type="application/json"
        )
        assert response.status_code == 201
        data = response.json()
        assert data["supplier_name"] == "Fournisseur B"
        assert data["subject"] == "Matériel informatique"
        assert data["amount"] == "250000.00"
        assert data["status"] == "pending"
        assert data["reference"].startswith("BC-")
        assert PurchaseOrder.objects.count() == 1

    def test_create_purchase_order_minimal(self, authenticated_client):
        """Only supplier_name and amount should be required."""
        payload = {
            "supplier_name": "Minimal Supplier",
            "amount": "50000.00",
        }
        response = authenticated_client.post(
            PURCHASE_ORDER_LIST_URL, payload, content_type="application/json"
        )
        assert response.status_code == 201
        data = response.json()
        assert data["supplier_name"] == "Minimal Supplier"
        assert data["subject"] == ""  # default

    def test_create_purchase_order_negative_amount_rejected(self, authenticated_client):
        payload = {
            "supplier_name": "Negative Supplier",
            "amount": "-500.00",
        }
        response = authenticated_client.post(
            PURCHASE_ORDER_LIST_URL, payload, content_type="application/json"
        )
        assert response.status_code == 400
        assert "amount" in response.json()
        assert PurchaseOrder.objects.count() == 0

    def test_create_purchase_order_zero_amount_rejected(self, authenticated_client):
        payload = {
            "supplier_name": "Zero Supplier",
            "amount": "0.00",
        }
        response = authenticated_client.post(
            PURCHASE_ORDER_LIST_URL, payload, content_type="application/json"
        )
        assert response.status_code == 400
        assert "amount" in response.json()
        assert PurchaseOrder.objects.count() == 0


# ---------------------------------------------------------------------------
# QuickExpense
# ---------------------------------------------------------------------------


class TestQuickExpenseAPI:
    def test_list_expenses_authenticated(self, authenticated_client):
        response = authenticated_client.get(EXPENSE_LIST_URL)
        assert response.status_code == 200
        assert response.json() == []

    def test_list_expenses_with_data(self, authenticated_client):
        user = User.objects.get(username="procurement_test_user")
        QuickExpense.objects.create(
            amount=Decimal("15000.00"),
            category="transport",
            description="Taxi client",
            recorded_by=user,
        )
        response = authenticated_client.get(EXPENSE_LIST_URL)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["category"] == "transport"
        assert data[0]["amount"] == "15000.00"

    def test_create_expense(self, authenticated_client):
        payload = {
            "amount": "25000.00",
            "category": "catering",
            "description": "Déjeuner réunion",
        }
        response = authenticated_client.post(
            EXPENSE_LIST_URL, payload, content_type="application/json"
        )
        assert response.status_code == 201
        data = response.json()
        assert data["amount"] == "25000.00"
        assert data["category"] == "catering"
        assert QuickExpense.objects.count() == 1

    def test_create_expense_minimal(self, authenticated_client):
        """Only amount should be required (category defaults to 'other')."""
        payload = {
            "amount": "5000.00",
        }
        response = authenticated_client.post(
            EXPENSE_LIST_URL, payload, content_type="application/json"
        )
        assert response.status_code == 201
        data = response.json()
        assert data["category"] == "other"
        assert data["description"] == ""

    def test_create_expense_negative_amount_rejected(self, authenticated_client):
        payload = {
            "amount": "-1500.00",
            "category": "transport",
        }
        response = authenticated_client.post(
            EXPENSE_LIST_URL, payload, content_type="application/json"
        )
        assert response.status_code == 400
        assert "amount" in response.json()
        assert QuickExpense.objects.count() == 0

    def test_create_expense_zero_amount_rejected(self, authenticated_client):
        payload = {
            "amount": "0.00",
            "category": "transport",
        }
        response = authenticated_client.post(
            EXPENSE_LIST_URL, payload, content_type="application/json"
        )
        assert response.status_code == 400
        assert "amount" in response.json()
        assert QuickExpense.objects.count() == 0


# ---------------------------------------------------------------------------
# Unauthenticated access
# ---------------------------------------------------------------------------


class TestUnauthenticatedAccess:
    """Anonymous requests must be rejected on all procurement endpoints."""

    @pytest.mark.parametrize("url", ALL_LIST_URLS)
    def test_anonymous_denied(self, client, url):
        response = client.get(url)
        assert response.status_code in (401, 403), (
            f"Anonymous GET to {url} returned {response.status_code}"
        )

    @pytest.mark.parametrize("url", ALL_LIST_URLS)
    def test_anonymous_post_denied(self, client, url):
        response = client.post(url, {}, content_type="application/json")
        assert response.status_code in (401, 403), (
            f"Anonymous POST to {url} returned {response.status_code}"
        )


def test_regular_authenticated_user_cannot_create_purchase_order(client):
    user = User.objects.create_user(username="procurement-read-only", password="test-pass")
    client.force_login(user)
    response = client.post(
        PURCHASE_ORDER_LIST_URL,
        {"supplier_name": "Blocked supplier", "amount": "100.00"},
        content_type="application/json",
    )
    assert response.status_code == 403
    assert PurchaseOrder.objects.count() == 0


@pytest.mark.django_db(transaction=True)
def test_purchase_order_mutations_emit_audit_events(authenticated_client):
    from apps.audit.models import AuditEvent

    # Create
    create_resp = authenticated_client.post(
        PURCHASE_ORDER_LIST_URL,
        {"supplier_name": "Audited Supplier", "amount": "120000.00"},
        content_type="application/json",
    )
    assert create_resp.status_code == 201
    po_id = create_resp.json()["id"]

    assert AuditEvent.objects.filter(
        target_type="purchase_order",
        target_id=po_id,
        action="procurement.purchase_order_created",
    ).exists()

    # Update
    update_resp = authenticated_client.patch(
        f"{PURCHASE_ORDER_LIST_URL}{po_id}/",
        {"supplier_name": "Updated Supplier"},
        content_type="application/json",
    )
    assert update_resp.status_code == 200
    assert AuditEvent.objects.filter(
        target_type="purchase_order",
        target_id=po_id,
        action="procurement.purchase_order_updated",
    ).exists()

    # Delete
    del_resp = authenticated_client.delete(f"{PURCHASE_ORDER_LIST_URL}{po_id}/")
    assert del_resp.status_code == 204
    assert AuditEvent.objects.filter(
        target_type="purchase_order",
        target_id=po_id,
        action="procurement.purchase_order_deleted",
    ).exists()


@pytest.mark.django_db(transaction=True)
def test_quick_expense_mutations_emit_audit_events(authenticated_client):
    from apps.audit.models import AuditEvent

    # Create
    create_resp = authenticated_client.post(
        EXPENSE_LIST_URL,
        {"description": "Carburant", "amount": "50000.00", "category": "transport"},
        content_type="application/json",
    )
    assert create_resp.status_code == 201
    exp_id = create_resp.json()["id"]

    assert AuditEvent.objects.filter(
        target_type="quick_expense",
        target_id=exp_id,
        action="procurement.quick_expense_created",
    ).exists()

    # Delete
    del_resp = authenticated_client.delete(f"{EXPENSE_LIST_URL}{exp_id}/")
    assert del_resp.status_code == 204
    assert AuditEvent.objects.filter(
        target_type="quick_expense",
        target_id=exp_id,
        action="procurement.quick_expense_deleted",
    ).exists()
