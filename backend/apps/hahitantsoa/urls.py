from django.urls import path

from apps.hahitantsoa.views import (
    HahitantsoaDiscoveryItemsAPIView,
    HahitantsoaSharedAvailabilityAPIView,
)

urlpatterns = [
    path(
        "discovery-items/",
        HahitantsoaDiscoveryItemsAPIView.as_view(),
        name="hahitantsoa-discovery-items",
    ),
    path(
        "shared-availability/",
        HahitantsoaSharedAvailabilityAPIView.as_view(),
        name="hahitantsoa-shared-availability",
    ),
]
