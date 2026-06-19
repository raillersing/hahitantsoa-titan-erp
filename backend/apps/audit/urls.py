from django.urls import path

from .views import AuditEventListAPIView, AuditEventRetrieveAPIView

urlpatterns = [
    path("events/", AuditEventListAPIView.as_view(), name="audit-event-list"),
    path(
        "events/<uuid:id>/",
        AuditEventRetrieveAPIView.as_view(),
        name="audit-event-detail",
    ),
]
