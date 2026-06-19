from rest_framework import generics

from apps.identity.permissions import HasReservationSensitiveAccess

from .models import AuditEvent
from .selectors import filter_audit_events
from .serializers import AuditEventSerializer


class AuditEventListAPIView(generics.ListAPIView):
    http_method_names = ["get", "head", "options"]
    permission_classes = [HasReservationSensitiveAccess]
    serializer_class = AuditEventSerializer

    def get_queryset(self):
        return filter_audit_events(
            action=self.request.query_params.get("action"),
            target_type=self.request.query_params.get("target_type"),
            actor_id=self.request.query_params.get("actor_id"),
        )


class AuditEventRetrieveAPIView(generics.RetrieveAPIView):
    http_method_names = ["get", "head", "options"]
    permission_classes = [HasReservationSensitiveAccess]
    serializer_class = AuditEventSerializer
    lookup_field = "id"

    def get_queryset(self):
        return AuditEvent.objects.select_related("actor").order_by("-created_at", "-id")
