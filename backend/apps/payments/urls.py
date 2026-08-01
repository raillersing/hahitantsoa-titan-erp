from django.urls import path

from apps.payments.views import (
    GatewayPaymentCallbackAPIView,
    GatewayPaymentInitiateAPIView,
    PaymentCancelAPIView,
    PaymentConfirmAPIView,
    PaymentListCreateAPIView,
    PaymentReconciliationCsvPreviewAPIView,
    PaymentReconciliationImportCommitAPIView,
    PaymentReconcileAPIView,
    PaymentRetrieveAPIView,
    RefundPaymentConfirmAPIView,
    RefundPaymentCreateAPIView,
)

urlpatterns = [
    path(
        "reconciliation/imports/csv/",
        PaymentReconciliationCsvPreviewAPIView.as_view(),
        name="payment-reconciliation-csv-preview",
    ),
    path(
        "reconciliation/imports/<uuid:id>/commit/",
        PaymentReconciliationImportCommitAPIView.as_view(),
        name="payment-reconciliation-import-commit",
    ),
    path("", PaymentListCreateAPIView.as_view(), name="payment-list"),
    path("<uuid:id>/", PaymentRetrieveAPIView.as_view(), name="payment-detail"),
    path("<uuid:id>/confirm/", PaymentConfirmAPIView.as_view(), name="payment-confirm"),
    path("<uuid:id>/cancel/", PaymentCancelAPIView.as_view(), name="payment-cancel"),
    path("<uuid:id>/reconcile/", PaymentReconcileAPIView.as_view(), name="payment-reconcile"),
    path("refund/", RefundPaymentCreateAPIView.as_view(), name="payment-refund-create"),
    path(
        "<uuid:id>/refund-confirm/",
        RefundPaymentConfirmAPIView.as_view(),
        name="payment-refund-confirm",
    ),
    path(
        "gateway/initiate/<uuid:reservation_draft_id>/",
        GatewayPaymentInitiateAPIView.as_view(),
        name="gateway-payment-initiate",
    ),
    path(
        "gateway/callback/",
        GatewayPaymentCallbackAPIView.as_view(),
        name="gateway-payment-callback",
    ),
]
