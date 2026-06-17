from django.apps import apps

from apps.inventory.models import (
    InventoryAvailability,
    InventoryDamageLossSettlement,
    InventoryDamageLossSettlementLine,
    InventoryItem,
    InventoryReturnOperation,
    InventoryReturnOperationLine,
    InventoryStockMovement,
)


def test_inventory_app_is_installed() -> None:
    assert apps.is_installed("apps.inventory")


def test_inventory_app_config() -> None:
    app_config = apps.get_app_config("inventory")

    assert app_config.name == "apps.inventory"
    assert app_config.verbose_name == "Inventory"


def test_inventory_app_registry_contains_inventory_models() -> None:
    inventory_models = set(apps.get_app_config("inventory").get_models())

    assert InventoryItem in inventory_models
    assert InventoryAvailability in inventory_models
    assert InventoryStockMovement in inventory_models
    assert InventoryReturnOperation in inventory_models
    assert InventoryReturnOperationLine in inventory_models
    assert InventoryDamageLossSettlement in inventory_models
    assert InventoryDamageLossSettlementLine in inventory_models
