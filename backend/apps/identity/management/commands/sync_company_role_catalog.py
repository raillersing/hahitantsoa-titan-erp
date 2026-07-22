from django.core.management.base import BaseCommand, CommandError

from apps.identity.services import IdentityServiceError, sync_company_role_catalog


class Command(BaseCommand):
    help = "Create any missing company operational roles without modifying existing roles."

    def handle(self, *args, **options):
        try:
            roles = sync_company_role_catalog()
        except IdentityServiceError as exc:
            raise CommandError(str(exc)) from exc
        self.stdout.write(
            self.style.SUCCESS(f"Company role catalogue synchronized ({len(roles)} roles).")
        )
