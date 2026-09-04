from io import StringIO

from django.core.management import call_command
from django.test import TestCase, override_settings

from apps.common.management.commands.seed_browser_acceptance_titan_fixture import (
    FIXTURE_ITEM_NAME,
)
from apps.inventory.models import InventoryAvailability, InventoryItem


@override_settings(DEBUG=True)
class SeedBrowserAcceptanceTitanFixtureTests(TestCase):
    def test_creates_one_active_available_titan_item_idempotently(self) -> None:
        call_command("seed_browser_acceptance_titan_fixture", stdout=StringIO())
        call_command("seed_browser_acceptance_titan_fixture", stdout=StringIO())

        item = InventoryItem.objects.get(name=FIXTURE_ITEM_NAME)

        self.assertEqual(InventoryItem.objects.filter(name=FIXTURE_ITEM_NAME).count(), 1)
        self.assertEqual(item.kind, "material")
        self.assertTrue(item.is_active)
        self.assertFalse(item.is_deleted)
        self.assertEqual(item.reported_inventory_quantity, 1)
        self.assertEqual(item.reported_damaged_quantity, 0)
        self.assertEqual(str(item.rental_price), "100000.00")
        self.assertFalse(InventoryAvailability.objects.filter(inventory_item=item).exists())
