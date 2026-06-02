import os

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Seed a standard development user for local Django session login."

    def handle(self, *args, **options) -> None:
        username = os.environ.get("DJANGO_DEV_USERNAME")
        password = os.environ.get("DJANGO_DEV_PASSWORD")
        email = os.environ.get("DJANGO_DEV_EMAIL")

        if not settings.DEBUG:
            self.stdout.write(
                self.style.WARNING("Refusing to seed a dev user when DEBUG is False.")
            )
            return

        if not username or not password:
            self.stdout.write(
                self.style.WARNING(
                    "DJANGO_DEV_USERNAME and DJANGO_DEV_PASSWORD are required to seed a dev user."
                )
            )
            return

        user_model = get_user_model()
        user, created = user_model.objects.get_or_create(
            username=username,
            defaults={
                "email": email or "",
                "is_active": True,
                "is_staff": False,
                "is_superuser": False,
            },
        )

        user.set_password(password)
        user.is_active = True
        user.is_staff = False
        user.is_superuser = False
        if email is not None:
            user.email = email
        user.save(update_fields=["password", "email", "is_active", "is_staff", "is_superuser"])

        message = "Development user created." if created else "Development user updated."
        self.stdout.write(self.style.SUCCESS(message))
