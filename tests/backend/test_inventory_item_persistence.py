import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction

from apps.inventory.models import InventoryItem

TITAN_KIND_ERROR = "Inventory item kind is not allowed for Titan."


@pytest.mark.django_db
@pytest.mark.parametrize("kind", ["material", "article", "material_pack"])
def test_inventory_item_allowed_kinds_are_persistable(kind: str) -> None:
    item = InventoryItem(name=f"{kind} item", kind=kind)

    item.full_clean()
    item.save()

    persisted_item = InventoryItem.objects.get(pk=item.pk)

    assert persisted_item.kind == kind
    assert persisted_item.is_active is True
    assert persisted_item.is_deleted is False
    assert persisted_item.created_at is not None
    assert persisted_item.updated_at is not None


@pytest.mark.parametrize("kind", ["venue", "local", "room", "service", "event_service"])
def test_inventory_item_clean_rejects_disallowed_kinds_with_safe_message(
    kind: str,
) -> None:
    item = InventoryItem(name="Rejected item", kind=kind)

    with pytest.raises(ValidationError) as error:
        item.clean()

    messages = error.value.message_dict["kind"]

    assert messages == [TITAN_KIND_ERROR]
    assert kind not in str(error.value)


@pytest.mark.django_db
@pytest.mark.parametrize("kind", ["venue", "local", "room", "service", "event_service"])
def test_inventory_item_full_clean_rejects_disallowed_kinds(
    kind: str,
) -> None:
    item = InventoryItem(name="Rejected item", kind=kind)

    with pytest.raises(ValidationError) as error:
        item.full_clean()

    messages = error.value.message_dict["kind"]

    assert TITAN_KIND_ERROR in messages


@pytest.mark.django_db(transaction=True)
def test_inventory_item_database_constraint_rejects_disallowed_kind_without_full_clean() -> None:
    item = InventoryItem(name="Invalid DB item", kind="venue")

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            item.save()

    assert InventoryItem.objects.filter(kind="venue").exists() is False
