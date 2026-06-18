from django.urls import path

from .views import (
    CustomerCreateAPIView,
    CustomerListAPIView,
    CustomerRetrieveAPIView,
    CustomerSoftDeleteAPIView,
    CustomerUpdateAPIView,
)

urlpatterns = [
    path("customers/", CustomerListAPIView.as_view(), name="customer-list"),
    path("customers/create/", CustomerCreateAPIView.as_view(), name="customer-create"),
    path("customers/<uuid:pk>/", CustomerRetrieveAPIView.as_view(), name="customer-detail"),
    path(
        "customers/<uuid:pk>/update/",
        CustomerUpdateAPIView.as_view(),
        name="customer-update",
    ),
    path(
        "customers/<uuid:pk>/delete/",
        CustomerSoftDeleteAPIView.as_view(),
        name="customer-soft-delete",
    ),
]
