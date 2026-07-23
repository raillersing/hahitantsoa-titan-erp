from django.urls import path

from .views import (
    CashboxMovementCreateAPIView,
    CashboxMovementListAPIView,
    CashboxSessionCountSubmitAPIView,
    CashboxSessionCountValidateAPIView,
    CashboxSessionLegacyCloseAPIView,
    CashboxSessionListAPIView,
    CashboxSessionOpenAPIView,
    CashboxSessionReopenAPIView,
    CashboxSessionRetrieveAPIView,
)

urlpatterns = [
    path("sessions/", CashboxSessionListAPIView.as_view(), name="cashbox-session-list"),
    path("sessions/open/", CashboxSessionOpenAPIView.as_view(), name="cashbox-session-open"),
    path(
        "sessions/<uuid:id>/",
        CashboxSessionRetrieveAPIView.as_view(),
        name="cashbox-session-detail",
    ),
    path(
        "sessions/<uuid:id>/close/",
        CashboxSessionLegacyCloseAPIView.as_view(),
        name="cashbox-session-close",
    ),
    path(
        "sessions/<uuid:id>/submit-count/",
        CashboxSessionCountSubmitAPIView.as_view(),
        name="cashbox-session-submit-count",
    ),
    path(
        "sessions/<uuid:id>/validate-count/",
        CashboxSessionCountValidateAPIView.as_view(),
        name="cashbox-session-validate-count",
    ),
    path(
        "sessions/<uuid:id>/reopen/",
        CashboxSessionReopenAPIView.as_view(),
        name="cashbox-session-reopen",
    ),
    path(
        "sessions/<uuid:id>/movements/",
        CashboxMovementCreateAPIView.as_view(),
        name="cashbox-movement-create",
    ),
    path("movements/", CashboxMovementListAPIView.as_view(), name="cashbox-movement-list"),
]
