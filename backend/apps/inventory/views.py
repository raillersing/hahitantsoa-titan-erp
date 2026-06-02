from rest_framework import generics

from apps.inventory.models import InventoryItem
from apps.inventory.serializers import InventoryItemSerializer


def active_inventory_items():
    return InventoryItem.objects.filter(is_active=True, is_deleted=False).order_by("name")


class InventoryItemListAPIView(generics.ListAPIView):
    serializer_class = InventoryItemSerializer

    def get_queryset(self):
        return active_inventory_items()


class InventoryItemRetrieveAPIView(generics.RetrieveAPIView):
    serializer_class = InventoryItemSerializer
    lookup_field = "pk"

    def get_queryset(self):
        return active_inventory_items()
