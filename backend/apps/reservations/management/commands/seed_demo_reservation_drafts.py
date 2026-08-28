from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
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

DEMO_RESERVATION_DRAFTS = (
    {
        "public_reference": "RD-DEMO-TITAN-001",
        "customer_name": "Client demo Titan",
        "start_at_delta_days": 1,
        "duration_hours": 4,
        "notes": "Location materiel standard pour evenement court.",
        "line_quantity": 1,
        "status": ReservationDraftStatus.DRAFT,
    },
    {
        "public_reference": "RD-DEMO-TITAN-002",
        "customer_name": "Client demo Titan",
        "start_at_delta_days": 7,
        "duration_hours": 8,
        "notes": "Location longue duree pour conference.",
        "line_quantity": 3,
        "status": ReservationDraftStatus.DRAFT,
    },
    {
        "public_reference": "RD-DEMO-TITAN-003",
        "customer_name": "SARL Event Plus",
        "start_at_delta_days": 3,
        "duration_hours": 6,
        "notes": "Reservation avec contrat signe. En attente d'acompte.",
        "line_quantity": 2,
        "status": ReservationDraftStatus.DRAFT,
        "contract_signed": True,
    },
    {
        "public_reference": "RD-DEMO-TITAN-004",
        "customer_name": "Mairie d'Analakely",
        "start_at_delta_days": 10,
        "duration_hours": 5,
        "notes": "Reservation confirmee avec contrat et depot recu.",
        "line_quantity": 4,
        "status": ReservationDraftStatus.CONFIRMED,
        "contract_signed": True,
        "deposit_received": True,
        "confirmed": True,
    },
    {
        "public_reference": "RD-DEMO-TITAN-005",
        "customer_name": "Client demo Titan",
        "start_at_delta_days": -3,
        "duration_hours": 4,
        "notes": "Reservation passee (deja terminee) en statut confirme.",
        "line_quantity": 1,
        "status": ReservationDraftStatus.CONFIRMED,
        "contract_signed": True,
        "deposit_received": True,
        "confirmed": True,
    },
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

        User = get_user_model()
        actor, _ = User.objects.get_or_create(
            username="seed-actor",
            defaults={"is_staff": True},
        )

        inventory_items = tuple(InventoryItem.objects.order_by("name"))
        if not inventory_items:
            self.stdout.write(self.style.WARNING("No inventory items available."))
            return

        created_count = 0
        updated_count = 0

        for draft_data in DEMO_RESERVATION_DRAFTS:
            customer = Customer.objects.get(display_name=draft_data["customer_name"])

            start_at = timezone.now().replace(microsecond=0) + timedelta(
                days=draft_data["start_at_delta_days"]
            )
            end_at = start_at + timedelta(hours=draft_data["duration_hours"])

            defaults = {
                "customer": customer,
                "status": draft_data["status"],
                "start_at": start_at,
                "end_at": end_at,
                "notes": draft_data["notes"],
                "is_deleted": False,
                "deleted_at": None,
            }

            if draft_data.get("contract_signed"):
                defaults["contract_signed_at"] = start_at - timedelta(days=2)
                defaults["contract_signed_by"] = actor

            if draft_data.get("deposit_received"):
                defaults["required_deposit_received_at"] = start_at - timedelta(days=1)
                defaults["required_deposit_received_by"] = actor

            if draft_data.get("confirmed"):
                defaults["confirmed_at"] = start_at
                defaults["confirmed_by"] = actor

            draft, created = ReservationDraft.objects.update_or_create(
                public_reference=draft_data["public_reference"],
                defaults=defaults,
            )

            ReservationDraftLine.objects.filter(reservation_draft=draft).delete()
            line_count = min(draft_data["line_quantity"], len(inventory_items))
            for i in range(line_count):
                ReservationDraftLine.objects.create(
                    reservation_draft=draft,
                    inventory_item=inventory_items[i],
                    quantity=draft_data["line_quantity"],
                    notes=f"Line {i + 1} for {draft.public_reference}.",
                )

            if created:
                created_count += 1
            else:
                updated_count += 1

            action = "created" if created else "updated"
            self.stdout.write(
                self.style.SUCCESS(f"Demo reservation draft {action}: {draft.public_reference}.")
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"Demo reservation draft seed completed: {created_count} created, "
                f"{updated_count} updated."
            )
        )
