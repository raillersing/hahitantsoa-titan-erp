"""Tests for the blacklist API endpoints.

Covers list, create, update, and delete/toggle-active operations on
blacklisted intervenants, plus unauthenticated access denial.
"""

from __future__ import annotations

import pytest

from apps.blacklist.models import BlacklistedIntervenant

pytestmark = pytest.mark.django_db

BLACKLIST_LIST_URL = "/api/v1/blacklist/"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def authenticated_client(client, django_user_model):
    user = django_user_model.objects.create_user(
        username="blacklist-tester",
        password="test-password",
    )
    client.force_login(user)
    return client


def _create_intervenant(
    name: str,
    *,
    note: str = "",
    is_active: bool = True,
) -> BlacklistedIntervenant:
    return BlacklistedIntervenant.objects.create(
        name=name,
        note=note,
        is_active=is_active,
    )


# ---------------------------------------------------------------------------
# Unauthenticated access
# ---------------------------------------------------------------------------


def test_unauthenticated_list_returns_403(client):
    response = client.get(BLACKLIST_LIST_URL)
    assert response.status_code == 403


def test_unauthenticated_create_returns_403(client):
    response = client.post(
        BLACKLIST_LIST_URL,
        {"name": "Blocked Person"},
        content_type="application/json",
    )
    assert response.status_code == 403


def test_unauthenticated_detail_returns_403(client):
    obj = _create_intervenant("Detail Person")
    response = client.get(f"{BLACKLIST_LIST_URL}{obj.id}/")
    assert response.status_code == 403


# ---------------------------------------------------------------------------
# List — only active intervenants
# ---------------------------------------------------------------------------


def test_list_returns_only_active_intervenants(authenticated_client):
    active = _create_intervenant("Active Person")
    _create_intervenant("Inactive Person", is_active=False)

    response = authenticated_client.get(BLACKLIST_LIST_URL)
    assert response.status_code == 200

    payload = response.json()
    assert len(payload) == 1
    assert payload[0]["id"] == str(active.id)
    assert payload[0]["name"] == "Active Person"
    assert payload[0]["is_active"] is True


def test_list_returns_empty_when_no_active_intervenants(authenticated_client):
    _create_intervenant("Gone Person", is_active=False)

    response = authenticated_client.get(BLACKLIST_LIST_URL)
    assert response.status_code == 200
    assert response.json() == []


def test_list_returns_multiple_active_intervenants_ordered_by_name(authenticated_client):
    _create_intervenant("Zoe")
    _create_intervenant("Alice")
    _create_intervenant("Marcus")

    response = authenticated_client.get(BLACKLIST_LIST_URL)
    assert response.status_code == 200

    names = [item["name"] for item in response.json()]
    assert names == ["Alice", "Marcus", "Zoe"]


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------


def test_create_intervenant(authenticated_client):
    payload = {"name": "New Blocked Person", "note": "Reason for ban"}
    response = authenticated_client.post(
        BLACKLIST_LIST_URL, payload, content_type="application/json"
    )
    assert response.status_code == 201

    data = response.json()
    assert data["name"] == "New Blocked Person"
    assert data["note"] == "Reason for ban"
    assert data["is_active"] is True
    assert "id" in data

    assert BlacklistedIntervenant.objects.filter(name="New Blocked Person").exists()


def test_create_intervenant_default_is_active_true(authenticated_client):
    response = authenticated_client.post(
        BLACKLIST_LIST_URL,
        {"name": "Default Active"},
        content_type="application/json",
    )
    assert response.status_code == 201
    assert response.json()["is_active"] is True


def test_create_intervenant_missing_name_returns_400(authenticated_client):
    response = authenticated_client.post(
        BLACKLIST_LIST_URL,
        {"note": "No name provided"},
        content_type="application/json",
    )
    assert response.status_code == 400


# ---------------------------------------------------------------------------
# Retrieve detail
# ---------------------------------------------------------------------------


def test_retrieve_intervenant_detail(authenticated_client):
    obj = _create_intervenant("Detail Person", note="Some note")

    response = authenticated_client.get(f"{BLACKLIST_LIST_URL}{obj.id}/")
    assert response.status_code == 200

    data = response.json()
    assert data["id"] == str(obj.id)
    assert data["name"] == "Detail Person"
    assert data["note"] == "Some note"
    assert data["is_active"] is True
    assert "created_at" in data
    assert "updated_at" in data


def test_retrieve_inactive_intervenant_detail(authenticated_client):
    obj = _create_intervenant("Inactive Person", is_active=False)

    response = authenticated_client.get(f"{BLACKLIST_LIST_URL}{obj.id}/")
    assert response.status_code == 200
    assert response.json()["is_active"] is False


def test_retrieve_nonexistent_returns_404(authenticated_client):
    from uuid import uuid4

    response = authenticated_client.get(f"{BLACKLIST_LIST_URL}{uuid4()}/")
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------


def test_update_intervenant_name(authenticated_client):
    obj = _create_intervenant("Old Name")

    response = authenticated_client.patch(
        f"{BLACKLIST_LIST_URL}{obj.id}/",
        {"name": "New Name"},
        content_type="application/json",
    )
    assert response.status_code == 200
    assert response.json()["name"] == "New Name"

    obj.refresh_from_db()
    assert obj.name == "New Name"


def test_update_intervenant_note(authenticated_client):
    obj = _create_intervenant("Person", note="Old note")

    response = authenticated_client.patch(
        f"{BLACKLIST_LIST_URL}{obj.id}/",
        {"note": "Updated note"},
        content_type="application/json",
    )
    assert response.status_code == 200
    assert response.json()["note"] == "Updated note"


def test_update_intervenant_is_active_toggle(authenticated_client):
    obj = _create_intervenant("Toggle Person", is_active=True)

    response = authenticated_client.patch(
        f"{BLACKLIST_LIST_URL}{obj.id}/",
        {"is_active": False},
        content_type="application/json",
    )
    assert response.status_code == 200
    assert response.json()["is_active"] is False

    obj.refresh_from_db()
    assert obj.is_active is False


# ---------------------------------------------------------------------------
# Delete / toggle active
# ---------------------------------------------------------------------------


def test_delete_intervenant_removes_from_list(authenticated_client):
    obj = _create_intervenant("Delete Me")

    # Verify it appears in list
    list_response = authenticated_client.get(BLACKLIST_LIST_URL)
    assert len(list_response.json()) == 1

    # Delete
    delete_response = authenticated_client.delete(f"{BLACKLIST_LIST_URL}{obj.id}/")
    assert delete_response.status_code == 204

    # Verify it no longer appears in list
    list_response = authenticated_client.get(BLACKLIST_LIST_URL)
    assert len(list_response.json()) == 0

    # DB row should be gone
    assert not BlacklistedIntervenant.objects.filter(id=obj.id).exists()


def test_delete_nonexistent_returns_404(authenticated_client):
    from uuid import uuid4

    response = authenticated_client.delete(f"{BLACKLIST_LIST_URL}{uuid4()}/")
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# Soft-delete via PATCH (toggle is_active off)
# ---------------------------------------------------------------------------


def test_soft_delete_via_patch_deactivates_intervenant(authenticated_client):
    obj = _create_intervenant("Soft Delete Person", is_active=True)

    response = authenticated_client.patch(
        f"{BLACKLIST_LIST_URL}{obj.id}/",
        {"is_active": False},
        content_type="application/json",
    )
    assert response.status_code == 200

    # Should no longer appear in list (only active)
    list_response = authenticated_client.get(BLACKLIST_LIST_URL)
    assert len(list_response.json()) == 0

    # But should still be accessible via detail
    detail_response = authenticated_client.get(f"{BLACKLIST_LIST_URL}{obj.id}/")
    assert detail_response.status_code == 200
    assert detail_response.json()["is_active"] is False
