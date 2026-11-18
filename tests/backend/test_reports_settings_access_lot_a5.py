from __future__ import annotations

import json
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.test import Client

from apps.audit.models import AuditEvent
from apps.common.reports import (
    ReportCategory,
    categories_for_user_roles,
    export_categories_for_user_roles,
)
from apps.customers.models import Customer
from apps.hahitantsoa.commercial_terms import (
    calculate_space_rental_amount,
    get_hahitantsoa_commercial_terms,
)
from apps.hahitantsoa.models import (
    HahitantsoaDurationOption,
    HahitantsoaEventDraft,
)
from apps.identity.authorization import is_commercial_terms_settings_actor
from apps.identity.models import ApplicationRole, UserRoleAssignment

User = get_user_model()
pytestmark = pytest.mark.django_db

ALL_CATEGORIES_SORTED = sorted([c.value for c in ReportCategory])


def _assign_role(user, role_slug: str) -> None:
    role, _ = ApplicationRole.objects.get_or_create(
        slug=role_slug,
        defaults={"name": role_slug.replace("_", " ").title(), "is_active": True},
    )
    UserRoleAssignment.objects.create(user=user, role=role, is_active=True)


# ==============================================================================
# 1. categories_for_user_roles selector tests
# ==============================================================================


def test_categories_for_user_roles_anonymous_or_inactive() -> None:
    assert categories_for_user_roles(None) == []

    inactive_user = User.objects.create_user(
        username="inactive-user", password="pwd", is_active=False
    )
    _assign_role(inactive_user, "owner_manager")
    assert categories_for_user_roles(inactive_user) == []


def test_categories_for_user_roles_technical_staff() -> None:
    staff_user = User.objects.create_user(
        username="staff-user", password="pwd", is_staff=True, is_active=True
    )
    assert categories_for_user_roles(staff_user) == ALL_CATEGORIES_SORTED

    superuser = User.objects.create_user(
        username="super-user", password="pwd", is_superuser=True, is_active=True
    )
    assert categories_for_user_roles(superuser) == ALL_CATEGORIES_SORTED


def test_categories_for_user_roles_business_profiles() -> None:
    owner = User.objects.create_user(username="owner-rep", password="pwd")
    _assign_role(owner, "owner_manager")
    assert categories_for_user_roles(owner) == ALL_CATEGORIES_SORTED

    manager = User.objects.create_user(username="mgr-rep", password="pwd")
    _assign_role(manager, "manager")
    assert categories_for_user_roles(manager) == ALL_CATEGORIES_SORTED

    accountant = User.objects.create_user(username="acct-rep", password="pwd")
    _assign_role(accountant, "accountant")
    assert categories_for_user_roles(accountant) == ["payments", "sales_billing"]

    storekeeper = User.objects.create_user(username="sk-rep", password="pwd")
    _assign_role(storekeeper, "storekeeper")
    assert categories_for_user_roles(storekeeper) == ["inventory"]

    logistics = User.objects.create_user(username="log-rep", password="pwd")
    _assign_role(logistics, "logistics_manager")
    assert categories_for_user_roles(logistics) == ["inventory", "logistics"]

    cleaner = User.objects.create_user(username="cleaner-rep", password="pwd")
    _assign_role(cleaner, "cleaner")
    assert categories_for_user_roles(cleaner) == []

    driver = User.objects.create_user(username="driver-rep", password="pwd")
    _assign_role(driver, "delivery_driver")
    assert categories_for_user_roles(driver) == []


def test_categories_for_user_roles_stale_in_memory_safeguard() -> None:
    user = User.objects.create_user(username="stale-acct", password="pwd")
    _assign_role(user, "accountant")
    assert categories_for_user_roles(user) == ["payments", "sales_billing"]

    # Deactivate in database without touching user object in memory
    User.objects.filter(pk=user.pk).update(is_active=False)
    assert categories_for_user_roles(user) == []

    # Re-activate, but delete role assignment in database
    User.objects.filter(pk=user.pk).update(is_active=True)
    UserRoleAssignment.objects.filter(user=user).delete()
    assert categories_for_user_roles(user) == []


def test_export_categories_for_user_roles() -> None:
    accountant = User.objects.create_user(username="acct-exp", password="pwd")
    _assign_role(accountant, "accountant")
    assert export_categories_for_user_roles(accountant) == ["payments", "sales_billing"]

    # Storekeeper can view inventory but has no export capabilities
    storekeeper = User.objects.create_user(username="sk-exp", password="pwd")
    _assign_role(storekeeper, "storekeeper")
    assert export_categories_for_user_roles(storekeeper) == []

    owner = User.objects.create_user(username="owner-exp", password="pwd")
    _assign_role(owner, "owner_manager")
    assert export_categories_for_user_roles(owner) == ALL_CATEGORIES_SORTED


# ==============================================================================
# 2. Session endpoint exposure (reportCategories)
# ==============================================================================


def test_session_endpoint_exposes_report_categories(client: Client) -> None:
    accountant = User.objects.create_user(username="acct-session", password="pwd")
    _assign_role(accountant, "accountant")

    client.force_login(accountant)
    response = client.get("/api/v1/auth/session/")
    assert response.status_code == 200
    data = response.json()
    assert data["authenticated"] is True
    assert data["user"]["reportCategories"] == ["payments", "sales_billing"]


def test_session_endpoint_anonymous_no_user(client: Client) -> None:
    response = client.get("/api/v1/auth/session/")
    assert response.status_code == 200
    assert response.json() == {"authenticated": False, "user": None}


# ==============================================================================
# 3. ReportDataAPIView permission checks
# ==============================================================================


def test_report_data_api_view_access_matrix(client: Client) -> None:
    accountant = User.objects.create_user(username="acct-repview", password="pwd")
    _assign_role(accountant, "accountant")

    storekeeper = User.objects.create_user(username="sk-repview", password="pwd")
    _assign_role(storekeeper, "storekeeper")

    cleaner = User.objects.create_user(username="cleaner-repview", password="pwd")
    _assign_role(cleaner, "cleaner")

    owner = User.objects.create_user(username="owner-repview", password="pwd")
    _assign_role(owner, "owner_manager")

    # Unauthenticated
    assert client.get("/api/v1/reports/sales_billing/").status_code == 403

    # Unknown category
    client.force_login(owner)
    assert client.get("/api/v1/reports/unknown_category/").status_code == 404

    # Accountant: sales_billing and payments allowed, inventory and logistics 403
    client.force_login(accountant)
    res_sales = client.get("/api/v1/reports/sales_billing/")
    assert res_sales.status_code == 200
    assert res_sales.json()["category"] == "sales_billing"

    res_pay = client.get("/api/v1/reports/payments/")
    assert res_pay.status_code == 200
    assert res_pay.json()["category"] == "payments"

    res_inv = client.get("/api/v1/reports/inventory/")
    assert res_inv.status_code == 403
    assert res_inv.json()["detail"] == "You do not have permission to view this report category."

    res_log = client.get("/api/v1/reports/logistics/")
    assert res_log.status_code == 403

    # Storekeeper: inventory allowed, sales_billing 403
    client.force_login(storekeeper)
    assert client.get("/api/v1/reports/inventory/").status_code == 200
    assert client.get("/api/v1/reports/sales_billing/").status_code == 403

    # Cleaner: all categories 403
    client.force_login(cleaner)
    assert client.get("/api/v1/reports/inventory/").status_code == 403
    assert client.get("/api/v1/reports/sales_billing/").status_code == 403

    # Owner manager: all allowed
    client.force_login(owner)
    assert client.get("/api/v1/reports/inventory/").status_code == 200
    assert client.get("/api/v1/reports/sales_billing/").status_code == 200


def test_report_data_api_view_stale_in_memory_deactivated_refused(client: Client) -> None:
    accountant = User.objects.create_user(username="acct-stale-view", password="pwd")
    _assign_role(accountant, "accountant")
    client.force_login(accountant)

    assert client.get("/api/v1/reports/sales_billing/").status_code == 200

    # Deactivate in database
    User.objects.filter(pk=accountant.pk).update(is_active=False)
    assert client.get("/api/v1/reports/sales_billing/").status_code == 403


# ==============================================================================
# 4. Report Exports permission checks
# ==============================================================================


def test_report_exports_permission_matrix(client: Client) -> None:
    accountant = User.objects.create_user(username="acct-expview", password="pwd")
    _assign_role(accountant, "accountant")

    storekeeper = User.objects.create_user(username="sk-expview", password="pwd")
    _assign_role(storekeeper, "storekeeper")

    logistics = User.objects.create_user(username="log-expview", password="pwd")
    _assign_role(logistics, "logistics_manager")

    cleaner = User.objects.create_user(username="cleaner-expview", password="pwd")
    _assign_role(cleaner, "cleaner")

    owner = User.objects.create_user(username="owner-expview", password="pwd")
    _assign_role(owner, "owner_manager")

    # Accountant: sales journal 200, breakage 200 (includes sales_billing)
    client.force_login(accountant)
    res_sales_exp = client.get("/api/v1/reports/exports/sales/")
    assert res_sales_exp.status_code == 200
    assert client.get("/api/v1/reports/exports/breakage/").status_code == 200

    # Logistics manager: breakage 200, sales journal 403
    client.force_login(logistics)
    assert client.get("/api/v1/reports/exports/breakage/").status_code == 200
    assert client.get("/api/v1/reports/exports/sales/").status_code == 403

    # Storekeeper: no export permission (view only)
    client.force_login(storekeeper)
    assert client.get("/api/v1/reports/exports/sales/").status_code == 403
    assert client.get("/api/v1/reports/exports/breakage/").status_code == 403

    # Cleaner: no export permission
    client.force_login(cleaner)
    assert client.get("/api/v1/reports/exports/sales/").status_code == 403
    assert client.get("/api/v1/reports/exports/breakage/").status_code == 403

    # Owner manager: all exports allowed
    client.force_login(owner)
    assert client.get("/api/v1/reports/exports/sales/").status_code == 200
    assert client.get("/api/v1/reports/exports/breakage/").status_code == 200


# ==============================================================================
# 5. Commercial terms settings (D02 & HahitantsoaCommercialTermsAPIView)
# ==============================================================================


def test_is_commercial_terms_settings_actor_unit() -> None:
    assert not is_commercial_terms_settings_actor(actor=None)

    owner = User.objects.create_user(username="owner-unit", password="pwd")
    _assign_role(owner, "owner_manager")
    assert is_commercial_terms_settings_actor(actor=owner)

    manager = User.objects.create_user(username="mgr-unit", password="pwd")
    _assign_role(manager, "manager")
    assert not is_commercial_terms_settings_actor(actor=manager)

    staff = User.objects.create_user(username="staff-unit", password="pwd", is_staff=True)
    assert is_commercial_terms_settings_actor(actor=staff)

    # Stale in-memory user check
    User.objects.filter(pk=staff.pk).update(is_staff=False, is_superuser=False)
    assert not is_commercial_terms_settings_actor(actor=staff)


def test_commercial_terms_get_authenticated(client: Client) -> None:
    user = User.objects.create_user(username="any-auth", password="pwd")
    client.force_login(user)

    response = client.get("/api/v1/hahitantsoa/commercial-terms/")
    assert response.status_code == 200
    assert "contract_validity_days" in response.json()
    assert "bare_rental_composition" in response.json()


def test_commercial_terms_patch_owner_manager_without_staff_succeeds(
    client: Client, django_capture_on_commit_callbacks
) -> None:
    owner = User.objects.create_user(
        username="owner-patcher", password="pwd", is_staff=False, is_superuser=False
    )
    _assign_role(owner, "owner_manager")
    client.force_login(owner)

    terms = get_hahitantsoa_commercial_terms()

    payload = {
        "contract_validity_days": 25,
        "base_space_rental_amount": "7000000.00",
        "included_guest_count": 300,
        "excess_guest_amount": "6000.00",
        "bare_deposit_amount": "1200000.00",
        "logistics_deposit_amount": "1800000.00",
        "night_option_1_amount": "350000.00",
        "night_option_2_amount": "550000.00",
        "night_security_amount": "200000.00",
        "caution_amount": "600000.00",
    }
    with django_capture_on_commit_callbacks(execute=True):
        response = client.patch(
            "/api/v1/hahitantsoa/commercial-terms/",
            data=json.dumps(payload),
            content_type="application/json",
        )
    assert response.status_code == 200
    data = response.json()
    assert data["contract_validity_days"] == 25
    assert Decimal(str(data["base_space_rental_amount"])) == Decimal("7000000.00")
    assert data["included_guest_count"] == 300
    assert Decimal(str(data["excess_guest_amount"])) == Decimal("6000.00")
    assert Decimal(str(data["bare_deposit_amount"])) == Decimal("1200000.00")
    assert Decimal(str(data["logistics_deposit_amount"])) == Decimal("1800000.00")
    assert Decimal(str(data["night_option_1_amount"])) == Decimal("350000.00")
    assert Decimal(str(data["night_option_2_amount"])) == Decimal("550000.00")
    assert Decimal(str(data["night_security_amount"])) == Decimal("200000.00")
    assert Decimal(str(data["caution_amount"])) == Decimal("600000.00")

    # Verify persisted in database
    terms.refresh_from_db()
    assert terms.contract_validity_days == 25
    assert terms.base_space_rental_amount == Decimal("7000000.00")
    assert terms.included_guest_count == 300
    assert terms.excess_guest_amount == Decimal("6000.00")
    assert terms.bare_deposit_amount == Decimal("1200000.00")
    assert terms.logistics_deposit_amount == Decimal("1800000.00")
    assert terms.night_option_1_amount == Decimal("350000.00")
    assert terms.night_option_2_amount == Decimal("550000.00")
    assert terms.night_security_amount == Decimal("200000.00")
    assert terms.caution_amount == Decimal("600000.00")
    assert terms.updated_by == owner

    # Verify AuditEvent recorded with all modified fields
    audit = AuditEvent.objects.filter(
        action="commercial_terms.updated",
        target_type="commercial_terms",
        target_id=str(terms.id),
    ).first()
    assert audit is not None
    assert audit.actor == owner
    assert audit.metadata["contract_validity_days"] == 25
    assert audit.metadata["base_space_rental_amount"] == "7000000.00"
    assert audit.metadata["included_guest_count"] == 300
    assert audit.metadata["excess_guest_amount"] == "6000.00"
    assert audit.metadata["bare_deposit_amount"] == "1200000.00"
    assert audit.metadata["logistics_deposit_amount"] == "1800000.00"


def test_commercial_terms_patch_superadmin_succeeds(client: Client) -> None:
    staff = User.objects.create_user(
        username="staff-patcher", password="pwd", is_staff=True, is_superuser=False
    )
    client.force_login(staff)

    payload = {"contract_validity_days": 18}
    response = client.patch(
        "/api/v1/hahitantsoa/commercial-terms/",
        data=json.dumps(payload),
        content_type="application/json",
    )
    assert response.status_code == 200
    assert response.json()["contract_validity_days"] == 18


def test_commercial_terms_patch_non_owner_roles_refused(client: Client) -> None:
    manager = User.objects.create_user(username="mgr-patcher", password="pwd")
    _assign_role(manager, "manager")

    accountant = User.objects.create_user(username="acct-patcher", password="pwd")
    _assign_role(accountant, "accountant")

    cleaner = User.objects.create_user(username="cleaner-patcher", password="pwd")
    _assign_role(cleaner, "cleaner")

    payload = {"contract_validity_days": 30}

    # Manager
    client.force_login(manager)
    res_mgr = client.patch(
        "/api/v1/hahitantsoa/commercial-terms/",
        data=json.dumps(payload),
        content_type="application/json",
    )
    assert res_mgr.status_code == 403

    # Accountant
    client.force_login(accountant)
    res_acct = client.patch(
        "/api/v1/hahitantsoa/commercial-terms/",
        data=json.dumps(payload),
        content_type="application/json",
    )
    assert res_acct.status_code == 403

    # Cleaner
    client.force_login(cleaner)
    res_clean = client.patch(
        "/api/v1/hahitantsoa/commercial-terms/",
        data=json.dumps(payload),
        content_type="application/json",
    )
    assert res_clean.status_code == 403


def test_commercial_terms_patch_stale_in_memory_revocation_refused(client: Client) -> None:
    owner = User.objects.create_user(username="owner-stale-patch", password="pwd")
    _assign_role(owner, "owner_manager")
    client.force_login(owner)

    # Revoke role assignment in DB without re-logging
    UserRoleAssignment.objects.filter(user=owner).delete()

    payload = {"contract_validity_days": 99}
    response = client.patch(
        "/api/v1/hahitantsoa/commercial-terms/",
        data=json.dumps(payload),
        content_type="application/json",
    )
    assert response.status_code == 403

    # Verify no audit event and no DB update
    terms = get_hahitantsoa_commercial_terms()
    terms.refresh_from_db()
    assert terms.contract_validity_days != 99


def test_commercial_terms_patch_preserves_historical_records(client: Client) -> None:
    """Historical preservation: updating commercial terms must not alter

    existing draft totals, contracts, or generated document instances retroactively.
    Also verifies that computed eve access windows (DEC-009) remain protected.
    """
    from datetime import timedelta

    from django.utils import timezone

    from apps.documents.services import (
        create_document_instance_from_hahitantsoa_event_draft,
        generate_hahitantsoa_event_draft_document_instance_html,
    )
    from apps.hahitantsoa.commercial_terms import (
        get_hahitantsoa_contract_article_3_access_text,
    )

    start_at = timezone.now() + timedelta(days=10)
    end_at = start_at + timedelta(hours=6)

    terms = get_hahitantsoa_commercial_terms()
    customer = Customer.objects.create(display_name="Client Historique")

    # Create an event draft with base rental
    draft = HahitantsoaEventDraft.objects.create(
        customer=customer,
        event_name="Fête Historique",
        start_at=start_at,
        end_at=end_at,
        guest_count=200,
        duration_option=HahitantsoaDurationOption.DAY,
        space_rental_amount=calculate_space_rental_amount(
            terms=terms, guest_count=200, duration_option=HahitantsoaDurationOption.DAY
        ),
        total_amount=Decimal("6500000.00"),
        required_deposit_amount=Decimal("1000000.00"),
    )
    original_space_rental = draft.space_rental_amount
    original_deposit = draft.required_deposit_amount

    doc = create_document_instance_from_hahitantsoa_event_draft(
        event_draft=draft,
        template_key="hahitantsoa.proforma.v1",
    )
    generate_hahitantsoa_event_draft_document_instance_html(
        event_draft=draft,
        document_instance_id=doc.id,
    )
    doc.refresh_from_db()
    original_checksum = doc.content_checksum
    original_validity_days = doc.proforma_validity_days
    assert doc.status == "generated"

    # Verify Article 3 eve access schedule calculation (DEC-009)
    article_3_text = get_hahitantsoa_contract_article_3_access_text(event_draft=draft)
    assert "15 heures 30" in article_3_text  # Case 1: no prior event on D-1

    # Update terms via owner_manager PATCH with radically higher rates
    owner = User.objects.create_user(username="owner-history", password="pwd")
    _assign_role(owner, "owner_manager")
    client.force_login(owner)

    response = client.patch(
        "/api/v1/hahitantsoa/commercial-terms/",
        data=json.dumps(
            {
                "base_space_rental_amount": "9500000.00",
                "bare_deposit_amount": "2000000.00",
                "contract_validity_days": 45,
                "excess_guest_amount": "10000.00",
            }
        ),
        content_type="application/json",
    )
    assert response.status_code == 200

    # Ensure existing draft space rental and deposit amounts are NOT modified retroactively
    draft.refresh_from_db()
    assert draft.space_rental_amount == original_space_rental
    assert draft.required_deposit_amount == original_deposit

    # Ensure existing generated document instance checksum and validity remain unchanged
    doc.refresh_from_db()
    assert doc.content_checksum == original_checksum
    assert doc.proforma_validity_days == original_validity_days

    # Ensure Article 3 access schedule is computed dynamically and untouched by terms patch
    post_patch_article_3 = get_hahitantsoa_contract_article_3_access_text(event_draft=draft)
    assert post_patch_article_3 == article_3_text
