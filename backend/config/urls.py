from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView

from config.health import healthz, readyz

urlpatterns = [
    path("admin/", admin.site.urls),
    path("healthz/", healthz, name="healthz"),
    path("", include("apps.inventory.urls")),
    path("", include("apps.reservations.urls")),
    path("api/v1/documents/", include("apps.documents.urls")),
    path("api/v1/", include("apps.customers.urls")),
    path("api/v1/hahitantsoa/", include("apps.hahitantsoa.urls")),
    path("api/v1/payments/", include("apps.payments.urls")),
    path("api/v1/billing/", include("apps.billing.urls")),
    path("api/v1/identity/", include("apps.identity.urls")),
    path("api/v1/audit/", include("apps.audit.urls")),
    path("api/v1/logistics/", include("apps.logistics.urls")),
    path("readyz/", readyz, name="readyz"),
    path("api-auth/", include("rest_framework.urls", namespace="rest_framework")),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs/swagger/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    path("api/docs/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
]
