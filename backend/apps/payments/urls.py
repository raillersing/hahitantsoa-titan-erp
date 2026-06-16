from django.urls import path

from apps.payments.views import (
    PaymentConfirmAPIView,
    PaymentListCreateAPIView,
    PaymentRetrieveAPIView,
)

urlpatterns = [
    path("", PaymentListCreateAPIView.as_view(), name="payment-list"),
    path("<uuid:id>/", PaymentRetrieveAPIView.as_view(), name="payment-detail"),
    path("<uuid:id>/confirm/", PaymentConfirmAPIView.as_view(), name="payment-confirm"),
]
