from django.urls import path

from .views import (
    CashboxMovementCreateAPIView,
    CashboxMovementListAPIView,
    CashboxSessionCloseAPIView,
    CashboxSessionListAPIView,
    CashboxSessionOpenAPIView,
    CashboxSessionRetrieveAPIView,
)

urlpatterns = [
    path("sessions/", CashboxSessionListAPIView.as_view(), name="cashbox-session-list"),
    path(
        "sessions/open/",
        CashboxSessionOpenAPIView.as_view(),
        name="cashbox-session-open",
    ),
    path(
        "sessions/<uuid:id>/",
        CashboxSessionRetrieveAPIView.as_view(),
        name="cashbox-session-detail",
    ),
    path(
        "sessions/<uuid:id>/close/",
        CashboxSessionCloseAPIView.as_view(),
        name="cashbox-session-close",
    ),
    path(
        "sessions/<uuid:id>/movements/",
        CashboxMovementCreateAPIView.as_view(),
        name="cashbox-movement-create",
    ),
    path("movements/", CashboxMovementListAPIView.as_view(), name="cashbox-movement-list"),
]
