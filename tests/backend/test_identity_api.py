from datetime import UTC, datetime

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
def inactive_staff_authenticated_client(client):
    user = User.objects.create_user(
        username="inactive-staff",
        password="test-pass",
        is_staff=True,
        is_active=False,
    )
    client.force_login(user, backend="django.contrib.auth.backends.ModelBackend")
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


def test_role_list_inactive_staff_forbidden(inactive_staff_authenticated_client):
    response = inactive_staff_authenticated_client.get(IDENTITY_ROLE_LIST_URL)
    assert response.status_code in {401, 403}


def test_role_list_operator_forbidden(operator_authenticated_client):
    response = operator_authenticated_client.get(IDENTITY_ROLE_LIST_URL)
    assert response.status_code == 403


def test_role_list_filters_by_name_and_system_flags(staff_authenticated_client):
    active_system = ApplicationRole.objects.create(
        name="Accounting Lead",
        slug="accounting-lead",
        is_system_managed=True,
        is_active=True,
    )
    ApplicationRole.objects.create(
        name="Archive Clerk",
        slug="archive-clerk",
        is_system_managed=False,
        is_active=True,
    )
    ApplicationRole.objects.create(
        name="Dormant Reviewer",
        slug="dormant-reviewer",
        is_system_managed=False,
        is_active=False,
    )

    response = staff_authenticated_client.get(
        IDENTITY_ROLE_LIST_URL,
        {"name": "Accounting", "is_system_managed": "true", "is_active": "true"},
    )

    assert response.status_code == 200
    data = response.json()
    assert [row["slug"] for row in data] == [active_system.slug]


def test_role_list_can_include_inactive_roles_when_requested(staff_authenticated_client):
    ApplicationRole.objects.create(
        name="Inactive Role",
        slug="inactive-role",
        is_active=False,
    )

    response = staff_authenticated_client.get(
        IDENTITY_ROLE_LIST_URL,
        {"is_active": "false"},
    )

    assert response.status_code == 200
    data = response.json()
    assert {row["slug"] for row in data} == {"inactive-role"}


# ---- role CRUD ----


def test_role_create_unauthenticated(client):
    payload = {"name": "New Role", "slug": "new-role"}
    response = client.post(IDENTITY_ROLE_LIST_URL, payload, content_type="application/json")
    assert response.status_code in {401, 403}


def test_role_create_regular_forbidden(regular_authenticated_client):
    payload = {"name": "New Role", "slug": "new-role"}
    response = regular_authenticated_client.post(
        IDENTITY_ROLE_LIST_URL, payload, content_type="application/json"
    )
    assert response.status_code == 403


def test_role_create_staff_success(staff_authenticated_client):
    payload = {
        "name": "Custom Inspector",
        "slug": "custom-inspector",
        "description": "Inspects items",
    }
    response = staff_authenticated_client.post(
        IDENTITY_ROLE_LIST_URL, payload, content_type="application/json"
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Custom Inspector"
    assert data["slug"] == "custom-inspector"
    assert data["description"] == "Inspects items"
    assert data["is_system_managed"] is False
    assert data["is_active"] is True


def test_role_create_duplicate_slug_returns_400(staff_authenticated_client):
    ApplicationRole.objects.create(name="Existing", slug="existing")
    payload = {"name": "Duplicate", "slug": "existing"}
    response = staff_authenticated_client.post(
        IDENTITY_ROLE_LIST_URL, payload, content_type="application/json"
    )
    assert response.status_code == 400


def test_role_detail_get_returns_role(staff_authenticated_client):
    role = ApplicationRole.objects.create(name="Detail Role", slug="detail-role")
    url = f"/api/v1/identity/roles/{role.id}/"
    response = staff_authenticated_client.get(url)
    assert response.status_code == 200
    assert response.json()["slug"] == "detail-role"


def test_role_detail_get_not_found(staff_authenticated_client):
    url = f"/api/v1/identity/roles/{__import__('uuid').uuid4()}/"
    response = staff_authenticated_client.get(url)
    assert response.status_code == 404


def test_role_update_staff_success(staff_authenticated_client):
    role = ApplicationRole.objects.create(name="Old Name", slug="old-name")
    url = f"/api/v1/identity/roles/{role.id}/"
    payload = {"name": "Updated Name", "slug": "updated-name", "description": "Updated desc"}
    response = staff_authenticated_client.put(url, payload, content_type="application/json")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Updated Name"
    assert data["slug"] == "updated-name"
    assert data["description"] == "Updated desc"


def test_role_partial_update_staff_success(staff_authenticated_client):
    role = ApplicationRole.objects.create(
        name="Partial Role", slug="partial-role", description="Original"
    )
    url = f"/api/v1/identity/roles/{role.id}/"
    response = staff_authenticated_client.patch(
        url, {"description": "Patched"}, content_type="application/json"
    )
    assert response.status_code == 200
    assert response.json()["description"] == "Patched"


def test_role_delete_custom_role_success(staff_authenticated_client):
    role = ApplicationRole.objects.create(name="Custom", slug="custom-role")
    url = f"/api/v1/identity/roles/{role.id}/"
    response = staff_authenticated_client.delete(url)
    assert response.status_code == 204
    assert not ApplicationRole.objects.filter(id=role.id).exists()


def test_role_delete_system_managed_returns_400(staff_authenticated_client):
    role = ApplicationRole.objects.create(name="System", slug="system-role", is_system_managed=True)
    url = f"/api/v1/identity/roles/{role.id}/"
    response = staff_authenticated_client.delete(url)
    assert response.status_code == 400
    assert "System-managed" in response.json()["detail"]
    assert ApplicationRole.objects.filter(id=role.id).exists()


# ---- assignment list ----


def test_assignment_list_regular_user_forbidden(regular_authenticated_client):
    response = regular_authenticated_client.get(IDENTITY_ASSIGNMENT_LIST_URL)
    assert response.status_code == 403


def test_assignment_list_staff_allowed(staff_authenticated_client, sample_role):
    user = User.objects.create_user(username="target", password="p")
    first = UserRoleAssignment.objects.create(user=user, role=sample_role)
    UserRoleAssignment.objects.filter(id=first.id).update(
        assigned_at=datetime(2026, 1, 1, 10, 0, tzinfo=UTC)
    )
    second_role = ApplicationRole.objects.create(name="Second", slug="second")
    second = UserRoleAssignment.objects.create(user=user, role=second_role)
    UserRoleAssignment.objects.filter(id=second.id).update(
        assigned_at=datetime(2026, 1, 3, 10, 0, tzinfo=UTC)
    )
    response = staff_authenticated_client.get(IDENTITY_ASSIGNMENT_LIST_URL)
    assert response.status_code == 200
    data = response.json()
    assert {row["id"] for row in data} >= {str(first.id), str(second.id)}


def test_assignment_list_filters_by_role_and_date_range(staff_authenticated_client):
    user = User.objects.create_user(username="target-filter", password="p")
    other_user = User.objects.create_user(username="target-filter-2", password="p")
    role_a = ApplicationRole.objects.create(name="Role A", slug="role-a")
    role_b = ApplicationRole.objects.create(name="Role B", slug="role-b")
    early = UserRoleAssignment.objects.create(user=user, role=role_a)
    UserRoleAssignment.objects.filter(id=early.id).update(
        assigned_at=datetime(2026, 1, 1, 9, 0, tzinfo=UTC)
    )
    middle = UserRoleAssignment.objects.create(user=user, role=role_b)
    UserRoleAssignment.objects.filter(id=middle.id).update(
        assigned_at=datetime(2026, 1, 2, 9, 0, tzinfo=UTC)
    )
    late = UserRoleAssignment.objects.create(user=other_user, role=role_a)
    UserRoleAssignment.objects.filter(id=late.id).update(
        assigned_at=datetime(2026, 1, 4, 9, 0, tzinfo=UTC)
    )

    response = staff_authenticated_client.get(
        IDENTITY_ASSIGNMENT_LIST_URL,
        {
            "role_id": str(role_b.id),
            "assigned_after": "2026-01-01T12:00:00Z",
            "assigned_before": "2026-01-03T12:00:00Z",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert [row["id"] for row in data] == [str(middle.id)]
    assert str(early.id) not in {row["id"] for row in data}


def test_assignment_list_filters_by_user_and_active_flag(staff_authenticated_client):
    active_user = User.objects.create_user(username="active-filter", password="p")
    inactive_user = User.objects.create_user(username="inactive-filter", password="p")
    role = ApplicationRole.objects.create(name="Filter Role", slug="filter-role")
    active_assignment = UserRoleAssignment.objects.create(user=active_user, role=role)
    inactive_assignment = UserRoleAssignment.objects.create(user=inactive_user, role=role)
    UserRoleAssignment.objects.filter(id=inactive_assignment.id).update(is_active=False)

    response = staff_authenticated_client.get(
        IDENTITY_ASSIGNMENT_LIST_URL,
        {
            "user_id": str(inactive_user.id),
            "is_active": "false",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert [row["id"] for row in data] == [str(inactive_assignment.id)]
    assert str(active_assignment.id) not in {row["id"] for row in data}


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


def test_assign_inactive_role_returns_400_without_assignment(staff_authenticated_client):
    target = User.objects.create_user(username="inactive-role-target", password="p")
    role = ApplicationRole.objects.create(
        name="Inactive assignment role",
        slug="inactive-assignment-role",
        is_active=False,
    )
    payload = {"user_id": str(target.id), "role_id": str(role.id)}

    response = staff_authenticated_client.post(
        IDENTITY_ASSIGN_URL,
        payload,
        content_type="application/json",
    )

    assert response.status_code == 400
    assert response.json()["code"] == "role_inactive"
    assert not UserRoleAssignment.objects.filter(user=target, role=role).exists()


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


def test_revoke_system_managed_role_assignment_succeeds(staff_authenticated_client):
    sys_role = ApplicationRole.objects.create(name="Sys", slug="sys", is_system_managed=True)
    target = User.objects.create_user(username="target7", password="p")
    assignment = UserRoleAssignment.objects.create(user=target, role=sys_role)
    url = f"/api/v1/identity/assignments/{assignment.id}/revoke/"
    response = staff_authenticated_client.post(url, {}, content_type="application/json")
    assert response.status_code == 200
    assert response.json()["is_active"] is False


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


# ---- assignment detail / update / delete ----


IDENTITY_ASSIGNMENT_DETAIL = "/api/v1/identity/assignments/{id}/"


def test_assignment_detail_get_returns_assignment(staff_authenticated_client, sample_role):
    target = User.objects.create_user(username="detail-target", password="p")
    assignment = UserRoleAssignment.objects.create(user=target, role=sample_role)
    url = IDENTITY_ASSIGNMENT_DETAIL.format(id=assignment.id)
    response = staff_authenticated_client.get(url)
    assert response.status_code == 200
    data = response.json()
    assert data["role"]["slug"] == "sample"
    assert data["is_active"] is True
    assert data["user_id"] == target.id


def test_assignment_detail_get_regular_forbidden(regular_authenticated_client, sample_role):
    target = User.objects.create_user(username="detail-target-2", password="p")
    assignment = UserRoleAssignment.objects.create(user=target, role=sample_role)
    url = IDENTITY_ASSIGNMENT_DETAIL.format(id=assignment.id)
    response = regular_authenticated_client.get(url)
    assert response.status_code == 403


def test_assignment_detail_get_not_found(staff_authenticated_client):
    url = IDENTITY_ASSIGNMENT_DETAIL.format(id=__import__("uuid").uuid4())
    response = staff_authenticated_client.get(url)
    assert response.status_code == 404


def test_assignment_detail_get_unauthenticated(client, sample_role):
    target = User.objects.create_user(username="detail-target-3", password="p")
    assignment = UserRoleAssignment.objects.create(user=target, role=sample_role)
    url = IDENTITY_ASSIGNMENT_DETAIL.format(id=assignment.id)
    response = client.get(url)
    assert response.status_code in {401, 403}


def test_assignment_patch_notes_staff_success(staff_authenticated_client, sample_role):
    target = User.objects.create_user(username="patch-target", password="p")
    assignment = UserRoleAssignment.objects.create(user=target, role=sample_role)
    url = IDENTITY_ASSIGNMENT_DETAIL.format(id=assignment.id)
    response = staff_authenticated_client.patch(
        url, {"notes": "Updated notes"}, content_type="application/json"
    )
    assert response.status_code == 200
    data = response.json()
    assert data["notes"] == "Updated notes"
    assert data["is_active"] is True


def test_assignment_patch_notes_regular_forbidden(regular_authenticated_client, sample_role):
    target = User.objects.create_user(username="patch-target-2", password="p")
    assignment = UserRoleAssignment.objects.create(user=target, role=sample_role)
    url = IDENTITY_ASSIGNMENT_DETAIL.format(id=assignment.id)
    response = regular_authenticated_client.patch(
        url, {"notes": "Hacked"}, content_type="application/json"
    )
    assert response.status_code == 403


def test_assignment_patch_notes_unauthenticated(client, sample_role):
    target = User.objects.create_user(username="patch-target-3", password="p")
    assignment = UserRoleAssignment.objects.create(user=target, role=sample_role)
    url = IDENTITY_ASSIGNMENT_DETAIL.format(id=assignment.id)
    response = client.patch(url, {"notes": "Hacked"}, content_type="application/json")
    assert response.status_code in {401, 403}


def test_assignment_delete_revokes_assignment(staff_authenticated_client, sample_role):
    target = User.objects.create_user(username="delete-target", password="p")
    assignment = UserRoleAssignment.objects.create(user=target, role=sample_role)
    url = IDENTITY_ASSIGNMENT_DETAIL.format(id=assignment.id)
    response = staff_authenticated_client.delete(url)
    assert response.status_code == 200
    data = response.json()
    assert data["is_active"] is False
    assert data["revoked_at"] is not None


def test_assignment_delete_regular_forbidden(regular_authenticated_client, sample_role):
    target = User.objects.create_user(username="delete-target-2", password="p")
    assignment = UserRoleAssignment.objects.create(user=target, role=sample_role)
    url = IDENTITY_ASSIGNMENT_DETAIL.format(id=assignment.id)
    response = regular_authenticated_client.delete(url)
    assert response.status_code == 403


def test_assignment_delete_unauthenticated(client, sample_role):
    target = User.objects.create_user(username="delete-target-3", password="p")
    assignment = UserRoleAssignment.objects.create(user=target, role=sample_role)
    url = IDENTITY_ASSIGNMENT_DETAIL.format(id=assignment.id)
    response = client.delete(url)
    assert response.status_code in {401, 403}


def test_assignment_delete_system_managed_assignment_succeeds(staff_authenticated_client):
    sys_role = ApplicationRole.objects.create(name="SysDel", slug="sys-del", is_system_managed=True)
    target = User.objects.create_user(username="delete-target-4", password="p")
    assignment = UserRoleAssignment.objects.create(user=target, role=sys_role)
    url = IDENTITY_ASSIGNMENT_DETAIL.format(id=assignment.id)
    response = staff_authenticated_client.delete(url)
    assert response.status_code == 200
    assert response.json()["is_active"] is False


def test_assignment_delete_not_found_returns_404(staff_authenticated_client):
    url = IDENTITY_ASSIGNMENT_DETAIL.format(id=__import__("uuid").uuid4())
    response = staff_authenticated_client.delete(url)
    assert response.status_code == 404


def test_assignment_delete_already_revoked_returns_400(staff_authenticated_client, sample_role):
    target = User.objects.create_user(username="delete-target-5", password="p")
    assignment = UserRoleAssignment.objects.create(
        user=target,
        role=sample_role,
        is_active=False,
        revoked_at=__import__("django.utils.timezone", fromlist=["timezone"]).now(),
    )
    url = IDENTITY_ASSIGNMENT_DETAIL.format(id=assignment.id)
    response = staff_authenticated_client.delete(url)
    assert response.status_code == 400
    assert "already revoked" in response.json()["detail"]
