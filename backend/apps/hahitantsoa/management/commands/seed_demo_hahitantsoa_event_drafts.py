from datetime import timedelta

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.customers.models import Customer
from apps.hahitantsoa.models import (
    HahitantsoaEventDraft,
    HahitantsoaEventDraftLine,
    HahitantsoaEventDraftStatus,
)
from apps.inventory.models import InventoryItem

DEMO_EVENT_DRAFTS = (
    {
        "public_reference": "ED-DEMO-HAH-001",
        "event_name": "Conference annuelle Tech Summit",
        "venue_name": "Hotel Carlton Antananarivo",
        "start_at_delta_days": 14,
        "duration_hours": 8,
        "notes": "Conference avec sonorisation et projection pour 200 invites.",
        "status": HahitantsoaEventDraftStatus.DRAFT,
    },
    {
        "public_reference": "ED-DEMO-HAH-002",
        "event_name": "Mariage Raharison",
        "venue_name": "Domaine de la Vallee, Ambohimanga",
        "start_at_delta_days": 30,
        "duration_hours": 6,
        "notes": "Reception de mariage avec pack eclairange et sonorisation.",
        "status": HahitantsoaEventDraftStatus.DRAFT,
    },
    {
        "public_reference": "ED-DEMO-HAH-003",
        "event_name": "Seminaire formation ERP",
        "venue_name": "Centre de conference Ivandry",
        "start_at_delta_days": 45,
        "duration_hours": 5,
        "notes": "Seminaire de formation pour 50 participants.",
        "status": HahitantsoaEventDraftStatus.DRAFT,
    },
)


class Command(BaseCommand):
    help = "Seed local demonstration HahitantsoaEventDraft data."

    def handle(self, *args, **options) -> None:
        if not settings.DEBUG:
            self.stdout.write(
                self.style.WARNING("Refusing to seed demo event drafts when DEBUG is False.")
            )
            return

        call_command("seed_demo_customers")
        call_command("seed_demo_inventory")

        customer = Customer.objects.get(display_name="Client demo Hahitantsoa")
        inventory_items = tuple(InventoryItem.objects.order_by("name")[:2])

        if not inventory_items:
            self.stdout.write(self.style.WARNING("No inventory items available."))
            return

        created_count = 0
        updated_count = 0

        for draft_data in DEMO_EVENT_DRAFTS:
            start_at = timezone.now().replace(microsecond=0) + timedelta(
                days=draft_data["start_at_delta_days"]
            )
            end_at = start_at + timedelta(hours=draft_data["duration_hours"])

            draft, created = HahitantsoaEventDraft.objects.update_or_create(
                public_reference=draft_data["public_reference"],
                defaults={
                    "customer": customer,
                    "event_name": draft_data["event_name"],
                    "venue_name": draft_data["venue_name"],
                    "status": draft_data["status"],
                    "start_at": start_at,
                    "end_at": end_at,
                    "notes": draft_data["notes"],
                    "is_deleted": False,
                    "deleted_at": None,
                },
            )

            HahitantsoaEventDraftLine.objects.filter(event_draft=draft).delete()
            for inventory_item in inventory_items:
                HahitantsoaEventDraftLine.objects.create(
                    event_draft=draft,
                    inventory_item=inventory_item,
                    quantity=2,
                )

            if created:
                created_count += 1
            else:
                updated_count += 1

            action = "created" if created else "updated"
            self.stdout.write(
                self.style.SUCCESS(f"Demo event draft {action}: {draft.public_reference}.")
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"Demo event draft seed completed: {created_count} created, "
                f"{updated_count} updated."
            )
        )
