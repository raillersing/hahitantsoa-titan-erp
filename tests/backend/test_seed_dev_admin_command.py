from io import StringIO

import pytest
from django.core.management import call_command
from django.test import override_settings

DEBUG_FALSE_MESSAGE = "Refusing to seed an admin user when DEBUG is False."


def _call_seed_dev_admin() -> str:
    output = StringIO()
    call_command("seed_dev_admin", stdout=output)
    return output.getvalue()


@pytest.mark.django_db
def test_seed_dev_admin_creates_admin_user(monkeypatch, django_user_model) -> None:
    monkeypatch.setenv("DJANGO_ADMIN_USERNAME", "admin")
    monkeypatch.setenv("DJANGO_ADMIN_PASSWORD", "admin")
    monkeypatch.setenv("DJANGO_ADMIN_EMAIL", "admin@example.test")

    with override_settings(DEBUG=True):
        output = _call_seed_dev_admin()

    user = django_user_model.objects.get(username="admin")
    assert user.is_active is True
    assert user.is_staff is True
    assert user.is_superuser is True
    assert user.email == "admin@example.test"
    assert user.check_password("admin") is True
    assert "Admin user 'admin' created." in output


@pytest.mark.django_db
def test_seed_dev_admin_uses_default_credentials(monkeypatch, django_user_model) -> None:
    monkeypatch.delenv("DJANGO_ADMIN_USERNAME", raising=False)
    monkeypatch.delenv("DJANGO_ADMIN_PASSWORD", raising=False)
    monkeypatch.delenv("DJANGO_ADMIN_EMAIL", raising=False)

    with override_settings(DEBUG=True):
        output = _call_seed_dev_admin()

    user = django_user_model.objects.get(username="admin")
    assert user.check_password("admin") is True
    assert user.email == "admin@example.test"
    assert "Admin user 'admin' created." in output


@pytest.mark.django_db
def test_seed_dev_admin_refuses_when_debug_false(django_user_model) -> None:
    with override_settings(DEBUG=False):
        output = _call_seed_dev_admin()

    assert django_user_model.objects.count() == 0
    assert DEBUG_FALSE_MESSAGE in output


@pytest.mark.django_db
def test_seed_dev_admin_is_idempotent(monkeypatch, django_user_model) -> None:
    monkeypatch.setenv("DJANGO_ADMIN_USERNAME", "admin")
    monkeypatch.setenv("DJANGO_ADMIN_PASSWORD", "admin")

    with override_settings(DEBUG=True):
        first_output = _call_seed_dev_admin()
        second_output = _call_seed_dev_admin()

    assert django_user_model.objects.filter(username="admin").count() == 1
    assert "Admin user 'admin' created." in first_output
    assert "Admin user 'admin' updated." in second_output


@pytest.mark.django_db
def test_seed_dev_admin_updates_existing_admin_password(
    monkeypatch,
    django_user_model,
) -> None:
    user = django_user_model.objects.create_user(
        username="admin",
        password="OldPassword123!",
        email="old@example.test",
        is_staff=False,
        is_superuser=False,
    )
    monkeypatch.setenv("DJANGO_ADMIN_USERNAME", "admin")
    monkeypatch.setenv("DJANGO_ADMIN_PASSWORD", "NewPassword123!")
    monkeypatch.setenv("DJANGO_ADMIN_EMAIL", "new@example.test")

    with override_settings(DEBUG=True):
        output = _call_seed_dev_admin()

    user.refresh_from_db()
    assert user.check_password("OldPassword123!") is False
    assert user.check_password("NewPassword123!") is True
    assert user.email == "new@example.test"
    assert user.is_staff is True
    assert user.is_superuser is True
    assert "Admin user 'admin' updated." in output


@pytest.mark.django_db
def test_seeded_admin_can_login_with_django_client(
    client,
    monkeypatch,
    django_user_model,
) -> None:
    monkeypatch.setenv("DJANGO_ADMIN_USERNAME", "admin")
    monkeypatch.setenv("DJANGO_ADMIN_PASSWORD", "admin")

    with override_settings(DEBUG=True):
        _call_seed_dev_admin()

    assert django_user_model.objects.filter(username="admin").count() == 1
    assert client.login(username="admin", password="admin") is True
