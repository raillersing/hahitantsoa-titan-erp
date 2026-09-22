from rest_framework import generics
from rest_framework.permissions import IsAuthenticated

from apps.identity.permissions import HasInventoryManagementAccess
from apps.material_package.models import MaterialPackage
from apps.material_package.serializers import (
    MaterialPackageCreateSerializer,
    MaterialPackageSerializer,
)


class MaterialPackageListCreateAPIView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.request.method.lower() == "post":
            return [HasInventoryManagementAccess()]
        return super().get_permissions()

    def get_serializer_class(self):
        if self.request.method == "POST":
            return MaterialPackageCreateSerializer
        return MaterialPackageSerializer

    def get_queryset(self):
        qs = MaterialPackage.objects.all().order_by("name")
        include_inactive = self.request.query_params.get("include_inactive", "").lower() in (
            "true",
            "1",
            "yes",
        )
        is_active_param = self.request.query_params.get("is_active")
        if is_active_param is not None:
            if is_active_param.lower() in ("true", "1", "yes"):
                qs = qs.filter(is_active=True)
            elif is_active_param.lower() in ("false", "0", "no"):
                qs = qs.filter(is_active=False)
        elif not include_inactive:
            qs = qs.filter(is_active=True)
        return qs


class MaterialPackageRetrieveUpdateDestroyAPIView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    lookup_field = "pk"

    def get_permissions(self):
        if self.request.method.lower() in {"put", "patch", "delete"}:
            return [HasInventoryManagementAccess()]
        return super().get_permissions()

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
