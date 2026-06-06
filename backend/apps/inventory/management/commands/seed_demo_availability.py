from datetime import datetime, timedelta

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.inventory.models import (
    InventoryAvailability,
    InventoryAvailabilityStatus,
    InventoryItem,
)

DEMO_AVAILABILITY_PERIOD_HOURS = 2
DEMO_AVAILABILITY_ENTRIES = (
    {
        "inventory_item_name": "Sonorisation standard",
        "status": InventoryAvailabilityStatus.BLOCKED,
        "notes": "F65 demo availability: blocked",
    },
    {
        "inventory_item_name": "Projecteur LED",
        "status": InventoryAvailabilityStatus.RESERVED,
        "notes": "F65 demo availability: reserved",
    },
)


def next_hour(value: datetime) -> datetime:
    return value.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)


class Command(BaseCommand):
    help = "Seed local demonstration InventoryAvailability data."

    def handle(self, *args, **options) -> None:
        if not settings.DEBUG:
            self.stdout.write(
                self.style.WARNING("Refusing to seed demo availability when DEBUG is False.")
            )
            return

        start_at = next_hour(timezone.now())
        end_at = start_at + timedelta(hours=DEMO_AVAILABILITY_PERIOD_HOURS)
        created_count = 0
        updated_count = 0
        skipped_count = 0

        for entry in DEMO_AVAILABILITY_ENTRIES:
            inventory_item = InventoryItem.objects.filter(name=entry["inventory_item_name"]).first()
            if inventory_item is None:
                self.stdout.write(
                    self.style.WARNING(
                        f"Skipping missing demo inventory item: {entry['inventory_item_name']}."
                    )
                )
                skipped_count += 1
                continue

            availability = InventoryAvailability.objects.filter(
                inventory_item=inventory_item,
                notes=entry["notes"],
            ).first()

            if availability is None:
                availability = InventoryAvailability(
                    inventory_item=inventory_item,
                    status=entry["status"],
                    start_at=start_at,
                    end_at=end_at,
                    notes=entry["notes"],
                )
                availability.full_clean()
                availability.save()
                created_count += 1
                continue

            availability.status = entry["status"]
            availability.start_at = start_at
            availability.end_at = end_at
            availability.is_deleted = False
            availability.deleted_at = None
            availability.full_clean()
            availability.save(
                update_fields=[
                    "status",
                    "start_at",
                    "end_at",
                    "is_deleted",
                    "deleted_at",
                    "updated_at",
                ]
            )
            updated_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                "Demo availability seed completed: "
                f"{created_count} created, {updated_count} updated, "
                f"{skipped_count} skipped. "
                f"Period: {start_at.isoformat()} to {end_at.isoformat()}."
            )
        )
