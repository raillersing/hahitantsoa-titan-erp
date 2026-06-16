from django.urls import path

from apps.hahitantsoa.views import (
    HahitantsoaDiscoveryItemsAPIView,
    HahitantsoaEventDraftAvailabilityPreviewAPIView,
    HahitantsoaEventDraftConfirmationPreflightAPIView,
    HahitantsoaEventDraftListCreateAPIView,
    HahitantsoaEventDraftRetrieveUpdateAPIView,
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
    path(
        "event-drafts/",
        HahitantsoaEventDraftListCreateAPIView.as_view(),
        name="hahitantsoa-event-draft-list",
    ),
    path(
        "event-drafts/<uuid:pk>/",
        HahitantsoaEventDraftRetrieveUpdateAPIView.as_view(),
        name="hahitantsoa-event-draft-detail",
    ),
    path(
        "event-drafts/<uuid:pk>/availability-preview/",
        HahitantsoaEventDraftAvailabilityPreviewAPIView.as_view(),
        name="hahitantsoa-event-draft-availability-preview",
    ),
    path(
        "event-drafts/<uuid:pk>/confirmation-preflight/",
        HahitantsoaEventDraftConfirmationPreflightAPIView.as_view(),
        name="hahitantsoa-event-draft-confirmation-preflight",
    ),
]
