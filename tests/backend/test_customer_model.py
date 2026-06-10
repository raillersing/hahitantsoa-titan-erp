import pytest
from django.core.exceptions import ValidationError

from apps.customers.models import Customer

pytestmark = pytest.mark.django_db


def test_customer_can_be_persisted_with_minimal_contact_fields() -> None:
    customer = Customer(
        display_name="Client Demo",
        email="client.demo@example.test",
        phone="+261 34 00 000 00",
        address="Antananarivo",
        notes="Demo notes.",
    )

    customer.full_clean()
    customer.save()

    persisted_customer = Customer.objects.get(pk=customer.pk)
    assert persisted_customer.display_name == "Client Demo"
    assert persisted_customer.email == "client.demo@example.test"
    assert persisted_customer.phone == "+261 34 00 000 00"
    assert persisted_customer.is_active is True
    assert persisted_customer.is_deleted is False


def test_customer_requires_display_name() -> None:
    customer = Customer(display_name="")

    with pytest.raises(ValidationError):
        customer.full_clean()


def test_customer_string_representation_uses_display_name() -> None:
    customer = Customer(display_name="Client Demo")

    assert str(customer) == "Client Demo"
