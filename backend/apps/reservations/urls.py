from django.urls import path

from apps.reservations.views import (
    ReservationAvailabilitySummaryAPIView,
    ReservationAvailableItemPreviewsAPIView,
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
]
