import pytest
from django.core.management import call_command

from apps.customers.management.commands.seed_demo_customers import DEMO_CUSTOMERS
from apps.customers.models import Customer

pytestmark = pytest.mark.django_db


def test_seed_demo_customers_refuses_when_debug_false(settings, capsys) -> None:
    settings.DEBUG = False

    call_command("seed_demo_customers")

    assert Customer.objects.exists() is False
    assert "Refusing to seed demo customers when DEBUG is False." in capsys.readouterr().out


def test_seed_demo_customers_creates_demo_customers(settings) -> None:
    settings.DEBUG = True

    call_command("seed_demo_customers")

    assert Customer.objects.count() == len(DEMO_CUSTOMERS)
    assert set(Customer.objects.values_list("display_name", flat=True)) == {
        customer["display_name"] for customer in DEMO_CUSTOMERS
    }


def test_seed_demo_customers_is_idempotent_and_updates_existing_rows(settings) -> None:
    settings.DEBUG = True
    call_command("seed_demo_customers")

    customer = Customer.objects.get(display_name=DEMO_CUSTOMERS[0]["display_name"])
    customer.email = "old@example.test"
    customer.is_active = False
    customer.is_deleted = True
    customer.save(update_fields=["email", "is_active", "is_deleted", "updated_at"])

    call_command("seed_demo_customers")

    customer.refresh_from_db()
    assert Customer.objects.count() == len(DEMO_CUSTOMERS)
    assert customer.email == DEMO_CUSTOMERS[0]["email"]
    assert customer.is_active is True
    assert customer.is_deleted is False
