from django.urls import path

from .views import (
    BillingInvoiceCancelAPIView,
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
    path(
        "invoices/<uuid:id>/cancel/",
        BillingInvoiceCancelAPIView.as_view(),
        name="billing-invoice-cancel",
    ),
]
