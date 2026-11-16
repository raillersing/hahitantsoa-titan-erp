"""Comprehensive test suite for Lot A4: Visits (D04) and Support / Bug Reports (D03).

Per Decisions D03 & D04:
- D04: Replace the is_staff=True filter for visit responsibles with an explicit
  business selector: active users with owner_manager, manager, reservation_sensitive_operator
  or technical privileges (is_staff=True or is_superuser=True). Both the exposition endpoint
  (/api/v1/visits/responsibles/) and the serializer (responsible_id) share this selector.
  Inactive and non-eligible users are strictly excluded.
- D03: Any authenticated user sees only their own bug reports (reporter=request.user).
  Global view and status updates (/api/v1/notifications/bug-reports/<id>/status/) are opened
  to owner_manager and technical administrators (is_staff, is_superuser).
  Explicit rule: canManageIdentity (identity_admin) does NOT grant support access.
"""

import uuid
from datetime import timedelta

import pytest
from django.utils import timezone

from apps.audit.models import AuditEvent
from apps.customers.models import Customer
from apps.identity.models import ApplicationRole, UserRoleAssignment
from apps.notifications.models import BugReport, BugReportSeverity, BugReportStatus
from apps.visits.models import VisitAppointment
from apps.visits.selectors import get_eligible_visit_responsibles
from apps.visits.services import (
    VisitLifecycleError,
    create_visit_appointment,
    update_visit_appointment,
)

pytestmark = pytest.mark.django_db

VISIT_APPOINTMENTS_URL = "/api/v1/visits/appointments/"
VISIT_RESPONSIBLES_URL = "/api/v1/visits/responsibles/"
BUG_REPORTS_URL = "/api/v1/notifications/bug-reports/"


def _assign_role(user, role_slug: str) -> UserRoleAssignment:
    role, _ = ApplicationRole.objects.get_or_create(
        slug=role_slug,
        defaults={"name": role_slug.replace("_", " ").title(), "is_active": True},
    )
    assignment, _ = UserRoleAssignment.objects.get_or_create(
        user=user,
        role=role,
        defaults={"is_active": True},
    )
    if not assignment.is_active:
        assignment.is_active = True
        assignment.save(update_fields=["is_active"])
    return assignment


def _customer() -> Customer:
    return Customer.objects.create(
        display_name=f"Client Visite {uuid.uuid4().hex[:6]}",
        lifecycle_status="prospect",
    )


def _visit_payload(customer, responsible, **overrides) -> dict:
    scheduled_at = timezone.now().replace(microsecond=0) + timedelta(days=2)
    payload = {
        "customer_id": str(customer.id),
        "reason": "prospect",
        "scheduled_at": scheduled_at.isoformat(),
        "responsible_id": str(responsible.id),
        "notes": "Présentation et visite du site.",
    }
    payload.update(overrides)
    return payload


# ==============================================================================
# 1. VISITS TESTS (Decision D04)
# ==============================================================================


def test_visit_responsibles_selector_includes_eligible_roles(django_user_model):
    """Selector includes owner_manager, manager, reservation_sensitive_operator, and staff."""
    User = django_user_model

    owner = User.objects.create_user(username="owner-resp", password="password")
    _assign_role(owner, "owner_manager")

    manager = User.objects.create_user(username="manager-resp", password="password")
    _assign_role(manager, "manager")

    commercial = User.objects.create_user(username="commercial-resp", password="password")
    _assign_role(commercial, "reservation_sensitive_operator")

    staff = User.objects.create_user(username="staff-resp", password="password", is_staff=True)
    superuser = User.objects.create_superuser(
        username="super-resp", email="admin@example.test", password="password"
    )

    # Ineligible roles
    cleaner = User.objects.create_user(username="cleaner-resp", password="password")
    _assign_role(cleaner, "cleaner")

    accountant = User.objects.create_user(username="accountant-resp", password="password")
    _assign_role(accountant, "accountant")

    storekeeper = User.objects.create_user(username="storekeeper-resp", password="password")
    _assign_role(storekeeper, "storekeeper")

    # Inactive eligible
    inactive_owner = User.objects.create_user(
        username="inactive-owner", password="password", is_active=False
    )
    _assign_role(inactive_owner, "owner_manager")

    eligible_users = list(get_eligible_visit_responsibles())
    eligible_ids = {u.id for u in eligible_users}

    assert owner.id in eligible_ids
    assert manager.id in eligible_ids
    assert commercial.id in eligible_ids
    assert staff.id in eligible_ids
    assert superuser.id in eligible_ids

    assert cleaner.id not in eligible_ids
    assert accountant.id not in eligible_ids
    assert storekeeper.id not in eligible_ids
    assert inactive_owner.id not in eligible_ids


def test_visit_responsibles_list_endpoint_exposes_only_eligible_users(client, django_user_model):
    """GET /api/v1/visits/responsibles/ returns only active eligible responsibles."""
    User = django_user_model

    owner = User.objects.create_user(
        username="owner-user",
        password="password",
        first_name="Jean",
        last_name="Gérant",
    )
    _assign_role(owner, "owner_manager")

    manager = User.objects.create_user(
        username="mgr-user",
        password="password",
        first_name="Marc",
        last_name="Manager",
    )
    _assign_role(manager, "manager")

    cleaner = User.objects.create_user(username="cleaner-user", password="password")
    _assign_role(cleaner, "cleaner")

    inactive_staff = User.objects.create_user(
        username="inactive-staff", password="password", is_staff=True, is_active=False
    )

    reader = User.objects.create_user(username="any-reader", password="password")
    client.force_login(reader)

    response = client.get(VISIT_RESPONSIBLES_URL)
    assert response.status_code == 200
    returned_ids = {item["id"] for item in response.json()}

    assert str(owner.id) in returned_ids
    assert str(manager.id) in returned_ids
    assert str(cleaner.id) not in returned_ids
    assert str(inactive_staff.id) not in returned_ids


def test_create_visit_allows_owner_manager_as_responsible(client, django_user_model):
    """POST /api/v1/visits/appointments/ accepts owner_manager as responsible."""
    User = django_user_model

    creator = User.objects.create_user(username="creator-commercial", password="password")
    _assign_role(creator, "reservation_sensitive_operator")

    owner = User.objects.create_user(username="owner-target", password="password")
    _assign_role(owner, "owner_manager")

    customer = _customer()
    client.force_login(creator)

    response = client.post(
        VISIT_APPOINTMENTS_URL,
        data=_visit_payload(customer, owner),
        content_type="application/json",
    )
    assert response.status_code == 201
    created_id = response.json()["id"]
    visit = VisitAppointment.objects.get(pk=created_id)
    assert visit.responsible == owner
    assert visit.customer == customer


def test_create_visit_allows_manager_as_responsible(client, django_user_model):
    """POST /api/v1/visits/appointments/ accepts manager as responsible."""
    User = django_user_model

    creator = User.objects.create_user(username="creator-staff", password="password", is_staff=True)
    manager = User.objects.create_user(username="manager-target", password="password")
    _assign_role(manager, "manager")

    customer = _customer()
    client.force_login(creator)

    response = client.post(
        VISIT_APPOINTMENTS_URL,
        data=_visit_payload(customer, manager),
        content_type="application/json",
    )
    assert response.status_code == 201
    assert response.json()["responsible_id"] == manager.id


def test_create_visit_rejects_ineligible_roles_as_responsible(client, django_user_model):
    """POST /api/v1/visits/appointments/ rejects cleaner, accountant, storekeeper."""
    User = django_user_model

    creator = User.objects.create_user(username="visit-admin", password="password", is_staff=True)
    client.force_login(creator)
    customer = _customer()

    for role_slug in ("cleaner", "accountant", "storekeeper", "delivery_driver"):
        ineligible_user = User.objects.create_user(
            username=f"user-{role_slug}", password="password"
        )
        _assign_role(ineligible_user, role_slug)

        response = client.post(
            VISIT_APPOINTMENTS_URL,
            data=_visit_payload(customer, ineligible_user),
            content_type="application/json",
        )
        assert response.status_code == 400
        assert "responsible_id" in response.json() or "responsible" in response.json()


def test_create_visit_rejects_stale_in_memory_deactivated_responsible(client, django_user_model):
    """If a responsible user is deactivated in DB, validation rejects stale instances."""
    User = django_user_model

    creator = User.objects.create_user(username="creator-actor", password="password", is_staff=True)
    responsible = User.objects.create_user(username="stale-resp", password="password")
    _assign_role(responsible, "owner_manager")

    # In DB, deactivate the responsible
    User.objects.filter(pk=responsible.pk).update(is_active=False)

    client.force_login(creator)
    customer = _customer()

    response = client.post(
        VISIT_APPOINTMENTS_URL,
        data=_visit_payload(customer, responsible),
        content_type="application/json",
    )
    assert response.status_code == 400


def test_create_visit_rejects_stale_in_memory_revoked_role_responsible(client, django_user_model):
    """If a responsible user's role is revoked in DB, validation rejects it."""
    User = django_user_model

    creator = User.objects.create_user(username="creator-rev", password="password", is_staff=True)
    responsible = User.objects.create_user(username="revoked-resp", password="password")
    assignment = _assign_role(responsible, "owner_manager")

    # Revoke assignment in DB
    UserRoleAssignment.objects.filter(pk=assignment.pk).update(is_active=False)

    client.force_login(creator)
    customer = _customer()

    response = client.post(
        VISIT_APPOINTMENTS_URL,
        data=_visit_payload(customer, responsible),
        content_type="application/json",
    )
    assert response.status_code == 400


def test_services_enforce_responsible_eligibility_defense_in_depth(django_user_model):
    """Services raise VisitLifecycleError if responsible is ineligible."""
    User = django_user_model

    actor = User.objects.create_user(username="actor-svc", password="password", is_staff=True)
    cleaner = User.objects.create_user(username="cleaner-svc", password="password")
    _assign_role(cleaner, "cleaner")

    customer = _customer()
    values = {
        "customer": customer,
        "responsible": cleaner,
        "reason": "prospect",
        "scheduled_at": timezone.now() + timedelta(days=1),
    }

    with pytest.raises(VisitLifecycleError, match="not eligible"):
        create_visit_appointment(values=values, actor=actor)

    # Valid appointment
    manager = User.objects.create_user(username="manager-svc", password="password")
    _assign_role(manager, "manager")
    values["responsible"] = manager

    visit = create_visit_appointment(values=values, actor=actor)
    assert visit.responsible == manager

    # Attempt to update responsible to cleaner
    with pytest.raises(VisitLifecycleError, match="not eligible"):
        update_visit_appointment(visit=visit, values={"responsible": cleaner}, actor=actor)


# ==============================================================================
# 2. SUPPORT & BUG REPORTS TESTS (Decision D03)
# ==============================================================================


def test_standard_user_sees_only_own_bug_reports(client, django_user_model):
    """GET /api/v1/notifications/bug-reports/ isolates reports by reporter for standard users."""
    User = django_user_model

    user1 = User.objects.create_user(username="ticket-user-1", password="password")
    user2 = User.objects.create_user(username="ticket-user-2", password="password")

    report1 = BugReport.objects.create(
        reporter=user1,
        title="Bug User 1",
        description="Détail 1",
        severity=BugReportSeverity.LOW,
    )
    report2 = BugReport.objects.create(
        reporter=user2,
        title="Bug User 2",
        description="Détail 2",
        severity=BugReportSeverity.HIGH,
    )

    client.force_login(user1)
    response = client.get(BUG_REPORTS_URL)
    assert response.status_code == 200
    returned_ids = [item["id"] for item in response.json()]

    assert str(report1.id) in returned_ids
    assert str(report2.id) not in returned_ids


def test_owner_manager_has_global_view_of_bug_reports(client, django_user_model):
    """GET /api/v1/notifications/bug-reports/ gives global view to owner_manager."""
    User = django_user_model

    owner = User.objects.create_user(username="owner-support", password="password")
    _assign_role(owner, "owner_manager")

    other1 = User.objects.create_user(username="user-other-1", password="password")
    other2 = User.objects.create_user(username="user-other-2", password="password")

    report1 = BugReport.objects.create(reporter=other1, title="Crash login", description="Desc 1")
    report2 = BugReport.objects.create(reporter=other2, title="Erreur devis", description="Desc 2")

    client.force_login(owner)
    response = client.get(BUG_REPORTS_URL)
    assert response.status_code == 200
    returned_ids = {item["id"] for item in response.json()}

    assert str(report1.id) in returned_ids
    assert str(report2.id) in returned_ids


def test_identity_admin_does_not_have_global_support_view(client, django_user_model):
    """Decision D03 explicit rule: canManageIdentity does NOT grant support access."""
    User = django_user_model

    id_admin = User.objects.create_user(username="id-admin-user", password="password")
    _assign_role(id_admin, "identity_admin")

    other = User.objects.create_user(username="id-other-user", password="password")
    report_other = BugReport.objects.create(reporter=other, title="Bug autre", description="Desc")
    report_own = BugReport.objects.create(
        reporter=id_admin, title="Bug propre", description="Desc propre"
    )

    client.force_login(id_admin)
    response = client.get(BUG_REPORTS_URL)
    assert response.status_code == 200
    returned_ids = {item["id"] for item in response.json()}

    assert str(report_own.id) in returned_ids
    assert str(report_other.id) not in returned_ids


def test_owner_manager_can_update_bug_report_status(
    client, django_user_model, django_capture_on_commit_callbacks
):
    """owner_manager can update bug report status and generates audit event."""
    User = django_user_model

    owner = User.objects.create_user(username="owner-handler", password="password")
    _assign_role(owner, "owner_manager")

    reporter = User.objects.create_user(username="reporter-user", password="password")
    report = BugReport.objects.create(
        reporter=reporter,
        title="Problème impression",
        description="Le PDF est vide",
        status=BugReportStatus.NEW,
    )

    client.force_login(owner)

    with django_capture_on_commit_callbacks(execute=True):
        response = client.patch(
            f"{BUG_REPORTS_URL}{report.id}/status/",
            data={"status": "in_progress"},
            content_type="application/json",
        )

    assert response.status_code == 200
    assert response.json()["status"] == "in_progress"

    report.refresh_from_db()
    assert report.status == BugReportStatus.IN_PROGRESS

    # Audit event verified
    audit = AuditEvent.objects.filter(
        action="bug_report.status_updated",
        target_id=str(report.id),
    ).first()
    assert audit is not None
    assert audit.actor == owner
    assert audit.metadata.get("status") == "in_progress"


def test_standard_user_cannot_update_bug_report_status(client, django_user_model):
    """Standard authenticated user receives 403 Forbidden on status update."""
    User = django_user_model

    user = User.objects.create_user(username="standard-user", password="password")
    report = BugReport.objects.create(
        reporter=user,
        title="Mon bug",
        description="Desc",
        status=BugReportStatus.NEW,
    )

    client.force_login(user)
    response = client.patch(
        f"{BUG_REPORTS_URL}{report.id}/status/",
        data={"status": "resolved"},
        content_type="application/json",
    )
    assert response.status_code == 403
    report.refresh_from_db()
    assert report.status == BugReportStatus.NEW


def test_identity_admin_cannot_update_bug_report_status(client, django_user_model):
    """Decision D03: identity_admin cannot update bug report status (403 Forbidden)."""
    User = django_user_model

    id_admin = User.objects.create_user(username="id-admin-editor", password="password")
    _assign_role(id_admin, "identity_admin")

    reporter = User.objects.create_user(username="some-reporter", password="password")
    report = BugReport.objects.create(
        reporter=reporter,
        title="Bug système",
        description="Desc",
        status=BugReportStatus.NEW,
    )

    client.force_login(id_admin)
    response = client.patch(
        f"{BUG_REPORTS_URL}{report.id}/status/",
        data={"status": "resolved"},
        content_type="application/json",
    )
    assert response.status_code == 403
    report.refresh_from_db()
    assert report.status == BugReportStatus.NEW


def test_stale_in_memory_deactivated_support_manager_denied(client, django_user_model):
    """If an owner_manager is deactivated in DB, status patch returns 403 Forbidden."""
    User = django_user_model

    owner = User.objects.create_user(username="stale-support-owner", password="password")
    _assign_role(owner, "owner_manager")

    report = BugReport.objects.create(
        reporter=owner,
        title="Bug test",
        description="Desc",
        status=BugReportStatus.NEW,
    )

    # Deactivate in DB behind in-memory object
    User.objects.filter(pk=owner.pk).update(is_active=False)

    client.force_login(owner)
    response = client.patch(
        f"{BUG_REPORTS_URL}{report.id}/status/",
        data={"status": "resolved"},
        content_type="application/json",
    )
    assert response.status_code == 403
    report.refresh_from_db()
    assert report.status == BugReportStatus.NEW


def test_stale_in_memory_revoked_role_support_manager_denied(client, django_user_model):
    """If an owner_manager role is revoked in DB, status patch returns 403 Forbidden."""
    User = django_user_model

    owner = User.objects.create_user(username="revoked-support-owner", password="password")
    assignment = _assign_role(owner, "owner_manager")

    report = BugReport.objects.create(
        reporter=owner,
        title="Bug test 2",
        description="Desc 2",
        status=BugReportStatus.NEW,
    )

    # Revoke role assignment in DB
    UserRoleAssignment.objects.filter(pk=assignment.pk).update(is_active=False)

    client.force_login(owner)
    response = client.patch(
        f"{BUG_REPORTS_URL}{report.id}/status/",
        data={"status": "resolved"},
        content_type="application/json",
    )
    assert response.status_code == 403
    report.refresh_from_db()
    assert report.status == BugReportStatus.NEW
