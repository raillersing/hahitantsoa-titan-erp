from django.contrib import admin
from django.urls import include, path

from config.health import healthz, readyz

urlpatterns = [
    path("admin/", admin.site.urls),
    path("healthz/", healthz, name="healthz"),
    path("", include("apps.inventory.urls")),
    path("readyz/", readyz, name="readyz"),
]
