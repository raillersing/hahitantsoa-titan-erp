from django.apps import apps


def test_inventory_app_is_installed() -> None:
    assert apps.is_installed("apps.inventory")


def test_inventory_app_config() -> None:
    app_config = apps.get_app_config("inventory")

    assert app_config.name == "apps.inventory"
    assert app_config.verbose_name == "Inventory"


def test_inventory_app_has_no_concrete_models() -> None:
    assert list(apps.get_app_config("inventory").get_models()) == []
