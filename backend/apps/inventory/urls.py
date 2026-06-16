from django.urls import path

from apps.inventory.views import (
    InventoryItemListAPIView,
    InventoryItemRetrieveAPIView,
    InventoryStockMovementListCreateAPIView,
    InventoryStockMovementRetrieveAPIView,
)

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
    path(
        "api/v1/inventory/stock-movements/",
        InventoryStockMovementListCreateAPIView.as_view(),
        name="inventory-stock-movement-list",
    ),
    path(
        "api/v1/inventory/stock-movements/<uuid:id>/",
        InventoryStockMovementRetrieveAPIView.as_view(),
        name="inventory-stock-movement-detail",
    ),
]
