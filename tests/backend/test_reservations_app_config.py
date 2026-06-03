from django.apps import apps


def test_reservations_app_is_installed() -> None:
    assert apps.is_installed("apps.reservations")


def test_reservations_app_config() -> None:
    app_config = apps.get_app_config("reservations")

    assert app_config.name == "apps.reservations"
    assert app_config.verbose_name == "Reservations"


def test_reservations_app_registry_has_no_models() -> None:
    app_config = apps.get_app_config("reservations")

    assert list(app_config.get_models()) == []
