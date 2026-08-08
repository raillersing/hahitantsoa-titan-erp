"""Tests pipeline prospect : transitions et conversion prospect → client."""

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group

from apps.customers.models import Customer, CustomerLifecycleStatus, ProspectStatus
from apps.customers.services import (
    CustomerConversionError,
    ProspectTransitionError,
    convert_prospect_to_client,
    transition_prospect_status,
)
from apps.identity.roles import IdentityRole

pytestmark = pytest.mark.django_db

User = get_user_model()


@pytest.fixture
def staff_user():
    return User.objects.create_user(username="staff", password="test-pass", is_staff=True)


@pytest.fixture
def regular_user():
    return User.objects.create_user(username="regular", password="test-pass")


@pytest.fixture
def operator_user():
    user = User.objects.create_user(username="operator", password="test-pass")
    group = Group.objects.create(name=IdentityRole.RESERVATION_SENSITIVE_OPERATOR.value)
    user.groups.add(group)
    return user


@pytest.fixture
def staff_client(client, staff_user):
    client.force_login(staff_user)
    return client


@pytest.fixture
def regular_client(client, regular_user):
    client.force_login(regular_user)
    return client


@pytest.fixture
def operator_client(client, operator_user):
    client.force_login(operator_user)
    return client


@pytest.fixture
def prospect():
    return Customer.objects.create(
        display_name="Test Prospect",
        lifecycle_status=CustomerLifecycleStatus.PROSPECT,
        prospect_status=ProspectStatus.NEW,
    )


class TestProspectPipelineTransitions:
    def test_new_to_contacted(self, prospect, staff_user):
        result = transition_prospect_status(
            customer=prospect,
            target_status=ProspectStatus.CONTACTED,
            actor=staff_user,
            reason="Premier contact",
        )
        assert result.prospect_status == ProspectStatus.CONTACTED
        assert result.prospect_status_reason == "Premier contact"

    def test_contacted_to_qualified(self, prospect, staff_user):
        prospect.prospect_status = ProspectStatus.CONTACTED
        prospect.save(update_fields=["prospect_status"])
        result = transition_prospect_status(
            customer=prospect,
            target_status=ProspectStatus.QUALIFIED,
            actor=staff_user,
        )
        assert result.prospect_status == ProspectStatus.QUALIFIED

    def test_qualified_to_proforma_sent(self, prospect, staff_user):
        prospect.prospect_status = ProspectStatus.QUALIFIED
        prospect.save(update_fields=["prospect_status"])
        result = transition_prospect_status(
            customer=prospect,
            target_status=ProspectStatus.PROFORMA_SENT,
            actor=staff_user,
        )
        assert result.prospect_status == ProspectStatus.PROFORMA_SENT

    def test_invalid_transition_raises(self, prospect, staff_user):
        with pytest.raises(ProspectTransitionError):
            transition_prospect_status(
                customer=prospect,
                target_status=ProspectStatus.PROFORMA_SENT,
                actor=staff_user,
            )

    def test_terminal_disqualified_requires_reason(self, prospect, staff_user):
        with pytest.raises(ProspectTransitionError):
            transition_prospect_status(
                customer=prospect,
                target_status=ProspectStatus.DISQUALIFIED,
                actor=staff_user,
            )

    def test_terminal_lost_requires_reason(self, prospect, staff_user):
        with pytest.raises(ProspectTransitionError):
            transition_prospect_status(
                customer=prospect,
                target_status=ProspectStatus.LOST,
                actor=staff_user,
            )

    def test_reopening_lost_requires_reason(self, prospect, staff_user):
        prospect.prospect_status = ProspectStatus.LOST
        prospect.save(update_fields=["prospect_status"])
        with pytest.raises(ProspectTransitionError):
            transition_prospect_status(
                customer=prospect,
                target_status=ProspectStatus.NEW,
                actor=staff_user,
            )

    def test_non_prospect_transition_raises(self, staff_user):
        customer = Customer.objects.create(
            display_name="Client",
            lifecycle_status=CustomerLifecycleStatus.CLIENT,
        )
        with pytest.raises(ProspectTransitionError):
            transition_prospect_status(
                customer=customer,
                target_status=ProspectStatus.CONTACTED,
                actor=staff_user,
            )

    def test_full_pipeline_new_to_proforma_sent(self, prospect, staff_user):
        # new → contacted
        prospect = transition_prospect_status(
            customer=prospect,
            target_status=ProspectStatus.CONTACTED,
            actor=staff_user,
            reason="Appel téléphonique",
        )
        # contacted → qualified
        prospect = transition_prospect_status(
            customer=prospect,
            target_status=ProspectStatus.QUALIFIED,
            actor=staff_user,
        )
        # qualified → proforma_sent
        prospect = transition_prospect_status(
            customer=prospect,
            target_status=ProspectStatus.PROFORMA_SENT,
            actor=staff_user,
        )
        assert prospect.prospect_status == ProspectStatus.PROFORMA_SENT


class TestProspectConversion:
    def test_convert_prospect_to_client(self, prospect, staff_user):
        prospect.prospect_status = ProspectStatus.PROFORMA_SENT
        prospect.save(update_fields=["prospect_status"])
        result = convert_prospect_to_client(customer=prospect, actor=staff_user)
        assert result.lifecycle_status == CustomerLifecycleStatus.CLIENT
        assert result.prospect_status == ProspectStatus.CONVERTED

    def test_convert_non_prospect_raises(self, staff_user):
        customer = Customer.objects.create(
            display_name="Already Client",
            lifecycle_status=CustomerLifecycleStatus.CLIENT,
        )
        with pytest.raises(CustomerConversionError):
            convert_prospect_to_client(customer=customer, actor=staff_user)


class TestProspectStatusEndpointAuthorization:
    def test_prospect_status_unauthenticated(self, client, prospect):
        url = f"/api/v1/customers/{prospect.id}/prospect-status/"
        response = client.post(
            url,
            {"prospect_status": ProspectStatus.CONTACTED},
            content_type="application/json",
        )
        assert response.status_code in {401, 403}

    def test_prospect_status_regular_forbidden(self, regular_client, prospect):
        url = f"/api/v1/customers/{prospect.id}/prospect-status/"
        response = regular_client.post(
            url,
            {"prospect_status": ProspectStatus.CONTACTED},
            content_type="application/json",
        )
        assert response.status_code == 403

    def test_prospect_status_staff_success(self, staff_client, prospect):
        url = f"/api/v1/customers/{prospect.id}/prospect-status/"
        response = staff_client.post(
            url,
            {"prospect_status": ProspectStatus.CONTACTED, "reason": "Test"},
            content_type="application/json",
        )
        assert response.status_code == 200
        data = response.json()
        assert data["prospect_status"] == ProspectStatus.CONTACTED

    def test_prospect_status_operator_success(self, operator_client, prospect):
        url = f"/api/v1/customers/{prospect.id}/prospect-status/"
        response = operator_client.post(
            url,
            {"prospect_status": ProspectStatus.CONTACTED, "reason": "Test"},
            content_type="application/json",
        )
        assert response.status_code == 200

    def test_convert_unauthenticated(self, client, prospect):
        url = f"/api/v1/customers/{prospect.id}/convert/"
        response = client.post(url, {}, content_type="application/json")
        assert response.status_code in {401, 403}

    def test_convert_regular_forbidden(self, regular_client, prospect):
        url = f"/api/v1/customers/{prospect.id}/convert/"
        response = regular_client.post(url, {}, content_type="application/json")
        assert response.status_code == 403

    def test_convert_staff_success(self, staff_client, prospect):
        url = f"/api/v1/customers/{prospect.id}/convert/"
        response = staff_client.post(url, {}, content_type="application/json")
        assert response.status_code == 200
        data = response.json()
        assert data["lifecycle_status"] == CustomerLifecycleStatus.CLIENT.value
        assert data["prospect_status"] == ProspectStatus.CONVERTED.value


class TestTimelineAuthorization:
    def test_timeline_unauthenticated(self, client, prospect):
        url = f"/api/v1/customers/{prospect.id}/timeline/"
        response = client.get(url)
        assert response.status_code in {401, 403}

    def test_timeline_regular_allowed(self, regular_client, prospect):
        url = f"/api/v1/customers/{prospect.id}/timeline/"
        response = regular_client.get(url)
        assert response.status_code == 200

    def test_timeline_staff_allowed(self, staff_client, prospect):
        url = f"/api/v1/customers/{prospect.id}/timeline/"
        response = staff_client.get(url)
        assert response.status_code == 200


class TestReportsAuthorization:
    def test_reports_unauthenticated(self, client):
        url = "/api/v1/reports/prospects/"
        response = client.get(url)
        assert response.status_code in {401, 403}

    def test_reports_regular_forbidden(self, regular_client):
        url = "/api/v1/reports/prospects/"
        response = regular_client.get(url)
        assert response.status_code == 403

    def test_reports_staff_allowed(self, staff_client):
        url = "/api/v1/reports/prospects/"
        response = staff_client.get(url)
        assert response.status_code == 200
        data = response.json()
        assert "kpis" in data or "data" in data

    def test_reports_operator_allowed(self, operator_client):
        url = "/api/v1/reports/prospects/"
        response = operator_client.get(url)
        assert response.status_code == 200
