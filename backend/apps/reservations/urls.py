from django.urls import path

from apps.reservations.views import ReservationAvailabilitySummaryAPIView

urlpatterns = [
    path(
        "api/v1/reservations/availability-summary/",
        ReservationAvailabilitySummaryAPIView.as_view(),
        name="reservation-availability-summary",
    ),
]
