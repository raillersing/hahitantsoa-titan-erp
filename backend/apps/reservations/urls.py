from django.urls import path

from apps.reservations.views import (
    ReservationAvailabilitySummaryAPIView,
    ReservationAvailableItemPreviewsAPIView,
    ReservationItemAvailabilityPreviewAPIView,
)

urlpatterns = [
    path(
        "api/v1/reservations/availability-summary/",
        ReservationAvailabilitySummaryAPIView.as_view(),
        name="reservation-availability-summary",
    ),
    path(
        "api/v1/reservations/available-item-previews/",
        ReservationAvailableItemPreviewsAPIView.as_view(),
        name="reservation-available-item-previews",
    ),
    path(
        "api/v1/reservations/items/<uuid:inventory_item_id>/availability-preview/",
        ReservationItemAvailabilityPreviewAPIView.as_view(),
        name="reservation-item-availability-preview",
    ),
]
