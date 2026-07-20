from django.urls import path

from apps.material_package.views import (
    MaterialPackageListCreateAPIView,
    MaterialPackageRetrieveUpdateDestroyAPIView,
)

urlpatterns = [
    path(
        "",
        MaterialPackageListCreateAPIView.as_view(),
        name="material-package-list",
    ),
    path(
        "<uuid:pk>/",
        MaterialPackageRetrieveUpdateDestroyAPIView.as_view(),
        name="material-package-detail",
    ),
]
