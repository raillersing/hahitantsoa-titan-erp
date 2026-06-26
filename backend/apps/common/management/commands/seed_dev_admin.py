import os

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Seed a local admin user (staff + superuser) for testing full permissions."

    def handle(self, *args, **options) -> None:
        username = os.environ.get("DJANGO_ADMIN_USERNAME", "admin")
        password = os.environ.get("DJANGO_ADMIN_PASSWORD", "admin")
        email = os.environ.get("DJANGO_ADMIN_EMAIL", "admin@example.test")

        if not settings.DEBUG:
            self.stdout.write(
                self.style.WARNING("Refusing to seed an admin user when DEBUG is False.")
            )
            return

        user_model = get_user_model()
        user, created = user_model.objects.get_or_create(
            username=username,
            defaults={
                "email": email,
                "is_active": True,
                "is_staff": True,
                "is_superuser": True,
            },
        )

        user.set_password(password)
        user.is_active = True
        user.is_staff = True
        user.is_superuser = True
        user.email = email
        user.save(update_fields=["password", "email", "is_active", "is_staff", "is_superuser"])

        message = (
            f"Admin user '{username}' created." if created else f"Admin user '{username}' updated."
        )
        self.stdout.write(self.style.SUCCESS(message))
