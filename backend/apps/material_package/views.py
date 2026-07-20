from rest_framework import generics
from rest_framework.permissions import IsAuthenticated

from apps.material_package.models import MaterialPackage
from apps.material_package.serializers import (
    MaterialPackageCreateSerializer,
    MaterialPackageSerializer,
)


class MaterialPackageListCreateAPIView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return MaterialPackageCreateSerializer
        return MaterialPackageSerializer

    def get_queryset(self):
        return MaterialPackage.objects.filter(is_active=True).order_by("name")


class MaterialPackageRetrieveUpdateDestroyAPIView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    lookup_field = "pk"

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return MaterialPackageCreateSerializer
        return MaterialPackageSerializer

    def get_queryset(self):
        return MaterialPackage.objects.all()

    def perform_destroy(self, instance):
        """Soft delete: mark as inactive instead of actually deleting."""
        instance.is_active = False
        instance.save(update_fields=["is_active", "updated_at"])
