from django.apps import apps


def test_payments_app_is_installed() -> None:
    assert apps.is_installed("apps.payments")


def test_payments_app_config() -> None:
    config = apps.get_app_config("payments")

    assert config.name == "apps.payments"
    assert config.label == "payments"
