"""Tests for the material package API endpoints.

Covers list, create, retrieve, update, and delete (soft-delete) operations on
material packages, plus unauthenticated access denial.
"""

from __future__ import annotations

from decimal import Decimal

import pytest

from apps.material_package.models import MaterialPackage

pytestmark = pytest.mark.django_db

MATERIAL_PACKAGE_LIST_URL = "/api/v1/material-packages/"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def authenticated_client(client, django_user_model):
    user = django_user_model.objects.create_user(
        username="material-package-tester",
        password="test-password",
    )
    client.force_login(user)
    return client


def _create_package(
    name: str,
    *,
    description: str = "",
    price: Decimal | float | str = Decimal("0.00"),
    is_active: bool = True,
) -> MaterialPackage:
    return MaterialPackage.objects.create(
        name=name,
        description=description,
        price=price,
        is_active=is_active,
    )


# ---------------------------------------------------------------------------
# Unauthenticated access
# ---------------------------------------------------------------------------


def test_unauthenticated_list_returns_403(client):
    response = client.get(MATERIAL_PACKAGE_LIST_URL)
    assert response.status_code == 403


def test_unauthenticated_create_returns_403(client):
    response = client.post(
        MATERIAL_PACKAGE_LIST_URL,
        {"name": "Test Package"},
        content_type="application/json",
    )
    assert response.status_code == 403


def test_unauthenticated_detail_returns_403(client):
    pkg = _create_package("Detail Package")
    response = client.get(f"{MATERIAL_PACKAGE_LIST_URL}{pkg.id}/")
    assert response.status_code == 403


def test_unauthenticated_update_returns_403(client):
    pkg = _create_package("Update Package")
    response = client.put(
        f"{MATERIAL_PACKAGE_LIST_URL}{pkg.id}/",
        {"name": "Updated"},
        content_type="application/json",
    )
    assert response.status_code == 403


def test_unauthenticated_delete_returns_403(client):
    pkg = _create_package("Delete Package")
    response = client.delete(f"{MATERIAL_PACKAGE_LIST_URL}{pkg.id}/")
    assert response.status_code == 403


# ---------------------------------------------------------------------------
# List — only active packages
# ---------------------------------------------------------------------------


def test_list_returns_only_active_packages(authenticated_client):
    active = _create_package("Active Package")
    _create_package("Inactive Package", is_active=False)

    response = authenticated_client.get(MATERIAL_PACKAGE_LIST_URL)
    assert response.status_code == 200

    payload = response.json()
    assert len(payload) == 1
    assert payload[0]["id"] == str(active.id)
    assert payload[0]["name"] == "Active Package"
    assert payload[0]["is_active"] is True


def test_list_returns_empty_when_no_active_packages(authenticated_client):
    _create_package("Gone Package", is_active=False)

    response = authenticated_client.get(MATERIAL_PACKAGE_LIST_URL)
    assert response.status_code == 200
    assert response.json() == []


def test_list_returns_multiple_active_packages_ordered_by_name(authenticated_client):
    _create_package("Zoe Kit")
    _create_package("Alpha Bundle")
    _create_package("Midrange Set")

    response = authenticated_client.get(MATERIAL_PACKAGE_LIST_URL)
    assert response.status_code == 200

    names = [item["name"] for item in response.json()]
    assert names == ["Alpha Bundle", "Midrange Set", "Zoe Kit"]


def test_list_includes_lines_in_response(authenticated_client):
    """List serializer nests lines (empty by default)."""
    pkg = _create_package("With Lines")

    response = authenticated_client.get(MATERIAL_PACKAGE_LIST_URL)
    assert response.status_code == 200

    data = response.json()[0]
    assert data["id"] == str(pkg.id)
    assert "lines" in data
    assert isinstance(data["lines"], list)


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------


def test_create_package(authenticated_client):
    payload = {
        "name": "New Package",
        "description": "A test bundle",
        "price": "250.00",
    }
    response = authenticated_client.post(
        MATERIAL_PACKAGE_LIST_URL, payload, content_type="application/json"
    )
    assert response.status_code == 201

    data = response.json()
    assert data["name"] == "New Package"
    assert data["description"] == "A test bundle"
    assert Decimal(data["price"]) == Decimal("250.00")
    assert data["is_active"] is True
    assert "id" in data

    assert MaterialPackage.objects.filter(name="New Package").exists()


def test_create_package_default_values(authenticated_client):
    response = authenticated_client.post(
        MATERIAL_PACKAGE_LIST_URL,
        {"name": "Minimal Package"},
        content_type="application/json",
    )
    assert response.status_code == 201
    data = response.json()
    assert data["description"] == ""
    assert Decimal(data["price"]) == Decimal("0.00")
    assert data["is_active"] is True


def test_create_package_missing_name_returns_400(authenticated_client):
    response = authenticated_client.post(
        MATERIAL_PACKAGE_LIST_URL,
        {"description": "No name"},
        content_type="application/json",
    )
    assert response.status_code == 400


# ---------------------------------------------------------------------------
# Retrieve detail
# ---------------------------------------------------------------------------


def test_retrieve_package_detail(authenticated_client):
    pkg = _create_package("Detail Package", description="Some desc", price="99.50")

    response = authenticated_client.get(f"{MATERIAL_PACKAGE_LIST_URL}{pkg.id}/")
    assert response.status_code == 200

    data = response.json()
    assert data["id"] == str(pkg.id)
    assert data["name"] == "Detail Package"
    assert data["description"] == "Some desc"
    assert Decimal(data["price"]) == Decimal("99.50")
    assert data["is_active"] is True
    assert "lines" in data
    assert isinstance(data["lines"], list)
    assert "created_at" in data
    assert "updated_at" in data


def test_retrieve_inactive_package_detail(authenticated_client):
    pkg = _create_package("Inactive Package", is_active=False)

    response = authenticated_client.get(f"{MATERIAL_PACKAGE_LIST_URL}{pkg.id}/")
    assert response.status_code == 200
    assert response.json()["is_active"] is False


def test_retrieve_nonexistent_returns_404(authenticated_client):
    from uuid import uuid4

    response = authenticated_client.get(f"{MATERIAL_PACKAGE_LIST_URL}{uuid4()}/")
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------


def test_update_package_name(authenticated_client):
    pkg = _create_package("Old Name")

    response = authenticated_client.patch(
        f"{MATERIAL_PACKAGE_LIST_URL}{pkg.id}/",
        {"name": "Updated Name"},
        content_type="application/json",
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Updated Name"

    pkg.refresh_from_db()
    assert pkg.name == "Updated Name"


def test_update_package_price(authenticated_client):
    pkg = _create_package("Price Package", price="100.00")

    response = authenticated_client.put(
        f"{MATERIAL_PACKAGE_LIST_URL}{pkg.id}/",
        {"name": "Price Package", "price": "199.99"},
        content_type="application/json",
    )
    assert response.status_code == 200
    assert Decimal(response.json()["price"]) == Decimal("199.99")

    pkg.refresh_from_db()
    assert pkg.price == Decimal("199.99")


def test_update_package_description(authenticated_client):
    pkg = _create_package("Desc Package", description="Old")

    response = authenticated_client.patch(
        f"{MATERIAL_PACKAGE_LIST_URL}{pkg.id}/",
        {"description": "New description"},
        content_type="application/json",
    )
    assert response.status_code == 200
    assert response.json()["description"] == "New description"


def test_update_nonexistent_returns_404(authenticated_client):
    from uuid import uuid4

    response = authenticated_client.put(
        f"{MATERIAL_PACKAGE_LIST_URL}{uuid4()}/",
        {"name": "Ghost"},
        content_type="application/json",
    )
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# Delete (soft-delete)
# ---------------------------------------------------------------------------


def test_delete_package_soft_deletes(authenticated_client):
    pkg = _create_package("Delete Me", is_active=True)

    response = authenticated_client.delete(f"{MATERIAL_PACKAGE_LIST_URL}{pkg.id}/")
    assert response.status_code == 204

    pkg.refresh_from_db()
    assert pkg.is_active is False

    # Should no longer appear in list
    list_response = authenticated_client.get(MATERIAL_PACKAGE_LIST_URL)
    assert len(list_response.json()) == 0


def test_delete_package_still_accessible_via_detail(authenticated_client):
    pkg = _create_package("Soft Deleted")

    delete_response = authenticated_client.delete(f"{MATERIAL_PACKAGE_LIST_URL}{pkg.id}/")
    assert delete_response.status_code == 204

    detail_response = authenticated_client.get(f"{MATERIAL_PACKAGE_LIST_URL}{pkg.id}/")
    assert detail_response.status_code == 200
    assert detail_response.json()["is_active"] is False


def test_delete_nonexistent_returns_404(authenticated_client):
    from uuid import uuid4

    response = authenticated_client.delete(f"{MATERIAL_PACKAGE_LIST_URL}{uuid4()}/")
    assert response.status_code == 404
