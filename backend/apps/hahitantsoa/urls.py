from django.urls import path

from apps.hahitantsoa.views import HahitantsoaDiscoveryItemsAPIView

urlpatterns = [
    path(
        "discovery-items/",
        HahitantsoaDiscoveryItemsAPIView.as_view(),
        name="hahitantsoa-discovery-items",
    ),
]
