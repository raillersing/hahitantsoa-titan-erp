import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group

from apps.customers.models import Customer
from apps.identity.roles import IdentityRole

pytestmark = pytest.mark.django_db

User = get_user_model()

CUSTOMER_CREATE_URL = "/api/v1/customers/create/"


@pytest.fixture
def regular_user():
    return User.objects.create_user(username="regular", password="test-pass")


@pytest.fixture
def staff_user():
    return User.objects.create_user(username="staff", password="test-pass", is_staff=True)


@pytest.fixture
def operator_user():
    user = User.objects.create_user(username="operator", password="test-pass")
    group = Group.objects.create(name=IdentityRole.RESERVATION_SENSITIVE_OPERATOR.value)
    user.groups.add(group)
    return user


@pytest.fixture
def regular_authenticated_client(client, regular_user):
    client.force_login(regular_user)
    return client


@pytest.fixture
def staff_authenticated_client(client, staff_user):
    client.force_login(staff_user)
    return client


@pytest.fixture
def operator_authenticated_client(client, operator_user):
    client.force_login(operator_user)
    return client


# create


def test_create_unauthenticated(client):
    response = client.post(CUSTOMER_CREATE_URL, {}, content_type="application/json")
    assert response.status_code in {401, 403}


def test_create_regular_forbidden(regular_authenticated_client):
    response = regular_authenticated_client.post(
        CUSTOMER_CREATE_URL, {}, content_type="application/json"
    )
    assert response.status_code == 403


def test_create_staff_success(staff_authenticated_client):
    payload = {"display_name": "Acme Corp", "email": "acme@example.com", "phone": "555-1234"}
    response = staff_authenticated_client.post(
        CUSTOMER_CREATE_URL, payload, content_type="application/json"
    )
    assert response.status_code == 201
    data = response.json()
    assert data["display_name"] == "Acme Corp"
    assert data["email"] == "acme@example.com"
    assert Customer.objects.filter(display_name="Acme Corp").exists()


def test_create_prospect_company_preserves_initial_classification(staff_authenticated_client):
    response = staff_authenticated_client.post(
        CUSTOMER_CREATE_URL,
        {
            "display_name": "Prospect Entreprise",
            "lifecycle_status": "prospect",
            "party_type": "company",
        },
        content_type="application/json",
    )

    assert response.status_code == 201
    assert response.json()["lifecycle_status"] == "prospect"
    assert response.json()["party_type"] == "company"
    customer = Customer.objects.get(display_name="Prospect Entreprise")
    assert customer.lifecycle_status == "prospect"
    assert customer.party_type == "company"


def test_create_uses_existing_classification_defaults(staff_authenticated_client):
    response = staff_authenticated_client.post(
        CUSTOMER_CREATE_URL,
        {"display_name": "Client Particulier"},
        content_type="application/json",
    )

    assert response.status_code == 201
    assert response.json()["lifecycle_status"] == "client"
    assert response.json()["party_type"] == "individual"


@pytest.mark.parametrize(
    ("field", "value"),
    (("lifecycle_status", "lead"), ("party_type", "association")),
)
def test_create_rejects_invalid_initial_classification(staff_authenticated_client, field, value):
    response = staff_authenticated_client.post(
        CUSTOMER_CREATE_URL,
        {"display_name": "Invalid classification", field: value},
        content_type="application/json",
    )

    assert response.status_code == 400
    assert field in response.json()


def test_create_operator_success(operator_authenticated_client):
    payload = {"display_name": "Beta Ltd"}
    response = operator_authenticated_client.post(
        CUSTOMER_CREATE_URL, payload, content_type="application/json"
    )
    assert response.status_code == 201
    assert response.json()["display_name"] == "Beta Ltd"


def test_create_missing_display_name_returns_400(staff_authenticated_client):
    response = staff_authenticated_client.post(
        CUSTOMER_CREATE_URL, {"email": "a@b.com"}, content_type="application/json"
    )
    assert response.status_code == 400


# update


def test_update_unauthenticated(client):
    customer = Customer.objects.create(display_name="Old Name")
    url = f"/api/v1/customers/{customer.id}/update/"
    response = client.post(url, {}, content_type="application/json")
    assert response.status_code in {401, 403}


def test_update_regular_forbidden(regular_authenticated_client):
    customer = Customer.objects.create(display_name="Old Name")
    url = f"/api/v1/customers/{customer.id}/update/"
    response = regular_authenticated_client.post(url, {}, content_type="application/json")
    assert response.status_code == 403


def test_update_staff_success(staff_authenticated_client):
    customer = Customer.objects.create(display_name="Old Name")
    url = f"/api/v1/customers/{customer.id}/update/"
    response = staff_authenticated_client.post(
        url, {"display_name": "New Name"}, content_type="application/json"
    )
    assert response.status_code == 200
    data = response.json()
    assert data["display_name"] == "New Name"
    customer.refresh_from_db()
    assert customer.display_name == "New Name"


def test_update_does_not_transition_lifecycle_or_party_type(staff_authenticated_client):
    customer = Customer.objects.create(display_name="Existing Customer")
    url = f"/api/v1/customers/{customer.id}/update/"
    response = staff_authenticated_client.post(
        url,
        {"lifecycle_status": "prospect", "party_type": "company"},
        content_type="application/json",
    )

    assert response.status_code == 200
    customer.refresh_from_db()
    assert customer.lifecycle_status == "client"
    assert customer.party_type == "individual"


def test_update_not_found_returns_404(staff_authenticated_client):
    url = "/api/v1/customers/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/update/"
    response = staff_authenticated_client.post(url, {}, content_type="application/json")
    assert response.status_code == 404


def test_update_deleted_customer_returns_404(staff_authenticated_client):
    from django.utils import timezone

    customer = Customer.objects.create(
        display_name="Gone", is_deleted=True, deleted_at=timezone.now()
    )
    url = f"/api/v1/customers/{customer.id}/update/"
    response = staff_authenticated_client.post(
        url, {"display_name": "Try"}, content_type="application/json"
    )
    assert response.status_code == 404


# soft delete


def test_soft_delete_unauthenticated(client):
    customer = Customer.objects.create(display_name="Delete Me")
    url = f"/api/v1/customers/{customer.id}/delete/"
    response = client.post(url, {}, content_type="application/json")
    assert response.status_code in {401, 403}


def test_soft_delete_regular_forbidden(regular_authenticated_client):
    customer = Customer.objects.create(display_name="Delete Me")
    url = f"/api/v1/customers/{customer.id}/delete/"
    response = regular_authenticated_client.post(url, {}, content_type="application/json")
    assert response.status_code == 403


def test_soft_delete_staff_success(staff_authenticated_client):
    customer = Customer.objects.create(display_name="Delete Me")
    url = f"/api/v1/customers/{customer.id}/delete/"
    response = staff_authenticated_client.post(url, {}, content_type="application/json")
    assert response.status_code == 200
    assert response.json()["detail"] == "Customer soft-deleted."
    customer.refresh_from_db()
    assert customer.is_deleted is True


def test_soft_delete_not_found_returns_404(staff_authenticated_client):
    url = "/api/v1/customers/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/delete/"
    response = staff_authenticated_client.post(url, {}, content_type="application/json")
    assert response.status_code == 404


def test_soft_delete_already_deleted_returns_404(staff_authenticated_client):
    from django.utils import timezone

    customer = Customer.objects.create(
        display_name="Already Gone", is_deleted=True, deleted_at=timezone.now()
    )
    url = f"/api/v1/customers/{customer.id}/delete/"
    response = staff_authenticated_client.post(url, {}, content_type="application/json")
    assert response.status_code == 404
