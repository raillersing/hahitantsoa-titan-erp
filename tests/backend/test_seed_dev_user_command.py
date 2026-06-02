from io import StringIO

import pytest
from django.core.management import call_command
from django.test import override_settings

MISSING_ENV_MESSAGE = "DJANGO_DEV_USERNAME and DJANGO_DEV_PASSWORD are required to seed a dev user."
DEBUG_FALSE_MESSAGE = "Refusing to seed a dev user when DEBUG is False."


def _call_seed_dev_user() -> str:
    output = StringIO()
    call_command("seed_dev_user", stdout=output)
    return output.getvalue()


@pytest.mark.django_db
def test_seed_dev_user_does_not_create_user_without_username(
    monkeypatch,
    django_user_model,
) -> None:
    monkeypatch.delenv("DJANGO_DEV_USERNAME", raising=False)
    monkeypatch.setenv("DJANGO_DEV_PASSWORD", "LocalPassword123!")

    with override_settings(DEBUG=True):
        output = _call_seed_dev_user()

    assert django_user_model.objects.count() == 0
    assert MISSING_ENV_MESSAGE in output
    assert "LocalPassword123!" not in output


@pytest.mark.django_db
def test_seed_dev_user_does_not_create_user_without_password(
    monkeypatch,
    django_user_model,
) -> None:
    monkeypatch.setenv("DJANGO_DEV_USERNAME", "dev.local")
    monkeypatch.delenv("DJANGO_DEV_PASSWORD", raising=False)

    with override_settings(DEBUG=True):
        output = _call_seed_dev_user()

    assert django_user_model.objects.count() == 0
    assert MISSING_ENV_MESSAGE in output


@pytest.mark.django_db
def test_seed_dev_user_refuses_when_debug_is_false(
    monkeypatch,
    django_user_model,
) -> None:
    monkeypatch.setenv("DJANGO_DEV_USERNAME", "dev.local")
    monkeypatch.setenv("DJANGO_DEV_PASSWORD", "LocalPassword123!")

    with override_settings(DEBUG=False):
        output = _call_seed_dev_user()

    assert django_user_model.objects.count() == 0
    assert DEBUG_FALSE_MESSAGE in output
    assert "LocalPassword123!" not in output


@pytest.mark.django_db
def test_seed_dev_user_creates_standard_user(monkeypatch, django_user_model) -> None:
    monkeypatch.setenv("DJANGO_DEV_USERNAME", "dev.local")
    monkeypatch.setenv("DJANGO_DEV_PASSWORD", "LocalPassword123!")
    monkeypatch.setenv("DJANGO_DEV_EMAIL", "dev.local@example.test")

    with override_settings(DEBUG=True):
        output = _call_seed_dev_user()

    user = django_user_model.objects.get(username="dev.local")
    assert user.is_active is True
    assert user.is_staff is False
    assert user.is_superuser is False
    assert user.email == "dev.local@example.test"
    assert user.check_password("LocalPassword123!") is True
    assert "Development user created." in output
    assert "LocalPassword123!" not in output


@pytest.mark.django_db
def test_seed_dev_user_is_idempotent(monkeypatch, django_user_model) -> None:
    monkeypatch.setenv("DJANGO_DEV_USERNAME", "dev.local")
    monkeypatch.setenv("DJANGO_DEV_PASSWORD", "LocalPassword123!")

    with override_settings(DEBUG=True):
        first_output = _call_seed_dev_user()
        second_output = _call_seed_dev_user()

    assert django_user_model.objects.filter(username="dev.local").count() == 1
    assert "Development user created." in first_output
    assert "Development user updated." in second_output
    assert "LocalPassword123!" not in first_output
    assert "LocalPassword123!" not in second_output


@pytest.mark.django_db
def test_seed_dev_user_updates_existing_user_password(
    monkeypatch,
    django_user_model,
) -> None:
    user = django_user_model.objects.create_user(
        username="dev.local",
        password="OldPassword123!",
        email="old@example.test",
    )
    monkeypatch.setenv("DJANGO_DEV_USERNAME", "dev.local")
    monkeypatch.setenv("DJANGO_DEV_PASSWORD", "NewPassword123!")
    monkeypatch.setenv("DJANGO_DEV_EMAIL", "new@example.test")

    with override_settings(DEBUG=True):
        output = _call_seed_dev_user()

    user.refresh_from_db()
    assert user.check_password("OldPassword123!") is False
    assert user.check_password("NewPassword123!") is True
    assert user.email == "new@example.test"
    assert user.is_active is True
    assert user.is_staff is False
    assert user.is_superuser is False
    assert "Development user updated." in output
    assert "NewPassword123!" not in output


@pytest.mark.django_db
def test_seeded_dev_user_can_login_with_django_client(
    client,
    monkeypatch,
    django_user_model,
) -> None:
    monkeypatch.setenv("DJANGO_DEV_USERNAME", "dev.local")
    monkeypatch.setenv("DJANGO_DEV_PASSWORD", "LocalPassword123!")

    with override_settings(DEBUG=True):
        output = _call_seed_dev_user()

    assert django_user_model.objects.filter(username="dev.local").count() == 1
    assert client.login(username="dev.local", password="LocalPassword123!") is True
    assert "LocalPassword123!" not in output
