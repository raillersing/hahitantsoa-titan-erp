from django.conf import settings
from django.core.management.base import BaseCommand

from apps.inventory.models import InventoryItem
from apps.inventory.scope import InventoryItemKind

DEMO_INVENTORY_ITEMS = (
    {
        "name": "Sonorisation standard",
        "kind": InventoryItemKind.MATERIAL.value,
        "description": "Ensemble audio de demonstration pour catalogue materiel.",
    },
    {
        "name": "Projecteur LED",
        "kind": InventoryItemKind.ARTICLE.value,
        "description": "Projecteur compact pour demonstration du catalogue articles.",
    },
    {
        "name": "Pack sonorisation + eclairage",
        "kind": InventoryItemKind.MATERIAL_PACK.value,
        "description": "Pack materiel de demonstration compose d'audio et de lumiere.",
    },
)


class Command(BaseCommand):
    help = "Seed local demonstration InventoryItem data."

    def handle(self, *args, **options) -> None:
        if not settings.DEBUG:
            self.stdout.write(
                self.style.WARNING("Refusing to seed demo inventory when DEBUG is False.")
            )
            return

        created_count = 0
        updated_count = 0

        for item_data in DEMO_INVENTORY_ITEMS:
            item = InventoryItem.objects.filter(name=item_data["name"]).first()

            if item is None:
                item = InventoryItem(
                    name=item_data["name"],
                    kind=item_data["kind"],
                    description=item_data["description"],
                    is_active=True,
                    is_deleted=False,
                    deleted_at=None,
                )
                item.full_clean()
                item.save()
                created_count += 1
                continue

            item.kind = item_data["kind"]
            item.description = item_data["description"]
            item.is_active = True
            item.is_deleted = False
            item.deleted_at = None
            item.full_clean()
            item.save(
                update_fields=[
                    "kind",
                    "description",
                    "is_active",
                    "is_deleted",
                    "deleted_at",
                    "updated_at",
                ]
            )
            updated_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Demo inventory seed completed: {created_count} created, {updated_count} updated."
            )
        )
