from rest_framework import generics
from rest_framework.permissions import IsAuthenticated

from apps.blacklist.models import BlacklistedIntervenant
from apps.blacklist.serializers import BlacklistedIntervenantSerializer


class BlacklistedIntervenantListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = BlacklistedIntervenantSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return BlacklistedIntervenant.objects.filter(is_active=True).order_by("name")


class BlacklistedIntervenantRetrieveUpdateDestroyAPIView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = BlacklistedIntervenantSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = "pk"

    def get_queryset(self):
        return BlacklistedIntervenant.objects.all()
