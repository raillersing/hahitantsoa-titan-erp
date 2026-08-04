import pytest

from apps.inventory.models import InventoryItem
from apps.inventory.serializers import InventoryItemSerializer

TITAN_KIND_ERROR = "Inventory item kind is not allowed for Titan."


def test_inventory_item_serializer_fields() -> None:
    serializer = InventoryItemSerializer()

    assert list(serializer.fields) == [
        "id",
        "name",
        "kind",
        "description",
        "code",
        "section",
        "unit",
        "purchase_price",
        "rental_price",
        "breakage_price",
        "reported_inventory_quantity",
        "reported_damaged_quantity",
        "stock_summary",
        "is_active",
        "created_at",
        "updated_at",
        "is_deleted",
        "deleted_at",
        "created_by",
        "updated_by",
    ]


def test_inventory_item_serializer_read_only_fields() -> None:
    serializer = InventoryItemSerializer()

    assert {field_name for field_name, field in serializer.fields.items() if field.read_only} == {
        "id",
        "created_at",
        "updated_at",
        "is_deleted",
        "deleted_at",
        "created_by",
        "updated_by",
        "stock_summary",
    }


@pytest.mark.parametrize("kind", ["material", "article", "material_pack"])
def test_inventory_item_serializer_accepts_allowed_kinds(kind: str) -> None:
    serializer = InventoryItemSerializer(
        data={
            "name": "Allowed item",
            "kind": kind,
            "description": "",
            "is_active": True,
        }
    )

    assert serializer.is_valid() is True
    assert serializer.validated_data["kind"] == kind


@pytest.mark.parametrize("kind", ["venue", "local", "room", "service", "event_service"])
def test_inventory_item_serializer_rejects_disallowed_kinds_without_exposing_value(
    kind: str,
) -> None:
    serializer = InventoryItemSerializer(
        data={
            "name": "Rejected item",
            "kind": kind,
            "description": "",
            "is_active": True,
        }
    )

    assert serializer.is_valid() is False

    kind_errors = [str(error) for error in serializer.errors["kind"]]
    assert kind_errors == [TITAN_KIND_ERROR]
    assert kind not in str(serializer.errors["kind"])


def test_inventory_item_serializer_serializes_unsaved_instance() -> None:
    item = InventoryItem(name="Camera", kind="material", description="4K camera")
    item.code = "CAM-01"
    item.section = "Photo"
    item.unit = "u"
    item.purchase_price = 1000
    item.rental_price = 150
    item.breakage_price = 2000
    item.reported_inventory_quantity = 12
    item.reported_damaged_quantity = 1

    data = InventoryItemSerializer(item).data

    assert data["name"] == "Camera"
    assert data["kind"] == "material"
    assert data["description"] == "4K camera"
    assert data["code"] == "CAM-01"
    assert data["section"] == "Photo"
    assert data["unit"] == "u"
    assert data["purchase_price"] == "1000.00"
    assert data["rental_price"] == "150.00"
    assert data["breakage_price"] == "2000.00"
    assert data["reported_inventory_quantity"] == 12
    assert data["reported_damaged_quantity"] == 1
    assert data["stock_summary"] == {
        "reported_inventory_quantity": 12,
        "reported_damaged_quantity": 1,
        "current_stock": 12,
        "available_stock": 11,
        "reserved_stock": 0,
        "out_stock": 0,
        "return_stock": 0,
        "damaged_lost_stock": 0,
    }
    assert data["is_active"] is True
