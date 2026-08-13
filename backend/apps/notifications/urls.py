from django.urls import path

from apps.notifications.views import (
    PaymentReminderDispatchCreateAPIView,
    PaymentReminderDispatchDetailAPIView,
    SystemNotificationListAPIView,
    SystemNotificationMarkAllReadAPIView,
    SystemNotificationMarkReadAPIView,
)

urlpatterns = [
    path(
        "payment-reminders/",
        PaymentReminderDispatchCreateAPIView.as_view(),
        name="payment-reminder-dispatch-create",
    ),
    path(
        "payment-reminders/<uuid:id>/",
        PaymentReminderDispatchDetailAPIView.as_view(),
        name="payment-reminder-dispatch-detail",
    ),
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
