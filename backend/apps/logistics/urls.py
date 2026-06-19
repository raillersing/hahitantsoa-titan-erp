from django.urls import path

from .views import (
    LogisticsEventCreateAPIView,
    LogisticsEventListAPIView,
    LogisticsEventRetrieveAPIView,
    LogisticsEventTransitionAPIView,
    LogisticsEventUpdateAPIView,
)

urlpatterns = [
    path("events/", LogisticsEventListAPIView.as_view(), name="logistics-event-list"),
    path(
        "events/<uuid:id>/",
        LogisticsEventRetrieveAPIView.as_view(),
        name="logistics-event-detail",
    ),
    path(
        "events/create/",
        LogisticsEventCreateAPIView.as_view(),
        name="logistics-event-create",
    ),
    path(
        "events/<uuid:id>/update/",
        LogisticsEventUpdateAPIView.as_view(),
        name="logistics-event-update",
    ),
    path(
        "events/<uuid:id>/transition/",
        LogisticsEventTransitionAPIView.as_view(),
        name="logistics-event-transition",
    ),
]
