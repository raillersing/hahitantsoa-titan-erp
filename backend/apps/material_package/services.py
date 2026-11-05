from django.db import transaction
from rest_framework import serializers

from apps.inventory.models import INVENTORY_ITEM_KIND_VALUES, InventoryItem
from apps.material_package.models import MaterialPackage, MaterialPackageLine


@transaction.atomic
def save_material_package(*, attributes, lines, instance=None):
    """Replace a composition atomically after checking the locked inventory."""
    if instance is not None:
        instance = MaterialPackage.objects.select_for_update().get(pk=instance.pk)
    if lines is None and instance is not None:
        checked_lines = list(instance.lines.select_related("inventory_item"))
        checked_lines = [
            {"inventory_item": line.inventory_item, "quantity": line.quantity}
            for line in checked_lines
        ]
    else:
        checked_lines = lines or []

    item_ids = [line["inventory_item"].pk for line in checked_lines]
    if len(item_ids) != len(set(item_ids)):
        raise serializers.ValidationError({"lines": "Un article ne peut figurer qu'une fois."})
    eligible_ids = set(
        InventoryItem.objects.select_for_update()
        .filter(
            pk__in=item_ids,
            is_active=True,
            is_deleted=False,
            kind__in=INVENTORY_ITEM_KIND_VALUES,
        )
        .order_by("pk")
        .values_list("pk", flat=True)
    )
    if eligible_ids != set(item_ids):
        raise serializers.ValidationError(
            {"lines": "Sélectionnez uniquement des articles actifs de l'inventaire."}
        )
    if any(line["quantity"] < 1 for line in checked_lines):
        raise serializers.ValidationError({"lines": "Les quantités doivent être positives."})

    if instance is None:
        instance = MaterialPackage.objects.create(**attributes)
    else:
        for name, value in attributes.items():
            setattr(instance, name, value)
        instance.save()
    if lines is not None:
        instance.lines.all().delete()
        MaterialPackageLine.objects.bulk_create(
            MaterialPackageLine(package=instance, **line) for line in lines
        )
    return instance
