from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView

from config.health import healthz, readyz

urlpatterns = [
    path("admin/", admin.site.urls),
    path("healthz/", healthz, name="healthz"),
    path("", include("apps.inventory.urls")),
    path("readyz/", readyz, name="readyz"),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs/swagger/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    path("api/docs/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
]
