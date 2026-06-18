from django.urls import path

from .views import (
    BillingInvoiceListAPIView,
    BillingInvoiceRetrieveAPIView,
    BillingInvoiceSettleAPIView,
)

urlpatterns = [
    path("invoices/", BillingInvoiceListAPIView.as_view(), name="billing-invoice-list"),
    path(
        "invoices/<uuid:id>/",
        BillingInvoiceRetrieveAPIView.as_view(),
        name="billing-invoice-detail",
    ),
    path(
        "invoices/<uuid:id>/settle/",
        BillingInvoiceSettleAPIView.as_view(),
        name="billing-invoice-settle",
    ),
]
