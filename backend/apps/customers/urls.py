from django.urls import path

from apps.customers.views import CustomerListAPIView, CustomerRetrieveAPIView

urlpatterns = [
    path(
        "customers/",
        CustomerListAPIView.as_view(),
        name="customer-list",
    ),
    path(
        "customers/<uuid:pk>/",
        CustomerRetrieveAPIView.as_view(),
        name="customer-detail",
    ),
]
