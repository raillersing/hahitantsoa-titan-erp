from django.urls import path

from apps.visits.views import (
    VisitAppointmentCancelAPIView,
    VisitAppointmentCompleteAPIView,
    VisitAppointmentListCreateAPIView,
    VisitAppointmentRetrieveUpdateAPIView,
)

urlpatterns = [
    path(
        "appointments/", VisitAppointmentListCreateAPIView.as_view(), name="visit-appointment-list"
    ),
    path(
        "appointments/<uuid:pk>/",
        VisitAppointmentRetrieveUpdateAPIView.as_view(),
        name="visit-appointment-detail",
    ),
    path(
        "appointments/<uuid:pk>/complete/",
        VisitAppointmentCompleteAPIView.as_view(),
        name="visit-appointment-complete",
    ),
    path(
        "appointments/<uuid:pk>/cancel/",
        VisitAppointmentCancelAPIView.as_view(),
        name="visit-appointment-cancel",
    ),
]
