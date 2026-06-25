from django.conf import settings
from django.core.management.base import BaseCommand

from apps.customers.models import Customer

DEMO_CUSTOMERS = (
    {
        "display_name": "Client demo Hahitantsoa",
        "email": "hahitantsoa.client@example.test",
        "phone": "+261 34 00 000 01",
        "address": "Antananarivo",
        "notes": "F99 demo customer for Hahitantsoa event workflows.",
    },
    {
        "display_name": "Client demo Titan",
        "email": "titan.client@example.test",
        "phone": "+261 34 00 000 02",
        "address": "Antananarivo",
        "notes": "F99 demo customer for Titan material rental workflows.",
    },
    {
        "display_name": "SARL Event Plus",
        "email": "contact@eventplus.test",
        "phone": "+261 34 00 000 11",
        "address": "Ambatonakanga, Antananarivo",
        "notes": "Client professionnel organisant des evenements d'entreprise.",
    },
    {
        "display_name": "Mairie d'Analakely",
        "email": "mairie.analakely@example.test",
        "phone": "+261 34 00 000 22",
        "address": "Analakely, Antananarivo",
        "notes": "Collectivite locale pour evenements publics et ceremonies.",
    },
)


class Command(BaseCommand):
    help = "Seed local demonstration Customer data."

    def handle(self, *args, **options) -> None:
        if not settings.DEBUG:
            self.stdout.write(
                self.style.WARNING("Refusing to seed demo customers when DEBUG is False.")
            )
            return

        created_count = 0
        updated_count = 0

        for customer_data in DEMO_CUSTOMERS:
            customer = Customer.objects.filter(display_name=customer_data["display_name"]).first()

            if customer is None:
                customer = Customer(
                    display_name=customer_data["display_name"],
                    email=customer_data["email"],
                    phone=customer_data["phone"],
                    address=customer_data["address"],
                    notes=customer_data["notes"],
                    is_active=True,
                    is_deleted=False,
                    deleted_at=None,
                )
                customer.full_clean()
                customer.save()
                created_count += 1
                continue

            customer.email = customer_data["email"]
            customer.phone = customer_data["phone"]
            customer.address = customer_data["address"]
            customer.notes = customer_data["notes"]
            customer.is_active = True
            customer.is_deleted = False
            customer.deleted_at = None
            customer.full_clean()
            customer.save(
                update_fields=[
                    "email",
                    "phone",
                    "address",
                    "notes",
                    "is_active",
                    "is_deleted",
                    "deleted_at",
                    "updated_at",
                ]
            )
            updated_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Demo customers seed completed: {created_count} created, {updated_count} updated."
            )
        )
