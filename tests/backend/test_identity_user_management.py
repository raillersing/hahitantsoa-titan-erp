from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group

from apps.audit.models import AuditEvent
from apps.identity.models import ApplicationRole, UserRoleAssignment
from apps.identity.roles import IdentityRole

pytestmark = pytest.mark.django_db

IDENTITY_USERS_URL = "/api/v1/identity/users/"

User = get_user_model()


@pytest.fixture
def regular_client(client):
    user = User.objects.create_user(username="regular", password="test-password-123")
    client.force_login(user)
    return client


@pytest.fixture
def staff_admin(client):
    user = User.objects.create_user(
        username="staff-admin",
        password="test-password-123",
        is_staff=True,
    )
    return user


@pytest.fixture
def staff_client(client, staff_admin):
    client.force_login(staff_admin)
    return client


@pytest.fixture
def delegated_identity_admin(client):
    user = User.objects.create_user(
        username="delegated-admin",
        password="test-password-123",
    )
    group, _ = Group.objects.get_or_create(name=IdentityRole.IDENTITY_ADMIN.value)
    user.groups.add(group)
    return user


@pytest.fixture
def delegated_client(client, delegated_identity_admin):
    client.force_login(delegated_identity_admin)
    return client


@pytest.fixture
def sample_operational_role():
    return ApplicationRole.objects.create(
        name="Responsable Logistique",
        slug="logistics_manager",
        description="Gestion du parc",
        is_system_managed=False,
        is_active=True,
    )


@pytest.fixture
def sample_system_role():
    return ApplicationRole.objects.create(
        name="reservation_sensitive_operator",
        slug="reservation_sensitive_operator",
        description="Opérateur réservations",
        is_system_managed=True,
        is_active=True,
    )


# ============================================================================
# 1. PERMISSIONS & ACCÈS
# ============================================================================


def test_user_list_create_unauthenticated(client):
    response = client.get(IDENTITY_USERS_URL)
    assert response.status_code in {401, 403}

    response_post = client.post(
        IDENTITY_USERS_URL,
        {
            "username": "newbie",
            "password": "ValidPassword123!",
        },
    )
    assert response_post.status_code in {401, 403}


def test_user_list_create_forbidden_for_regular_user(regular_client):
    response = regular_client.get(IDENTITY_USERS_URL)
    assert response.status_code == 403

    response_post = regular_client.post(
        IDENTITY_USERS_URL,
        {
            "username": "newbie",
            "password": "ValidPassword123!",
        },
    )
    assert response_post.status_code == 403


# ============================================================================
# 2. CRÉATION D'UTILISATEUR (POST /api/v1/identity/users/)
# ============================================================================


def test_create_user_success_as_staff(
    staff_client, sample_operational_role, django_capture_on_commit_callbacks
):
    payload = {
        "username": "jean.dupont",
        "email": "jean.dupont@example.mg",
        "first_name": "Jean",
        "last_name": "Dupont",
        "password": "SecurePassword123!",
        "role_slugs": [sample_operational_role.slug],
    }

    with django_capture_on_commit_callbacks(execute=True):
        response = staff_client.post(IDENTITY_USERS_URL, payload, content_type="application/json")
    assert response.status_code == 201

    data = response.json()
    assert data["username"] == "jean.dupont"
    assert data["email"] == "jean.dupont@example.mg"
    assert data["first_name"] == "Jean"
    assert data["last_name"] == "Dupont"
    assert data["display_name"] == "Jean Dupont"
    assert data["is_active"] is True
    assert sample_operational_role.name in data["role_names"]
    assert sample_operational_role.slug in data["role_slugs"]

    # Verify user exists in database and password is correct
    created_user = User.objects.get(username="jean.dupont")
    assert created_user.check_password("SecurePassword123!")

    # Verify audit event recorded
    audit = AuditEvent.objects.filter(
        action="identity.user_created",
        target_id=str(created_user.pk),
    ).first()
    assert audit is not None
    assert audit.metadata["username"] == "jean.dupont"


def test_create_user_success_as_delegated_identity_admin(delegated_client, sample_operational_role):
    payload = {
        "username": "marie.curie",
        "email": "marie.curie@example.mg",
        "first_name": "Marie",
        "last_name": "Curie",
        "password": "SecurePassword123!",
        "role_slugs": [sample_operational_role.slug],
    }

    response = delegated_client.post(IDENTITY_USERS_URL, payload, content_type="application/json")
    assert response.status_code == 201
    assert User.objects.filter(username="marie.curie").exists()


def test_create_user_with_system_role_forbidden_for_delegated_admin(
    delegated_client, sample_system_role
):
    # System roles can only be assigned by a platform administrator (staff)
    payload = {
        "username": "hacker.wannabe",
        "password": "SecurePassword123!",
        "role_slugs": [sample_system_role.slug],
    }

    response = delegated_client.post(IDENTITY_USERS_URL, payload, content_type="application/json")
    assert response.status_code == 403
    assert not User.objects.filter(username="hacker.wannabe").exists()


def test_create_user_duplicate_username_fails(staff_client):
    User.objects.create_user(username="existing.user", password="InitialPass123!")

    payload = {
        "username": "EXISTING.USER",
        "password": "SecurePassword123!",
    }

    response = staff_client.post(IDENTITY_USERS_URL, payload, content_type="application/json")
    assert response.status_code == 400
    assert "existe déjà" in response.json()["detail"]


def test_create_user_duplicate_email_fails(staff_client):
    User.objects.create_user(
        username="user.alpha",
        email="common@example.com",
        password="InitialPass123!",
    )

    payload = {
        "username": "user.beta",
        "email": "common@example.com",
        "password": "SecurePassword123!",
    }

    response = staff_client.post(IDENTITY_USERS_URL, payload, content_type="application/json")
    assert response.status_code == 400
    assert "existe déjà" in response.json()["detail"]


def test_create_user_invalid_role_fails(staff_client):
    payload = {
        "username": "valid.user",
        "password": "SecurePassword123!",
        "role_slugs": ["non_existent_role_xyz"],
    }

    response = staff_client.post(IDENTITY_USERS_URL, payload, content_type="application/json")
    assert response.status_code == 400
    assert "Rôle introuvable" in response.json()["detail"]
    assert not User.objects.filter(username="valid.user").exists()


# ============================================================================
# 3. MISE À JOUR D'UTILISATEUR (PATCH /api/v1/identity/users/<id>/)
# ============================================================================


def test_update_user_fields_and_roles(staff_client, sample_operational_role):
    target = User.objects.create_user(
        username="target.user",
        email="target@example.mg",
        first_name="Initial",
        last_name="Name",
        password="SecurePassword123!",
    )

    second_role = ApplicationRole.objects.create(
        name="Comptable",
        slug="accountant",
        description="Gestion comptable",
        is_system_managed=False,
        is_active=True,
    )

    # Initial assignment
    UserRoleAssignment.objects.create(
        user=target,
        role=sample_operational_role,
        is_active=True,
    )

    url = f"/api/v1/identity/users/{target.pk}/"

    # Update: change first_name, and replace roles with second_role
    patch_payload = {
        "first_name": "UpdatedFirst",
        "role_slugs": [second_role.slug],
    }

    response = staff_client.patch(url, patch_payload, content_type="application/json")
    assert response.status_code == 200

    data = response.json()
    assert data["first_name"] == "UpdatedFirst"
    assert second_role.slug in data["role_slugs"]
    assert sample_operational_role.slug not in data["role_slugs"]

    # Verify old assignment was revoked and new one assigned
    target.refresh_from_db()
    assert target.first_name == "UpdatedFirst"

    old_assignment = UserRoleAssignment.objects.get(user=target, role=sample_operational_role)
    assert old_assignment.is_active is False
    assert old_assignment.revoked_at is not None

    new_assignment = UserRoleAssignment.objects.get(user=target, role=second_role)
    assert new_assignment.is_active is True


def test_update_user_deactivate_and_self_deactivate_guard(staff_client, staff_admin):
    other = User.objects.create_user(username="other.colleague", password="Pass12345!")

    # Deactivating other user succeeds
    url_other = f"/api/v1/identity/users/{other.pk}/"
    res_other = staff_client.patch(url_other, {"is_active": False}, content_type="application/json")
    assert res_other.status_code == 200
    other.refresh_from_db()
    assert other.is_active is False

    # Deactivating self fails
    url_self = f"/api/v1/identity/users/{staff_admin.pk}/"
    res_self = staff_client.patch(url_self, {"is_active": False}, content_type="application/json")
    assert res_self.status_code == 400
    assert "propre compte" in res_self.json()["detail"]
    staff_admin.refresh_from_db()
    assert staff_admin.is_active is True


# ============================================================================
# 4. RÉINITIALISATION DE MOT DE PASSE (POST /api/v1/identity/users/<id>/reset-password/)
# ============================================================================


def test_reset_user_password_success(staff_client, django_capture_on_commit_callbacks):
    target = User.objects.create_user(username="password.reset.user", password="OldPassword123!")

    url = f"/api/v1/identity/users/{target.pk}/reset-password/"
    payload = {"new_password": "NewBrandSecurePassword999!"}

    with django_capture_on_commit_callbacks(execute=True):
        response = staff_client.post(url, payload, content_type="application/json")
    assert response.status_code == 200
    assert "succès" in response.json()["detail"]

    target.refresh_from_db()
    assert not target.check_password("OldPassword123!")
    assert target.check_password("NewBrandSecurePassword999!")

    # Verify audit event
    audit = AuditEvent.objects.filter(
        action="identity.user_password_reset",
        target_id=str(target.pk),
    ).first()
    assert audit is not None


def test_reset_user_password_not_found(staff_client):
    url = "/api/v1/identity/users/999999/reset-password/"
    payload = {"new_password": "NewBrandSecurePassword999!"}

    response = staff_client.post(url, payload, content_type="application/json")
    assert response.status_code == 404
