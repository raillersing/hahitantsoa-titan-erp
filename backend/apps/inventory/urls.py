from django.urls import path

from apps.inventory.views import InventoryItemListAPIView, InventoryItemRetrieveAPIView

urlpatterns = [
    path(
        "api/v1/inventory/items/",
        InventoryItemListAPIView.as_view(),
        name="inventory-item-list",
    ),
    path(
        "api/v1/inventory/items/<uuid:pk>/",
        InventoryItemRetrieveAPIView.as_view(),
        name="inventory-item-detail",
    ),
]
