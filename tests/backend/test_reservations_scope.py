import pytest

from apps.reservations.scope import (
    RESERVATION_ALLOWED_INVENTORY_ITEM_KINDS,
    RESERVATION_DISALLOWED_INVENTORY_ITEM_KINDS,
    assert_reservable_inventory_item_kind,
    is_reservable_inventory_item_kind,
)


def test_reservation_allowed_inventory_item_kinds_are_titan_allowed_only() -> None:
    assert RESERVATION_ALLOWED_INVENTORY_ITEM_KINDS == {
        "material",
        "article",
        "material_pack",
    }


def test_reservation_disallowed_inventory_item_kinds_include_titan_exclusions() -> None:
    assert RESERVATION_DISALLOWED_INVENTORY_ITEM_KINDS == {
        "venue",
        "local",
        "room",
        "service",
        "event_service",
    }


@pytest.mark.parametrize(
    "kind",
    [
        "material",
        "article",
        "material_pack",
    ],
)
def test_is_reservable_inventory_item_kind_accepts_allowed_kinds(kind: str) -> None:
    assert is_reservable_inventory_item_kind(kind) is True


@pytest.mark.parametrize(
    "kind",
    [
        "venue",
        "local",
        "room",
        "service",
        "event_service",
        "unknown",
        "",
    ],
)
def test_is_reservable_inventory_item_kind_rejects_disallowed_kinds(kind: str) -> None:
    assert is_reservable_inventory_item_kind(kind) is False


@pytest.mark.parametrize(
    "kind",
    [
        "material",
        "article",
        "material_pack",
    ],
)
def test_assert_reservable_inventory_item_kind_accepts_allowed_kinds(kind: str) -> None:
    assert_reservable_inventory_item_kind(kind)


@pytest.mark.parametrize(
    "kind",
    [
        "venue",
        "local",
        "room",
        "service",
        "event_service",
        "unknown",
        "",
    ],
)
def test_assert_reservable_inventory_item_kind_rejects_disallowed_kinds(
    kind: str,
) -> None:
    with pytest.raises(ValueError) as error:
        assert_reservable_inventory_item_kind(kind)

    message = str(error.value)
    assert kind in message
    assert "not reservable" in message
