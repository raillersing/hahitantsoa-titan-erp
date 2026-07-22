from django.urls import path

from .views import (
    CustomerCreateAPIView,
    CustomerListAPIView,
    CustomerRetrieveAPIView,
    CustomerSoftDeleteAPIView,
    CustomerUpdateAPIView,
    DesiredDateWaitlistCancelAPIView,
    DesiredDateWaitlistContactAPIView,
    DesiredDateWaitlistConvertAPIView,
    DesiredDateWaitlistListCreateAPIView,
    DesiredDateWaitlistLoseAPIView,
    DesiredDateWaitlistRetrieveAPIView,
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
    path(
        "customers/<uuid:customer_pk>/desired-dates/",
        DesiredDateWaitlistListCreateAPIView.as_view(),
        name="desired-date-waitlist-list-create",
    ),
    path(
        "customers/<uuid:customer_pk>/desired-dates/<uuid:pk>/",
        DesiredDateWaitlistRetrieveAPIView.as_view(),
        name="desired-date-waitlist-detail",
    ),
    path(
        "customers/<uuid:customer_pk>/desired-dates/<uuid:pk>/contact/",
        DesiredDateWaitlistContactAPIView.as_view(),
        name="desired-date-waitlist-contact",
    ),
    path(
        "customers/<uuid:customer_pk>/desired-dates/<uuid:pk>/convert/",
        DesiredDateWaitlistConvertAPIView.as_view(),
        name="desired-date-waitlist-convert",
    ),
    path(
        "customers/<uuid:customer_pk>/desired-dates/<uuid:pk>/lose/",
        DesiredDateWaitlistLoseAPIView.as_view(),
        name="desired-date-waitlist-lose",
    ),
    path(
        "customers/<uuid:customer_pk>/desired-dates/<uuid:pk>/cancel/",
        DesiredDateWaitlistCancelAPIView.as_view(),
        name="desired-date-waitlist-cancel",
    ),
]
