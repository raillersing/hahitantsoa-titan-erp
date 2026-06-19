import uuid

import pytest

from apps.customers.models import Customer

pytestmark = pytest.mark.django_db

CUSTOMER_LIST_URL = "/api/v1/customers/"


@pytest.fixture
def authenticated_client(client, django_user_model):
    user = django_user_model.objects.create_user(
        username="customer-reader",
        password="test-password",
    )
    client.force_login(user)
    return client


def _create_customer(
    display_name: str,
    *,
    is_active: bool = True,
    is_deleted: bool = False,
) -> Customer:
    return Customer.objects.create(
        display_name=display_name,
        email=f"{display_name.lower().replace(' ', '.')}@example.test",
        phone="+261 34 00 000 00",
        address="Antananarivo",
        notes="Test customer.",
        is_active=is_active,
        is_deleted=is_deleted,
    )


def test_customer_list_rejects_unauthenticated_user(client) -> None:
    response = client.get(CUSTOMER_LIST_URL)

    assert response.status_code in {401, 403}


def test_authenticated_user_can_read_active_customers(authenticated_client) -> None:
    active_customer = _create_customer("Active Customer")
    _create_customer("Inactive Customer", is_active=False)
    _create_customer("Deleted Customer", is_deleted=True)

    response = authenticated_client.get(CUSTOMER_LIST_URL)

    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 1
    assert payload[0]["id"] == str(active_customer.id)
    assert payload[0]["display_name"] == "Active Customer"
    assert payload[0]["email"] == "active.customer@example.test"


def test_authenticated_user_can_read_customer_detail(authenticated_client) -> None:
    customer = _create_customer("Detail Customer")

    response = authenticated_client.get(f"/api/v1/customers/{customer.id}/")

    assert response.status_code == 200
    payload = response.json()
    assert payload["id"] == str(customer.id)
    assert payload["display_name"] == "Detail Customer"


def test_customer_detail_returns_404_for_inactive_or_deleted_customer(
    authenticated_client,
) -> None:
    inactive_customer = _create_customer("Inactive Customer", is_active=False)
    deleted_customer = _create_customer("Deleted Customer", is_deleted=True)

    inactive_response = authenticated_client.get(f"/api/v1/customers/{inactive_customer.id}/")
    deleted_response = authenticated_client.get(f"/api/v1/customers/{deleted_customer.id}/")

    assert inactive_response.status_code == 404
    assert deleted_response.status_code == 404


def test_customer_detail_returns_404_for_unknown_uuid(authenticated_client) -> None:
    response = authenticated_client.get(f"/api/v1/customers/{uuid.uuid4()}/")

    assert response.status_code == 404


def test_customer_list_rejects_write_methods(authenticated_client) -> None:
    payload = {"display_name": "Write Customer"}

    post_response = authenticated_client.post(CUSTOMER_LIST_URL, data=payload)

    assert post_response.status_code == 405


@pytest.mark.parametrize("method", ["put", "patch", "delete"])
def test_customer_detail_rejects_write_methods(authenticated_client, method: str) -> None:
    customer = _create_customer("Readonly Customer")
    request_method = getattr(authenticated_client, method)

    response = request_method(
        f"/api/v1/customers/{customer.id}/",
        data={"display_name": "Updated"},
        content_type="application/json",
    )

    assert response.status_code == 405


def test_customer_list_filter_by_name(authenticated_client):
    Customer.objects.create(
        display_name="Alice Wonderland",
        email="alice@example.test",
        phone="+261340000001",
        address="Antananarivo",
    )
    Customer.objects.create(
        display_name="Bob Builder",
        email="bob@example.test",
        phone="+261340000002",
        address="Antananarivo",
    )

    response = authenticated_client.get(f"{CUSTOMER_LIST_URL}?name=Alice")
    assert response.status_code == 200
    results = response.json()
    assert len(results) == 1
    assert results[0]["display_name"] == "Alice Wonderland"


def test_customer_list_filter_by_email(authenticated_client):
    Customer.objects.create(
        display_name="Charlie Chaplin",
        email="charlie.special@example.test",
        phone="+261340000003",
        address="Antananarivo",
    )
    Customer.objects.create(
        display_name="Dave Developer",
        email="dave@example.test",
        phone="+261340000004",
        address="Antananarivo",
    )

    response = authenticated_client.get(f"{CUSTOMER_LIST_URL}?email=charlie.special")
    assert response.status_code == 200
    results = response.json()
    assert len(results) == 1
    assert results[0]["display_name"] == "Charlie Chaplin"


def test_customer_list_filter_by_phone(authenticated_client):
    Customer.objects.create(
        display_name="Eve Entrepreneur",
        email="eve@example.test",
        phone="+261340000555",
        address="Antananarivo",
    )
    Customer.objects.create(
        display_name="Frank Farmer",
        email="frank@example.test",
        phone="+261340000006",
        address="Antananarivo",
    )

    response = authenticated_client.get(f"{CUSTOMER_LIST_URL}?phone=555")
    assert response.status_code == 200
    results = response.json()
    assert len(results) == 1
    assert results[0]["display_name"] == "Eve Entrepreneur"
