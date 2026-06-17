from django.urls import path

from apps.inventory.views import (
    InventoryItemListAPIView,
    InventoryItemRetrieveAPIView,
    InventoryReturnOperationListCreateAPIView,
    InventoryReturnOperationRetrieveAPIView,
    InventoryReturnOperationValidateAPIView,
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
    path(
        "api/v1/inventory/return-operations/",
        InventoryReturnOperationListCreateAPIView.as_view(),
        name="inventory-return-operation-list",
    ),
    path(
        "api/v1/inventory/return-operations/<uuid:id>/",
        InventoryReturnOperationRetrieveAPIView.as_view(),
        name="inventory-return-operation-detail",
    ),
    path(
        "api/v1/inventory/return-operations/<uuid:id>/validate/",
        InventoryReturnOperationValidateAPIView.as_view(),
        name="inventory-return-operation-validate",
    ),
]
