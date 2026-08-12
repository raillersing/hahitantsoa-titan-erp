from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model

from apps.audit.models import AuditEvent
from apps.hr_payroll.models import Employee, PayrollRuleSet, PayrollRuleSetStatus, PaySlip
from apps.identity.models import ApplicationRole, UserRoleAssignment

pytestmark = pytest.mark.django_db

User = get_user_model()
LIST_URL = "/api/v1/hr/rule-sets/"
CURRENT_URL = f"{LIST_URL}current/"
PAYSLIP_VALIDATE_URL = "/api/v1/hr/payslips/{}/validate/"


def make_complete_payload(*, effective_from: str = "2099-01-01") -> dict:
    return {
        "label": "Configuration entreprise 2099",
        "effective_from": effective_from,
        "source_reference": "Référence DRH à compléter",
        "irsa_brackets": [{"lower": "0", "upper": "4000000", "rate": "0"}],
        "irsa_minimum": "0",
        "irsa_abatement": "0",
        "dependent_allowance": "0",
        "contribution_base_definition": "Base déclarée par la DRH",
        "cnaps_employee_rate": "1",
        "cnaps_employer_rate": "13",
        "ostie_employee_rate": "1",
        "ostie_employer_rate": "5",
        "fmfp_rate": "0",
        "overtime_rules": {"source": "DRH"},
        "payslip_contexture": {"source": "DRH"},
        "dns_format": {"source": "DRH"},
        "ostie_format": {"source": "DRH"},
        "collective_agreement": {"source": "DRH"},
    }


def create_role(*, slug: str, name: str) -> ApplicationRole:
    return ApplicationRole.objects.create(slug=slug, name=name)


@pytest.fixture
def drh_user():
    user = User.objects.create_user(username="drh", password="test-pass")
    role = create_role(slug="hr_manager", name="Responsable RH / DRH")
    UserRoleAssignment.objects.create(user=user, role=role)
    return user


@pytest.fixture
def accountant_user():
    user = User.objects.create_user(username="accountant", password="test-pass")
    role = create_role(slug="accountant", name="Comptable")
    UserRoleAssignment.objects.create(user=user, role=role)
    return user


def test_rule_set_requires_explicit_hr_or_finance_role(client):
    user = User.objects.create_user(username="regular", password="test-pass")
    client.force_login(user)

    response = client.get(LIST_URL)

    assert response.status_code == 403


def test_current_rule_set_resolves_by_effective_date(client, accountant_user):
    rule_set = PayrollRuleSet.objects.create(
        **make_complete_payload(effective_from="2099-01-01"),
        status=PayrollRuleSetStatus.ACTIVE,
    )
    client.force_login(accountant_user)

    response = client.get(CURRENT_URL, {"effective_on": "2099-06-15"})

    assert response.status_code == 200
    assert response.json()["id"] == str(rule_set.id)


def test_current_rule_set_returns_not_found_when_date_is_not_covered(client, accountant_user):
    PayrollRuleSet.objects.create(
        **make_complete_payload(effective_from="2099-01-01"),
        status=PayrollRuleSetStatus.ACTIVE,
        effective_until=date(2099, 1, 31),
    )
    client.force_login(accountant_user)

    response = client.get(CURRENT_URL, {"effective_on": "2099-02-01"})

    assert response.status_code == 404


def test_current_rule_set_rejects_invalid_date(client, accountant_user):
    client.force_login(accountant_user)

    response = client.get(CURRENT_URL, {"effective_on": "not-a-date"})

    assert response.status_code == 400


def test_drh_can_create_draft_and_submit(client, drh_user, django_capture_on_commit_callbacks):
    client.force_login(drh_user)
    response = client.post(LIST_URL, make_complete_payload(), content_type="application/json")

    assert response.status_code == 201
    rule_set_id = response.json()["id"]
    rule_set = PayrollRuleSet.objects.get(id=rule_set_id)
    assert rule_set.status == PayrollRuleSetStatus.DRAFT
    assert response.json()["completeness_errors"] == {}

    with django_capture_on_commit_callbacks(execute=True):
        response = client.post(f"{LIST_URL}{rule_set_id}/submit/", content_type="application/json")

    assert response.status_code == 200
    assert response.json()["status"] == PayrollRuleSetStatus.PENDING_REVIEW
    assert AuditEvent.objects.filter(action="hr_payroll.rule_set_submitted").exists()


def test_accountant_can_activate_submitted_rules_and_close_open_period(
    client, drh_user, accountant_user, django_capture_on_commit_callbacks
):
    active = PayrollRuleSet.objects.create(
        label="Configuration précédente",
        effective_from=date(2098, 1, 1),
        status=PayrollRuleSetStatus.ACTIVE,
        irsa_brackets=[{"lower": "0", "upper": "4000000", "rate": "0"}],
        irsa_minimum=Decimal("0"),
        irsa_abatement=Decimal("0"),
        dependent_allowance=Decimal("0"),
        contribution_base_definition="base",
        cnaps_employee_rate=Decimal("1"),
        cnaps_employer_rate=Decimal("13"),
        ostie_employee_rate=Decimal("1"),
        ostie_employer_rate=Decimal("5"),
        fmfp_rate=Decimal("0"),
        overtime_rules={"source": "DRH"},
        payslip_contexture={"source": "DRH"},
        dns_format={"source": "DRH"},
        ostie_format={"source": "DRH"},
        collective_agreement={"source": "DRH"},
    )
    rule_set = PayrollRuleSet.objects.create(
        **make_complete_payload(), status=PayrollRuleSetStatus.PENDING_REVIEW
    )
    client.force_login(accountant_user)

    with django_capture_on_commit_callbacks(execute=True):
        response = client.post(
            f"{LIST_URL}{rule_set.id}/activate/", content_type="application/json"
        )

    assert response.status_code == 200
    rule_set.refresh_from_db()
    active.refresh_from_db()
    assert rule_set.status == PayrollRuleSetStatus.ACTIVE
    assert active.effective_until == date(2098, 12, 31)
    assert AuditEvent.objects.filter(action="hr_payroll.rule_set_activated").exists()


def test_drh_cannot_activate_rules(client, drh_user):
    rule_set = PayrollRuleSet.objects.create(
        **make_complete_payload(), status=PayrollRuleSetStatus.PENDING_REVIEW
    )
    client.force_login(drh_user)

    response = client.post(f"{LIST_URL}{rule_set.id}/activate/", content_type="application/json")

    assert response.status_code == 403


def test_activation_rejects_overlapping_bounded_period(client, accountant_user):
    PayrollRuleSet.objects.create(
        **make_complete_payload(effective_from="2099-01-01"),
        status=PayrollRuleSetStatus.ACTIVE,
        effective_until=date(2099, 12, 31),
    )
    rule_set = PayrollRuleSet.objects.create(
        **make_complete_payload(effective_from="2099-06-01"),
        effective_until=date(2099, 8, 31),
        status=PayrollRuleSetStatus.PENDING_REVIEW,
    )
    client.force_login(accountant_user)

    response = client.post(f"{LIST_URL}{rule_set.id}/activate/", content_type="application/json")

    assert response.status_code == 400
    rule_set.refresh_from_db()
    assert rule_set.status == PayrollRuleSetStatus.PENDING_REVIEW


def test_active_rules_are_not_editable(client, accountant_user):
    rule_set = PayrollRuleSet.objects.create(
        **make_complete_payload(), status=PayrollRuleSetStatus.ACTIVE
    )
    rule_set.refresh_from_db()
    client.force_login(accountant_user)

    response = client.patch(
        f"{LIST_URL}{rule_set.id}/",
        {"label": "Tentative rétroactive"},
        content_type="application/json",
    )

    assert response.status_code == 409
    rule_set.refresh_from_db()
    assert rule_set.label == "Configuration entreprise 2099"


def test_payslip_validation_requires_active_rules(
    client, accountant_user, django_capture_on_commit_callbacks
):
    employee = Employee.objects.create(first_name="Jean", last_name="Rakoto", role="Agent")
    payslip = PaySlip.objects.create(employee=employee, period="2099-01")
    client.force_login(accountant_user)

    response = client.post(PAYSLIP_VALIDATE_URL.format(payslip.id), content_type="application/json")

    assert response.status_code == 400
    payslip.refresh_from_db()
    assert payslip.status == "draft"


def test_payslip_validation_snapshots_active_rules(
    client, accountant_user, django_capture_on_commit_callbacks
):
    rule_set = PayrollRuleSet.objects.create(
        **make_complete_payload(), status=PayrollRuleSetStatus.ACTIVE
    )
    rule_set.refresh_from_db()
    employee = Employee.objects.create(first_name="Jean", last_name="Rakoto", role="Agent")
    payslip = PaySlip.objects.create(employee=employee, period="2099-01")
    client.force_login(accountant_user)

    with django_capture_on_commit_callbacks(execute=True):
        response = client.post(
            PAYSLIP_VALIDATE_URL.format(payslip.id), content_type="application/json"
        )

    assert response.status_code == 200
    payslip.refresh_from_db()
    assert payslip.status == "validated"
    assert payslip.payroll_rule_set_id == rule_set.id
    assert payslip.payroll_rule_snapshot["label"] == rule_set.label
    assert AuditEvent.objects.filter(action="hr_payroll.payslip_validated").exists()

    original_snapshot = payslip.payroll_rule_snapshot.copy()
    rule_set.label = "Configuration modifiée hors workflow"
    rule_set.save(update_fields=["label", "updated_at"])
    payslip.refresh_from_db()
    assert payslip.payroll_rule_snapshot == original_snapshot


def test_validated_payslip_cannot_be_updated_or_deleted(client, accountant_user):
    rule_set = PayrollRuleSet.objects.create(
        **make_complete_payload(), status=PayrollRuleSetStatus.ACTIVE
    )
    rule_set.refresh_from_db()
    employee = Employee.objects.create(first_name="Jean", last_name="Rakoto", role="Agent")
    payslip = PaySlip.objects.create(
        employee=employee,
        period="2099-01",
        status="validated",
        payroll_rule_set=rule_set,
        payroll_rule_snapshot=rule_set.snapshot(),
    )
    client.force_login(accountant_user)
    url = f"/api/v1/hr/payslips/{payslip.id}/"

    update_response = client.patch(url, {"gross_salary": "1"}, content_type="application/json")
    delete_response = client.delete(url)

    assert update_response.status_code == 409
    assert delete_response.status_code == 409
    assert PaySlip.objects.filter(id=payslip.id).exists()


def test_employee_with_validated_payslip_cannot_be_deleted(client, accountant_user):
    rule_set = PayrollRuleSet.objects.create(
        **make_complete_payload(), status=PayrollRuleSetStatus.ACTIVE
    )
    rule_set.refresh_from_db()
    employee = Employee.objects.create(first_name="Jean", last_name="Rakoto", role="Agent")
    PaySlip.objects.create(
        employee=employee,
        period="2099-01",
        status="validated",
        payroll_rule_set=rule_set,
        payroll_rule_snapshot=rule_set.snapshot(),
    )
    client.force_login(accountant_user)

    response = client.delete(f"/api/v1/hr/employees/{employee.id}/")

    assert response.status_code == 409
    assert Employee.objects.filter(id=employee.id).exists()
