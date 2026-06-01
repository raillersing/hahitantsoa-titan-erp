from django.core.management import call_command


def test_django_foundation_system_check() -> None:
    call_command("check")
