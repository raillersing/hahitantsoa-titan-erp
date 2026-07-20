from django.urls import path

from .views import (
    PurchaseOrderListCreateAPIView,
    PurchaseOrderRetrieveUpdateDestroyAPIView,
    QuickExpenseListCreateAPIView,
    QuickExpenseRetrieveDestroyAPIView,
)

urlpatterns = [
    path(
        "purchase-orders/",
        PurchaseOrderListCreateAPIView.as_view(),
        name="purchase-order-list",
    ),
    path(
        "purchase-orders/<uuid:id>/",
        PurchaseOrderRetrieveUpdateDestroyAPIView.as_view(),
        name="purchase-order-detail",
    ),
    path(
        "expenses/",
        QuickExpenseListCreateAPIView.as_view(),
        name="quick-expense-list",
    ),
    path(
        "expenses/<uuid:id>/",
        QuickExpenseRetrieveDestroyAPIView.as_view(),
        name="quick-expense-detail",
    ),
]
