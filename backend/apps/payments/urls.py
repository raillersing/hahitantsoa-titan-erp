from django.urls import path

from apps.payments.views import (
    PaymentCancelAPIView,
    PaymentConfirmAPIView,
    PaymentListCreateAPIView,
    PaymentReconcileAPIView,
    PaymentRetrieveAPIView,
)

urlpatterns = [
    path("", PaymentListCreateAPIView.as_view(), name="payment-list"),
    path("<uuid:id>/", PaymentRetrieveAPIView.as_view(), name="payment-detail"),
    path("<uuid:id>/confirm/", PaymentConfirmAPIView.as_view(), name="payment-confirm"),
    path("<uuid:id>/cancel/", PaymentCancelAPIView.as_view(), name="payment-cancel"),
    path("<uuid:id>/reconcile/", PaymentReconcileAPIView.as_view(), name="payment-reconcile"),
]
