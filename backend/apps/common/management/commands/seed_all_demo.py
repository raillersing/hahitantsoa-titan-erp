from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand

SEED_ORDER = (
    "seed_demo_customers",
    "seed_demo_inventory",
    "seed_demo_availability",
    "seed_demo_reservation_drafts",
    "seed_demo_hahitantsoa_event_drafts",
    "seed_dev_user",
)


class Command(BaseCommand):
    help = "Run all demo seed commands in dependency order."

    def handle(self, *args, **options) -> None:
        if not settings.DEBUG:
            self.stdout.write(self.style.WARNING("Refusing to seed demo data when DEBUG is False."))
            return

        total = len(SEED_ORDER)

        for index, seed_command in enumerate(SEED_ORDER, start=1):
            self.stdout.write(f"[{index}/{total}] Running {seed_command} ...")
            call_command(seed_command, stdout=self.stdout)
            self.stdout.write(self.style.SUCCESS(f"[{index}/{total}] {seed_command} done."))
            self.stdout.write("")

        self.stdout.write(
            self.style.SUCCESS(f"All {total} demo seed commands completed successfully.")
        )
