from django.urls import path

from .views import (
    LogisticsEventCompletePassationAPIView,
    LogisticsEventCreateAPIView,
    LogisticsEventItemLineAddAPIView,
    LogisticsEventItemLineListAPIView,
    LogisticsEventItemLineRemoveAPIView,
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
    path(
        "events/<uuid:id>/lines/",
        LogisticsEventItemLineListAPIView.as_view(),
        name="logistics-event-line-list",
    ),
    path(
        "events/<uuid:id>/lines/add/",
        LogisticsEventItemLineAddAPIView.as_view(),
        name="logistics-event-line-add",
    ),
    path(
        "events/<uuid:id>/lines/<uuid:line_id>/remove/",
        LogisticsEventItemLineRemoveAPIView.as_view(),
        name="logistics-event-line-remove",
    ),
    path(
        "events/<uuid:id>/complete-passation/",
        LogisticsEventCompletePassationAPIView.as_view(),
        name="logistics-event-complete-passation",
    ),
]
