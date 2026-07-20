from django.urls import path

from apps.notifications.views import (
    SystemNotificationListAPIView,
    SystemNotificationMarkAllReadAPIView,
    SystemNotificationMarkReadAPIView,
)

urlpatterns = [
    path(
        "",
        SystemNotificationListAPIView.as_view(),
        name="notification-list",
    ),
    path(
        "<uuid:id>/read/",
        SystemNotificationMarkReadAPIView.as_view(),
        name="notification-mark-read",
    ),
    path(
        "mark-all-read/",
        SystemNotificationMarkAllReadAPIView.as_view(),
        name="notification-mark-all-read",
    ),
]
