from decimal import Decimal

from django.conf import settings
from django.core.management.base import BaseCommand

from apps.inventory.models import InventoryItem
from apps.inventory.scope import InventoryItemKind

FIXTURE_ITEM_NAME = "E2E Titan matériel disponible"


class Command(BaseCommand):
    help = "Seed one deterministic, available Titan item for browser acceptance."

    def handle(self, *args, **options) -> None:
        if not settings.DEBUG:
            self.stdout.write(
                self.style.WARNING("Refusing to seed browser acceptance data when DEBUG is False.")
            )
            return

        item, created = InventoryItem.objects.get_or_create(
            name=FIXTURE_ITEM_NAME,
            defaults={"kind": InventoryItemKind.MATERIAL.value},
        )
        item.kind = InventoryItemKind.MATERIAL.value
        item.description = "Fixture éphémère de recette navigateur Titan."
        item.code = "E2E-TITAN-AVAILABLE"
        item.unit = "unité"
        item.rental_price = Decimal("100000.00")
        item.breakage_price = Decimal("200000.00")
        item.reported_inventory_quantity = 1
        item.reported_damaged_quantity = 0
        item.is_active = True
        item.is_deleted = False
        item.deleted_at = None
        item.full_clean()
        item.save()

        action = "created" if created else "updated"
        self.stdout.write(
            self.style.SUCCESS(f"Browser acceptance Titan fixture {action}: {item.id}.")
        )
