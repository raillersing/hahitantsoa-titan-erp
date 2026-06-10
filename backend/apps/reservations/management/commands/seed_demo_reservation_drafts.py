from datetime import timedelta

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.customers.models import Customer
from apps.inventory.models import InventoryItem
from apps.reservations.models import (
    ReservationDraft,
    ReservationDraftLine,
    ReservationDraftStatus,
)


class Command(BaseCommand):
    help = "Seed local demonstration ReservationDraft data."

    def handle(self, *args, **options) -> None:
        if not settings.DEBUG:
            self.stdout.write(
                self.style.WARNING("Refusing to seed demo reservation drafts when DEBUG is False.")
            )
            return

        call_command("seed_demo_customers")
        call_command("seed_demo_inventory")

        customer = Customer.objects.get(display_name="Client demo Titan")
        inventory_items = tuple(InventoryItem.objects.order_by("name")[:2])

        if not inventory_items:
            self.stdout.write(self.style.WARNING("No inventory items available."))
            return

        start_at = timezone.now().replace(microsecond=0) + timedelta(days=1)
        end_at = start_at + timedelta(hours=4)

        draft, created = ReservationDraft.objects.update_or_create(
            public_reference="RD-DEMO-TITAN-001",
            defaults={
                "customer": customer,
                "status": ReservationDraftStatus.DRAFT,
                "start_at": start_at,
                "end_at": end_at,
                "notes": "F100 demo reservation draft for Titan material rental.",
                "is_deleted": False,
                "deleted_at": None,
            },
        )

        ReservationDraftLine.objects.filter(reservation_draft=draft).delete()
        for inventory_item in inventory_items:
            ReservationDraftLine.objects.create(
                reservation_draft=draft,
                inventory_item=inventory_item,
                quantity=1,
                notes="F100 demo draft line.",
            )

        action = "created" if created else "updated"
        self.stdout.write(
            self.style.SUCCESS(f"Demo reservation draft {action}: {draft.public_reference}.")
        )
