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
        username="procurement_test_user", password="test-pass", is_active=True
    )
    client.force_login(user)
    return client


@pytest.fixture
def authenticated_user():
    """Return the User object used by authenticated_client."""
    user, _ = User.objects.get_or_create(
        username="procurement_test_user",
        defaults={"password": "test-pass", "is_active": True},
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
