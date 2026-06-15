from django.db.models import Prefetch
from django.utils import timezone
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import generics, serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.hahitantsoa.models import HahitantsoaEventDraft, HahitantsoaEventDraftLine
from apps.hahitantsoa.permissions import IsAuthenticatedHahitantsoaEventDraftBoundary
from apps.hahitantsoa.selectors import list_hahitantsoa_discovery_items
from apps.hahitantsoa.serializers import (
    HahitantsoaDiscoveryItemSerializer,
    HahitantsoaEventDraftAvailabilityPreviewSerializer,
    HahitantsoaEventDraftSerializer,
    HahitantsoaSharedAvailabilityResponseSerializer,
    ReservationAvailabilityPreviewRequestSerializer,
)
from apps.reservations.periods import validate_reservation_period


class HahitantsoaDiscoveryItemsAPIView(APIView):
    http_method_names = ["get", "head", "options"]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses=inline_serializer(
            name="HahitantsoaDiscoveryItemsResponse",
            fields={
                "items": HahitantsoaDiscoveryItemSerializer(many=True),
                "count": serializers.IntegerField(),
            },
        )
    )
    def get(self, request):
        items = list_hahitantsoa_discovery_items()
        serialized_items = HahitantsoaDiscoveryItemSerializer(items, many=True).data

        return Response(
            {
                "items": serialized_items,
                "count": len(serialized_items),
            }
        )


class HahitantsoaSharedAvailabilityAPIView(APIView):
    http_method_names = ["get", "head", "options"]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses=inline_serializer(
            name="HahitantsoaSharedAvailabilityResponse",
            fields={
                "items": HahitantsoaSharedAvailabilityResponseSerializer().fields["items"],
                "count": serializers.IntegerField(),
            },
        )
    )
    def get(self, request):
        request_serializer = ReservationAvailabilityPreviewRequestSerializer(
            data=request.query_params
        )
        request_serializer.is_valid(raise_exception=True)

        start_at = request_serializer.validated_data["start_at"]
        end_at = request_serializer.validated_data["end_at"]

        try:
            validate_reservation_period(start_at=start_at, end_at=end_at)
        except ValueError as error:
            return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)

        response_serializer = HahitantsoaSharedAvailabilityResponseSerializer.from_period(
            start_at=start_at,
            end_at=end_at,
        )
        return Response(response_serializer.data, status=status.HTTP_200_OK)


def active_hahitantsoa_event_drafts():
    return (
        HahitantsoaEventDraft.objects.filter(is_deleted=False)
        .select_related("customer")
        .prefetch_related(
            Prefetch(
                "lines",
                queryset=HahitantsoaEventDraftLine.objects.filter(is_deleted=False).select_related(
                    "inventory_item"
                ),
            )
        )
        .order_by("-created_at", "public_reference")
    )


def visible_hahitantsoa_event_drafts(*, user):
    return active_hahitantsoa_event_drafts().filter(created_by=user)


class HahitantsoaEventDraftListCreateAPIView(generics.ListCreateAPIView):
    http_method_names = ["get", "post", "head", "options"]
    permission_classes = [IsAuthenticatedHahitantsoaEventDraftBoundary]
    serializer_class = HahitantsoaEventDraftSerializer

    def get_queryset(self):
        return visible_hahitantsoa_event_drafts(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class HahitantsoaEventDraftAvailabilityPreviewAPIView(APIView):
    http_method_names = ["get", "head", "options"]
    permission_classes = [IsAuthenticatedHahitantsoaEventDraftBoundary]

    @extend_schema(responses=HahitantsoaEventDraftAvailabilityPreviewSerializer)
    def get(self, request, pk):
        from django.shortcuts import get_object_or_404

        event_draft = get_object_or_404(visible_hahitantsoa_event_drafts(user=request.user), pk=pk)
        response_serializer = HahitantsoaEventDraftAvailabilityPreviewSerializer.from_event_draft(
            event_draft=event_draft
        )
        return Response(response_serializer.data, status=status.HTTP_200_OK)


class HahitantsoaEventDraftRetrieveUpdateAPIView(generics.RetrieveUpdateDestroyAPIView):
    http_method_names = ["get", "put", "patch", "delete", "head", "options"]
    permission_classes = [IsAuthenticatedHahitantsoaEventDraftBoundary]
    serializer_class = HahitantsoaEventDraftSerializer
    lookup_field = "pk"

    def get_queryset(self):
        return visible_hahitantsoa_event_drafts(user=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    @extend_schema(responses={204: None})
    def delete(self, request, *args, **kwargs):
        return self.destroy(request, *args, **kwargs)

    def perform_destroy(self, instance):
        instance.is_deleted = True
        instance.deleted_at = timezone.now()
        instance.updated_by = self.request.user
        instance.save(update_fields=["is_deleted", "deleted_at", "updated_by", "updated_at"])
