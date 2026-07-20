"""Backend API tests for apps.hr_payroll.

Covers list/create for Employee, PaySlip, AdvanceRequest, LeaveRequest
plus unauthenticated access denial.
"""

from __future__ import annotations

from decimal import Decimal

import pytest
from django.contrib.auth.models import User

from apps.hr_payroll.models import AdvanceRequest, Employee, LeaveRequest, PaySlip

pytestmark = pytest.mark.django_db

# ---------------------------------------------------------------------------
# URL constants
# ---------------------------------------------------------------------------

EMPLOYEE_LIST_URL = "/api/v1/hr/employees/"
PAYSLIP_LIST_URL = "/api/v1/hr/payslips/"
ADVANCE_LIST_URL = "/api/v1/hr/advances/"
LEAVE_LIST_URL = "/api/v1/hr/leaves/"

ALL_LIST_URLS = [EMPLOYEE_LIST_URL, PAYSLIP_LIST_URL, ADVANCE_LIST_URL, LEAVE_LIST_URL]


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def authenticated_client(client):
    """Return a Django test client force-logged-in as a regular user."""
    user = User.objects.create_user(
        username="hr_test_user", password="test-pass", is_active=True
    )
    client.force_login(user)
    return client


@pytest.fixture
def sample_employee():
    """Create and return a sample Employee for use in child-model tests."""
    return Employee.objects.create(
        first_name="Rakoto",
        last_name="Jean",
        role="Développeur",
        status="active",
        assignment="IT",
        salary=Decimal("1500000.00"),
    )


# ---------------------------------------------------------------------------
# Employee
# ---------------------------------------------------------------------------


class TestEmployeeAPI:
    def test_list_employees_authenticated(self, authenticated_client):
        Employee.objects.create(
            first_name="Ana",
            last_name="Rabe",
            role="Comptable",
            salary=Decimal("1200000.00"),
        )
        response = authenticated_client.get(EMPLOYEE_LIST_URL)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["first_name"] == "Ana"
        assert data[0]["full_name"] == "Ana Rabe"

    def test_list_employees_empty(self, authenticated_client):
        response = authenticated_client.get(EMPLOYEE_LIST_URL)
        assert response.status_code == 200
        assert response.json() == []

    def test_create_employee(self, authenticated_client):
        payload = {
            "first_name": "Hery",
            "last_name": "Rajaonarivony",
            "role": "Chef de projet",
            "status": "active",
            "assignment": "Direction",
            "salary": "2000000.00",
        }
        response = authenticated_client.post(
            EMPLOYEE_LIST_URL, payload, content_type="application/json"
        )
        assert response.status_code == 201
        data = response.json()
        assert data["first_name"] == "Hery"
        assert data["last_name"] == "Rajaonarivony"
        assert data["role"] == "Chef de projet"
        assert Employee.objects.count() == 1

    def test_create_employee_minimal(self, authenticated_client):
        """Only required fields should be enough to create an employee."""
        payload = {
            "first_name": "Minimal",
            "last_name": "User",
            "role": "Agent",
        }
        response = authenticated_client.post(
            EMPLOYEE_LIST_URL, payload, content_type="application/json"
        )
        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "active"  # default


# ---------------------------------------------------------------------------
# PaySlip
# ---------------------------------------------------------------------------


class TestPaySlipAPI:
    def test_list_payslips_authenticated(self, authenticated_client, sample_employee):
        PaySlip.objects.create(
            employee=sample_employee,
            period="2026-07",
            gross_salary=Decimal("1500000.00"),
            deductions=Decimal("200000.00"),
            net_salary=Decimal("1300000.00"),
            status="paid",
        )
        response = authenticated_client.get(PAYSLIP_LIST_URL)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["period"] == "2026-07"
        assert data[0]["employee_name"] == "Rakoto Jean"

    def test_list_payslips_empty(self, authenticated_client):
        response = authenticated_client.get(PAYSLIP_LIST_URL)
        assert response.status_code == 200
        assert response.json() == []

    def test_create_payslip(self, authenticated_client, sample_employee):
        payload = {
            "employee": str(sample_employee.id),
            "period": "2026-07",
            "gross_salary": "1500000.00",
            "deductions": "200000.00",
            "net_salary": "1300000.00",
            "status": "draft",
        }
        response = authenticated_client.post(
            PAYSLIP_LIST_URL, payload, content_type="application/json"
        )
        assert response.status_code == 201
        data = response.json()
        assert data["period"] == "2026-07"
        assert PaySlip.objects.count() == 1


# ---------------------------------------------------------------------------
# AdvanceRequest
# ---------------------------------------------------------------------------


class TestAdvanceRequestAPI:
    def test_list_advances_authenticated(self, authenticated_client, sample_employee):
        AdvanceRequest.objects.create(
            employee=sample_employee,
            amount=Decimal("500000.00"),
            reason="Urgence médicale",
            status="pending",
        )
        response = authenticated_client.get(ADVANCE_LIST_URL)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["amount"] == "500000.00"
        assert data[0]["employee_name"] == "Rakoto Jean"

    def test_list_advances_empty(self, authenticated_client):
        response = authenticated_client.get(ADVANCE_LIST_URL)
        assert response.status_code == 200
        assert response.json() == []

    def test_create_advance_request(self, authenticated_client, sample_employee):
        payload = {
            "employee": str(sample_employee.id),
            "amount": "300000.00",
            "reason": "Frais de scolarité",
        }
        response = authenticated_client.post(
            ADVANCE_LIST_URL, payload, content_type="application/json"
        )
        assert response.status_code == 201
        data = response.json()
        assert data["amount"] == "300000.00"
        assert data["status"] == "pending"
        assert AdvanceRequest.objects.count() == 1


# ---------------------------------------------------------------------------
# LeaveRequest
# ---------------------------------------------------------------------------


class TestLeaveRequestAPI:
    def test_list_leaves_authenticated(self, authenticated_client, sample_employee):
        LeaveRequest.objects.create(
            employee=sample_employee,
            start_date="2026-08-01",
            end_date="2026-08-15",
            reason="Vacances",
            status="approved",
        )
        response = authenticated_client.get(LEAVE_LIST_URL)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["start_date"] == "2026-08-01"
        assert data[0]["employee_name"] == "Rakoto Jean"

    def test_list_leaves_empty(self, authenticated_client):
        response = authenticated_client.get(LEAVE_LIST_URL)
        assert response.status_code == 200
        assert response.json() == []

    def test_create_leave_request(self, authenticated_client, sample_employee):
        payload = {
            "employee": str(sample_employee.id),
            "start_date": "2026-09-01",
            "end_date": "2026-09-10",
            "reason": "Raison personnelle",
        }
        response = authenticated_client.post(
            LEAVE_LIST_URL, payload, content_type="application/json"
        )
        assert response.status_code == 201
        data = response.json()
        assert data["start_date"] == "2026-09-01"
        assert data["end_date"] == "2026-09-10"
        assert data["status"] == "pending"
        assert LeaveRequest.objects.count() == 1


# ---------------------------------------------------------------------------
# Unauthenticated access
# ---------------------------------------------------------------------------


class TestUnauthenticatedAccess:
    """Anonymous requests must be rejected on all HR endpoints."""

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
