from django.urls import path

from apps.blacklist.views import (
    BlacklistedIntervenantListCreateAPIView,
    BlacklistedIntervenantRetrieveUpdateDestroyAPIView,
)

urlpatterns = [
    path(
        "",
        BlacklistedIntervenantListCreateAPIView.as_view(),
        name="blacklisted-intervenant-list",
    ),
    path(
        "<uuid:pk>/",
        BlacklistedIntervenantRetrieveUpdateDestroyAPIView.as_view(),
        name="blacklisted-intervenant-detail",
    ),
]
