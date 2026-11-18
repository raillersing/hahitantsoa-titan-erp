import pytest
from django.contrib.auth import get_user_model
from django.test import Client

from apps.audit.models import AuditEvent
from apps.identity.models import ApplicationRole, UserRoleAssignment
from apps.inventory.models import InventoryStorageLocation

User = get_user_model()
pytestmark = pytest.mark.django_db(transaction=True)

STORAGE_LOCATION_URL = "/api/v1/inventory/storage-locations/"


def _create_user_with_role(username: str, role_slug: str | None = None, is_staff: bool = False):
    user = User.objects.create_user(
        username=username,
        email=f"{username}@example.com",
        password="test-password-123",
        is_staff=is_staff,
    )
    if role_slug:
        role, _ = ApplicationRole.objects.get_or_create(
            slug=role_slug,
            defaults={"name": role_slug.replace("_", " ").title()},
        )
        UserRoleAssignment.objects.create(user=user, role=role)
    return user


def test_storage_location_list_requires_authentication(client: Client) -> None:
    response = client.get(STORAGE_LOCATION_URL)
    assert response.status_code in {401, 403}


def test_storage_location_list_accessible_to_any_authenticated_user() -> None:
    user = _create_user_with_role("regular_collaborator")
    client = Client()
    client.force_login(user)

    InventoryStorageLocation.objects.create(name="Allée A", created_by=user)

    response = client.get(STORAGE_LOCATION_URL)
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert any(loc["name"] == "Allée A" for loc in data)


def test_storage_location_create_rejects_unauthorized_user() -> None:
    """User without canManageInventory (e.g. ordinary user or cashbox operator) is rejected."""
    user = _create_user_with_role("cashier", role_slug="cashbox_operator")
    client = Client()
    client.force_login(user)

    response = client.post(
        STORAGE_LOCATION_URL,
        {"name": "Rayon B1"},
        content_type="application/json",
    )
    assert response.status_code == 403
    assert not InventoryStorageLocation.objects.filter(name="Rayon B1").exists()


def test_storage_location_create_authorized_for_storekeeper() -> None:
    """Storekeeper (canManageInventory) is authorized to create a storage location."""
    storekeeper = _create_user_with_role("magasinier_jean", role_slug="storekeeper")
    client = Client()
    client.force_login(storekeeper)

    response = client.post(
        STORAGE_LOCATION_URL,
        {"name": "Rayon C1 - Vaisselle"},
        content_type="application/json",
    )
    assert response.status_code == 201
    created_loc = InventoryStorageLocation.objects.filter(name="Rayon C1 - Vaisselle").first()
    assert created_loc is not None
    assert created_loc.created_by == storekeeper

    audit_event = AuditEvent.objects.filter(
        action="inventory.storage_location_created",
        target_id=str(created_loc.id),
    ).first()
    assert audit_event is not None
    assert audit_event.actor == storekeeper


def test_storage_location_create_authorized_for_logistics_manager() -> None:
    """Logistics manager (canManageInventory) is authorized to create a storage location."""
    logistics = _create_user_with_role("log_mgr", role_slug="logistics_manager")
    client = Client()
    client.force_login(logistics)

    response = client.post(
        STORAGE_LOCATION_URL,
        {"name": "Hangar 2 - Tentes"},
        content_type="application/json",
    )
    assert response.status_code == 201
    assert InventoryStorageLocation.objects.filter(name="Hangar 2 - Tentes").exists()


def test_storage_location_create_authorized_for_owner_manager() -> None:
    """Owner manager (non-staff, has all management capabilities) is authorized."""
    owner = _create_user_with_role("gerant_owner", role_slug="owner_manager")
    client = Client()
    client.force_login(owner)

    response = client.post(
        STORAGE_LOCATION_URL,
        {"name": "Zone VIP - Mobilier"},
        content_type="application/json",
    )
    assert response.status_code == 201
    assert InventoryStorageLocation.objects.filter(name="Zone VIP - Mobilier").exists()
