from rest_framework import generics
from rest_framework.permissions import IsAuthenticated

from apps.audit.services import record_audit_event_on_commit
from apps.blacklist.models import BlacklistedIntervenant
from apps.blacklist.serializers import BlacklistedIntervenantSerializer
from apps.identity.permissions import HasReservationSensitiveAccess


class BlacklistedIntervenantListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = BlacklistedIntervenantSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return BlacklistedIntervenant.objects.filter(is_active=True).order_by("name")

    def get_permissions(self):
        if self.request.method.lower() == "post":
            return [HasReservationSensitiveAccess()]
        return super().get_permissions()

    def perform_create(self, serializer):
        instance = serializer.save(
            created_by=self.request.user,
            updated_by=self.request.user,
        )
        record_audit_event_on_commit(
            actor=self.request.user,
            action="blacklist.intervenant_created",
            target_type="blacklisted_intervenant",
            target_id=str(instance.id),
            metadata={
                "name": instance.name,
                "is_active": instance.is_active,
            },
        )


class BlacklistedIntervenantRetrieveUpdateDestroyAPIView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = BlacklistedIntervenantSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = "pk"

    def get_queryset(self):
        return BlacklistedIntervenant.objects.all()

    def get_permissions(self):
        if self.request.method.lower() in {"put", "patch", "delete"}:
            return [HasReservationSensitiveAccess()]
        return super().get_permissions()

    def perform_update(self, serializer):
        instance = serializer.save(updated_by=self.request.user)
        record_audit_event_on_commit(
            actor=self.request.user,
            action="blacklist.intervenant_updated",
            target_type="blacklisted_intervenant",
            target_id=str(instance.id),
            metadata={
                "name": instance.name,
                "is_active": instance.is_active,
            },
        )

    def perform_destroy(self, instance):
        target_id = str(instance.id)
        name = instance.name
        instance.delete()
        record_audit_event_on_commit(
            actor=self.request.user,
            action="blacklist.intervenant_deleted",
            target_type="blacklisted_intervenant",
            target_id=target_id,
            metadata={"name": name},
        )
