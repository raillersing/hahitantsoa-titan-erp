from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.db import close_old_connections
from django.test import Client

from apps.identity.authorization import is_reservation_sensitive_actor
from apps.identity.models import ApplicationRole, UserRoleAssignment
from apps.identity.serializers import UserSerializer
from apps.identity.services import IdentityServiceError, revoke_role, update_user

pytestmark = pytest.mark.django_db
User = get_user_model()


def admin(username="platform", **kwargs):
    return User.objects.create_user(username=username, is_staff=True, **kwargs)


def delegate():
    user = User.objects.create_user(username="delegate")
    group, _ = Group.objects.get_or_create(name="identity_admin")
    user.groups.add(group)
    return user


@pytest.mark.parametrize("action", ["reset-password", "suspend", "rename"])
@pytest.mark.parametrize("superuser", [False, True])
def test_delegated_admin_cannot_mutate_platform_account(action, superuser):
    target = admin(is_superuser=superuser)
    client = Client()
    client.force_login(delegate())
    if action == "reset-password":
        response = client.post(
            f"/api/v1/identity/users/{target.pk}/reset-password/",
            {"new_password": "Synthetic-Password-2026!"},
            content_type="application/json",
        )
    else:
        response = client.patch(
            f"/api/v1/identity/users/{target.pk}/",
            {"is_active": False} if action == "suspend" else {"first_name": "changed"},
            content_type="application/json",
        )
    assert response.status_code == 403
    target.refresh_from_db()
    assert target.is_active and not target.first_name
    assert not target.check_password("Synthetic-Password-2026!")


def test_staff_cannot_take_over_superuser():
    target = admin("root", is_superuser=True)
    client = Client()
    client.force_login(admin())
    response = client.post(
        f"/api/v1/identity/users/{target.pk}/reset-password/",
        {"new_password": "Synthetic-Password-2026!"},
        content_type="application/json",
    )
    assert response.status_code == 403


def test_delegated_admin_can_manage_ordinary_employee():
    employee = User.objects.create_user(username="employee")
    update_user(actor=delegate(), user_id=employee.pk, first_name="Alice")
    employee.refresh_from_db()
    assert employee.first_name == "Alice"


def commercial(user):
    role, _ = ApplicationRole.objects.get_or_create(
        slug="reservation_sensitive_operator",
        defaults={"name": "Commercial", "is_system_managed": True},
    )
    group, _ = Group.objects.get_or_create(name=role.slug)
    user.groups.add(group)
    return role


def test_revoke_assignment_removes_legacy_grant_too():
    actor = admin()
    employee = User.objects.create_user(username="employee")
    role = commercial(employee)
    assignment = UserRoleAssignment.objects.create(user=employee, role=role)
    revoke_role(actor=actor, assignment_id=str(assignment.pk))
    assert not is_reservation_sensitive_actor(actor=employee)
    assert UserSerializer(employee).data["role_slugs"] == []


def test_group_only_role_is_visible_and_removable():
    actor = admin()
    employee = User.objects.create_user(username="employee")
    commercial(employee)
    data = UserSerializer(employee).data
    assert data["role_slugs"] == ["reservation_sensitive_operator"]
    assert data["group_role_slugs"] == data["role_slugs"]
    assert data["assigned_role_slugs"] == []
    update_user(actor=actor, user_id=employee.pk, role_slugs=[])
    assert not is_reservation_sensitive_actor(actor=employee)


def test_inactive_role_not_advertised():
    employee = User.objects.create_user(username="employee")
    role = commercial(employee)
    UserRoleAssignment.objects.create(user=employee, role=role)
    ApplicationRole.objects.filter(pk=role.pk).update(is_active=False)
    assert UserSerializer(employee).data["role_slugs"] == []


def test_suspension_destroys_sessions_even_after_reactivation():
    actor = admin()
    employee = User.objects.create_user(username="employee")
    other = User.objects.create_user(username="other")
    client, other_client = Client(), Client()
    client.force_login(employee)
    other_client.force_login(other)
    update_user(actor=actor, user_id=employee.pk, is_active=False)
    update_user(actor=actor, user_id=employee.pk, is_active=True)
    assert not client.get("/api/v1/auth/session/").json()["authenticated"]
    assert other_client.get("/api/v1/auth/session/").json()["authenticated"]


@pytest.mark.django_db(transaction=True)
def test_concurrent_administrators_cannot_suspend_each_other():
    a, b = admin("a"), admin("b")
    barrier = Barrier(2)

    def suspend(actor_id, target_id):
        close_old_connections()
        actor = User.objects.get(pk=actor_id)
        barrier.wait(timeout=10)
        try:
            update_user(actor=actor, user_id=target_id, is_active=False)
            return "ok"
        except IdentityServiceError:
            return "denied"
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(suspend, a.pk, b.pk), pool.submit(suspend, b.pk, a.pk)]
        assert sorted(f.result(timeout=30) for f in futures) == ["denied", "ok"]
    assert User.objects.filter(is_staff=True, is_active=True).count() == 1


def test_owner_has_business_access_without_platform_status():
    from apps.identity.authorization import access_capabilities_for_actor

    owner = User.objects.create_user(username="owner")
    role = ApplicationRole.objects.create(name="Gérant", slug="owner_manager")
    UserRoleAssignment.objects.create(user=owner, role=role)
    caps = access_capabilities_for_actor(actor=owner)
    for key in (
        "canManageIdentity",
        "canSensitiveWrite",
        "canManageInventory",
        "canManageFinance",
        "canOperateLogistics",
        "canSuperviseCashbox",
    ):
        assert caps[key]
    assert not caps["canSuperAdminDelete"]
    assert not owner.is_staff and not owner.is_superuser
    employee = User.objects.create_user(username="employee")
    update_user(actor=owner, user_id=employee.pk, first_name="Alice")
    with pytest.raises(IdentityServiceError):
        update_user(actor=owner, user_id=admin().pk, first_name="Forbidden")


def test_stock_profile_has_no_financial_or_confirmation_privilege():
    from apps.identity.authorization import access_capabilities_for_actor

    user = User.objects.create_user(username="stock")
    role = ApplicationRole.objects.create(name="Stock", slug="storekeeper")
    UserRoleAssignment.objects.create(user=user, role=role)
    caps = access_capabilities_for_actor(actor=user)
    assert caps["canManageInventory"] and caps["canOperateLogistics"]
    assert not caps["canSensitiveWrite"] and not caps["canOperateCashbox"]
    client = Client()
    client.force_login(user)
    assert client.get("/api/v1/logistics/events/").status_code == 200
    assert client.options("/api/v1/customers/create/").status_code == 403


def test_session_and_admin_share_server_capabilities():
    from apps.identity.roles import capabilities_for_roles

    owner = User.objects.create_user(username="owner")
    role = ApplicationRole.objects.create(name="Gérant", slug="owner_manager")
    UserRoleAssignment.objects.create(user=owner, role=role)
    client = Client()
    client.force_login(owner)
    session = client.get("/api/v1/auth/session/").json()["user"]
    assert session["capabilities"] == UserSerializer(owner).data["capabilities"]
    assert session["capabilities"] == capabilities_for_roles(["owner_manager"])
    assert client.get("/api/v1/identity/users/").status_code == 200


def test_delegated_admin_cannot_mint_owner_or_override_role():
    client = Client()
    client.force_login(delegate())
    for slug in ("owner_manager", "logistics_override"):
        assert (
            client.post(
                "/api/v1/identity/roles/",
                {"name": slug, "slug": slug},
                content_type="application/json",
            ).status_code
            == 403
        )


def test_owner_cannot_remove_own_administrative_access():
    user = User.objects.create_user(username="owner")
    role = ApplicationRole.objects.create(name="Gérant", slug="owner_manager")
    assignment = UserRoleAssignment.objects.create(user=user, role=role)
    with pytest.raises(IdentityServiceError, match="propre accès"):
        update_user(actor=user, user_id=user.pk, role_slugs=[])
    with pytest.raises(IdentityServiceError, match="propre accès"):
        revoke_role(actor=user, assignment_id=str(assignment.pk))
    assignment.refresh_from_db()
    assert assignment.is_active


def test_delegated_admin_can_keep_existing_group_grants_when_editing_employee():
    actor = delegate()
    employee = User.objects.create_user(username="employee")
    commercial(employee)
    update_user(
        actor=actor,
        user_id=employee.pk,
        first_name="Alice",
        role_slugs=["reservation_sensitive_operator"],
    )
    employee.refresh_from_db()
    assert employee.first_name == "Alice"
    assert not UserRoleAssignment.objects.filter(user=employee).exists()


def test_role_catalog_explains_delegation_limits():
    protected = ApplicationRole.objects.create(
        name="Commercial", slug="reservation_sensitive_operator", is_system_managed=True
    )
    client = Client()
    client.force_login(delegate())
    role = next(
        row
        for row in client.get("/api/v1/identity/roles/").json()
        if row["id"] == str(protected.pk)
    )
    assert role["capabilities"]["canSensitiveWrite"]
    assert not role["assignable"]
    client.force_login(admin())
    role = next(
        row
        for row in client.get("/api/v1/identity/roles/").json()
        if row["id"] == str(protected.pk)
    )
    assert role["assignable"]


@pytest.mark.parametrize("slug", ["owner_manager", "hr_manager", "accountant", "manager", "staff"])
def test_payroll_capabilities_match_module_authorization(slug):
    from types import SimpleNamespace

    from apps.hr_payroll.permissions import (
        HasPayrollRecordsEditAccess,
        HasPayrollRecordsViewAccess,
        HasPayrollRulesActivationAccess,
    )
    from apps.identity.authorization import access_capabilities_for_actor

    user = User.objects.create_user(username="payroll", is_staff=slug == "staff")
    if slug != "staff":
        role = ApplicationRole.objects.create(name=slug, slug=slug)
        UserRoleAssignment.objects.create(user=user, role=role)
    request = SimpleNamespace(user=user)
    caps = access_capabilities_for_actor(actor=user)
    assert caps["canViewPayroll"] == HasPayrollRecordsViewAccess().has_permission(request, None)
    assert caps["canEditPayroll"] == HasPayrollRecordsEditAccess().has_permission(request, None)
    assert caps["canActivatePayroll"] == HasPayrollRulesActivationAccess().has_permission(
        request, None
    )


@pytest.mark.parametrize(
    "slug",
    [
        "owner_manager",
        "manager",
        "logistics_override",
        "identity_admin",
        "reservation_sensitive_operator",
    ],
)
@pytest.mark.parametrize("padding", ["", " "])
def test_delegated_role_mutation_cannot_mint_protected_capabilities(slug, padding):
    client = Client()
    client.force_login(delegate())
    desired = padding + slug + padding
    created = client.post(
        "/api/v1/identity/roles/",
        {"name": "Attempt", "slug": desired},
        content_type="application/json",
    )
    assert created.status_code == 403
    role = ApplicationRole.objects.create(name="Existing custom", slug="custom_before")
    changed = client.patch(
        f"/api/v1/identity/roles/{role.pk}/", {"slug": desired}, content_type="application/json"
    )
    assert changed.status_code == 403
    role.refresh_from_db()
    assert role.slug == "custom_before"
    assert not ApplicationRole.objects.filter(slug=slug).exists()


@pytest.mark.parametrize("method", ["patch", "delete"])
def test_delegated_admin_cannot_mutate_manager_definition(method):
    role = ApplicationRole.objects.create(name="Manager", slug="manager")
    client = Client()
    client.force_login(delegate())
    response = getattr(client, method)(
        f"/api/v1/identity/roles/{role.pk}/", {"is_active": False}, content_type="application/json"
    )
    assert response.status_code == 403
    role.refresh_from_db()
    assert role.is_active
