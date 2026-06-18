import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group

from apps.identity.models import ApplicationRole, UserRoleAssignment
from apps.identity.roles import IdentityRole

pytestmark = pytest.mark.django_db

IDENTITY_ROLE_LIST_URL = "/api/v1/identity/roles/"
IDENTITY_ASSIGNMENT_LIST_URL = "/api/v1/identity/assignments/"
IDENTITY_ASSIGN_URL = "/api/v1/identity/assignments/assign/"
IDENTITY_SYNC_URL = "/api/v1/identity/roles/sync-system/"

User = get_user_model()


@pytest.fixture
def regular_authenticated_client(client):
    user = User.objects.create_user(username="regular", password="test-pass")
    client.force_login(user)
    return client


@pytest.fixture
def staff_authenticated_client(client):
    user = User.objects.create_user(username="staff", password="test-pass", is_staff=True)
    client.force_login(user)
    return client


@pytest.fixture
def operator_authenticated_client(client):
    user = User.objects.create_user(username="operator", password="test-pass")
    group = Group.objects.create(name=IdentityRole.RESERVATION_SENSITIVE_OPERATOR.value)
    user.groups.add(group)
    client.force_login(user)
    return client


@pytest.fixture
def sample_role():
    return ApplicationRole.objects.create(name="Sample", slug="sample")


# ---- list roles ----


def test_role_list_unauthenticated(client):
    response = client.get(IDENTITY_ROLE_LIST_URL)
    assert response.status_code in {401, 403}


def test_role_list_regular_user_forbidden(regular_authenticated_client):
    response = regular_authenticated_client.get(IDENTITY_ROLE_LIST_URL)
    assert response.status_code == 403


def test_role_list_staff_allowed(staff_authenticated_client):
    response = staff_authenticated_client.get(IDENTITY_ROLE_LIST_URL)
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_role_list_operator_allowed(operator_authenticated_client):
    response = operator_authenticated_client.get(IDENTITY_ROLE_LIST_URL)
    assert response.status_code == 200


# ---- assignment list ----


def test_assignment_list_regular_user_forbidden(regular_authenticated_client):
    response = regular_authenticated_client.get(IDENTITY_ASSIGNMENT_LIST_URL)
    assert response.status_code == 403


def test_assignment_list_staff_allowed(staff_authenticated_client, sample_role):
    user = User.objects.create_user(username="target", password="p")
    UserRoleAssignment.objects.create(user=user, role=sample_role)
    response = staff_authenticated_client.get(IDENTITY_ASSIGNMENT_LIST_URL)
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1


# ---- sync system roles ----


def test_sync_system_roles_unauthenticated(client):
    response = client.post(IDENTITY_SYNC_URL)
    assert response.status_code in {401, 403}


def test_sync_system_roles_regular_forbidden(regular_authenticated_client):
    response = regular_authenticated_client.post(IDENTITY_SYNC_URL)
    assert response.status_code == 403


def test_sync_system_roles_staff_creates_roles(staff_authenticated_client):
    response = staff_authenticated_client.post(IDENTITY_SYNC_URL)
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    slugs = {r["slug"] for r in data}
    assert "reservation_sensitive_operator" in slugs


# ---- assign role ----


def test_assign_role_unauthenticated(client, sample_role):
    payload = {"user_id": str(__import__("uuid").uuid4()), "role_id": str(sample_role.id)}
    response = client.post(IDENTITY_ASSIGN_URL, payload, content_type="application/json")
    assert response.status_code in {401, 403}


def test_assign_role_regular_forbidden(regular_authenticated_client, sample_role):
    target = User.objects.create_user(username="target1", password="p")
    payload = {"user_id": str(target.id), "role_id": str(sample_role.id)}
    response = regular_authenticated_client.post(
        IDENTITY_ASSIGN_URL, payload, content_type="application/json"
    )
    assert response.status_code == 403


def test_assign_role_staff_success(staff_authenticated_client, sample_role):
    target = User.objects.create_user(username="target2", password="p")
    payload = {"user_id": str(target.id), "role_id": str(sample_role.id)}
    response = staff_authenticated_client.post(
        IDENTITY_ASSIGN_URL, payload, content_type="application/json"
    )
    assert response.status_code == 201
    data = response.json()
    assert data["role"]["slug"] == "sample"
    assert data["is_active"] is True


def test_assign_role_duplicate_returns_400(staff_authenticated_client, sample_role):
    target = User.objects.create_user(username="target3", password="p")
    payload = {"user_id": str(target.id), "role_id": str(sample_role.id)}
    staff_authenticated_client.post(IDENTITY_ASSIGN_URL, payload, content_type="application/json")
    response = staff_authenticated_client.post(
        IDENTITY_ASSIGN_URL, payload, content_type="application/json"
    )
    assert response.status_code == 400
    assert "already has an active assignment" in response.json()["detail"]


def test_assign_role_to_inactive_user_returns_400(staff_authenticated_client, sample_role):
    target = User.objects.create_user(username="target4", password="p", is_active=False)
    payload = {"user_id": str(target.id), "role_id": str(sample_role.id)}
    response = staff_authenticated_client.post(
        IDENTITY_ASSIGN_URL, payload, content_type="application/json"
    )
    assert response.status_code == 400
    assert "inactive user" in response.json()["detail"]


# ---- revoke role ----


def test_revoke_role_regular_forbidden(regular_authenticated_client, sample_role):
    target = User.objects.create_user(username="target5", password="p")
    assignment = UserRoleAssignment.objects.create(user=target, role=sample_role)
    url = f"/api/v1/identity/assignments/{assignment.id}/revoke/"
    response = regular_authenticated_client.post(url, {}, content_type="application/json")
    assert response.status_code == 403


def test_revoke_role_staff_success(staff_authenticated_client, sample_role):
    target = User.objects.create_user(username="target6", password="p")
    assignment = UserRoleAssignment.objects.create(user=target, role=sample_role)
    url = f"/api/v1/identity/assignments/{assignment.id}/revoke/"
    response = staff_authenticated_client.post(
        url, {"notes": "removed"}, content_type="application/json"
    )
    assert response.status_code == 200
    data = response.json()
    assert data["is_active"] is False
    assert "removed" in data["notes"]


def test_revoke_system_managed_role_returns_400(staff_authenticated_client):
    sys_role = ApplicationRole.objects.create(name="Sys", slug="sys", is_system_managed=True)
    target = User.objects.create_user(username="target7", password="p")
    assignment = UserRoleAssignment.objects.create(user=target, role=sys_role)
    url = f"/api/v1/identity/assignments/{assignment.id}/revoke/"
    response = staff_authenticated_client.post(url, {}, content_type="application/json")
    assert response.status_code == 400
    assert "System-managed" in response.json()["detail"]


def test_revoke_role_not_found_returns_404(staff_authenticated_client):
    url = f"/api/v1/identity/assignments/{__import__('uuid').uuid4()}/revoke/"
    response = staff_authenticated_client.post(url, {}, content_type="application/json")
    assert response.status_code == 404


def test_revoke_already_revoked_returns_400(staff_authenticated_client, sample_role):
    target = User.objects.create_user(username="target8", password="p")
    assignment = UserRoleAssignment.objects.create(
        user=target,
        role=sample_role,
        is_active=False,
        revoked_at=__import__("django.utils.timezone", fromlist=["timezone"]).now(),
    )
    url = f"/api/v1/identity/assignments/{assignment.id}/revoke/"
    response = staff_authenticated_client.post(url, {}, content_type="application/json")
    assert response.status_code == 400
    assert "already revoked" in response.json()["detail"]
