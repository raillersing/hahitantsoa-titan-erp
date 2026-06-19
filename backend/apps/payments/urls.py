from django.urls import path

from apps.payments.views import (
    PaymentCancelAPIView,
    PaymentConfirmAPIView,
    PaymentListCreateAPIView,
    PaymentReconcileAPIView,
    PaymentRetrieveAPIView,
    RefundPaymentConfirmAPIView,
    RefundPaymentCreateAPIView,
)

urlpatterns = [
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
]
