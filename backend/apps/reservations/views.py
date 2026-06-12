from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.inventory.models import InventoryItem
from apps.reservations.models import ReservationDraft
from apps.reservations.periods import validate_reservation_period
from apps.reservations.permissions import (
    IsAuthenticatedReservationDraftBoundary,
    IsAuthenticatedReservationReadBoundary,
)
from apps.reservations.serializers import (
    ReservationAvailabilityPreviewRequestSerializer,
    ReservationAvailabilitySummarySerializer,
    ReservationAvailableItemPreviewSerializer,
    ReservationDraftSerializer,
    ReservationItemAvailabilityPreviewSerializer,
)


def validated_period_or_error_response(request):
    request_serializer = ReservationAvailabilityPreviewRequestSerializer(data=request.query_params)
    request_serializer.is_valid(raise_exception=True)

    start_at = request_serializer.validated_data["start_at"]
    end_at = request_serializer.validated_data["end_at"]

    try:
        validate_reservation_period(start_at=start_at, end_at=end_at)
    except ValueError as error:
        return None, Response(
            {"detail": str(error)},
            status=status.HTTP_400_BAD_REQUEST,
        )

    return (start_at, end_at), None


class ReservationAvailabilitySummaryAPIView(APIView):
    permission_classes = [IsAuthenticatedReservationReadBoundary]

    def get(self, request):
        period, error_response = validated_period_or_error_response(request)
        if error_response is not None:
            return error_response

        start_at, end_at = period
        response_serializer = ReservationAvailabilitySummarySerializer.from_period(
            start_at=start_at,
            end_at=end_at,
        )
        return Response(response_serializer.data, status=status.HTTP_200_OK)


class ReservationAvailableItemPreviewsAPIView(APIView):
    permission_classes = [IsAuthenticatedReservationReadBoundary]

    def get(self, request):
        period, error_response = validated_period_or_error_response(request)
        if error_response is not None:
            return error_response

        start_at, end_at = period
        response_serializer = ReservationAvailableItemPreviewSerializer.many_from_period(
            start_at=start_at,
            end_at=end_at,
        )
        return Response(response_serializer.data, status=status.HTTP_200_OK)


class ReservationItemAvailabilityPreviewAPIView(APIView):
    permission_classes = [IsAuthenticatedReservationReadBoundary]

    def get(self, request, inventory_item_id):
        period, error_response = validated_period_or_error_response(request)
        if error_response is not None:
            return error_response

        inventory_item = InventoryItem.objects.filter(
            id=inventory_item_id,
            is_active=True,
            is_deleted=False,
        ).first()
        if inventory_item is None:
            return Response(
                {"detail": "Inventory item not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        start_at, end_at = period
        response_serializer = ReservationItemAvailabilityPreviewSerializer.from_period(
            inventory_item=inventory_item,
            start_at=start_at,
            end_at=end_at,
        )
        return Response(response_serializer.data, status=status.HTTP_200_OK)


def active_reservation_drafts():
    return (
        ReservationDraft.objects.filter(is_deleted=False)
        .select_related("customer")
        .prefetch_related("lines__inventory_item")
        .order_by("-created_at", "public_reference")
    )


class ReservationDraftListCreateAPIView(generics.ListCreateAPIView):
    http_method_names = ["get", "post", "head", "options"]
    permission_classes = [IsAuthenticatedReservationDraftBoundary]
    serializer_class = ReservationDraftSerializer

    def get_queryset(self):
        return active_reservation_drafts()


class ReservationDraftRetrieveAPIView(generics.RetrieveUpdateAPIView):
    http_method_names = ["get", "put", "patch", "head", "options"]
    permission_classes = [IsAuthenticatedReservationDraftBoundary]
    serializer_class = ReservationDraftSerializer
    lookup_field = "pk"

    def get_queryset(self):
        return active_reservation_drafts()
