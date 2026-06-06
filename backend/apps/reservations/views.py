from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.inventory.models import InventoryItem
from apps.reservations.preview import ReservationItemPreviewStatus
from apps.reservations.serializers import (
    ReservationAvailabilitySummaryQuerySerializer,
    ReservationAvailabilitySummarySerializer,
    ReservationAvailableItemPreviewSerializer,
    ReservationItemAvailabilityPreviewSerializer,
    ReservationPeriodQuerySerializer,
)
from apps.reservations.services import (
    get_reservation_availability_summary_service,
    get_reservation_available_item_previews_service,
    preview_reservation_item_service,
)


class ReservationAvailabilitySummaryAPIView(APIView):
    http_method_names = ["get", "head", "options"]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        query_serializer = ReservationAvailabilitySummaryQuerySerializer(data=request.query_params)
        query_serializer.is_valid(raise_exception=True)

        try:
            summary = get_reservation_availability_summary_service(
                start_at=query_serializer.validated_data["start_at"],
                end_at=query_serializer.validated_data["end_at"],
            )
        except (TypeError, ValueError) as error:
            return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)

        response_serializer = ReservationAvailabilitySummarySerializer(summary)
        return Response(response_serializer.data)


class ReservationAvailableItemPreviewsAPIView(APIView):
    http_method_names = ["get", "head", "options"]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        query_serializer = ReservationPeriodQuerySerializer(data=request.query_params)
        query_serializer.is_valid(raise_exception=True)

        try:
            previews = get_reservation_available_item_previews_service(
                start_at=query_serializer.validated_data["start_at"],
                end_at=query_serializer.validated_data["end_at"],
            )
        except (TypeError, ValueError) as error:
            return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)

        response_serializer = ReservationAvailableItemPreviewSerializer(previews, many=True)
        return Response(response_serializer.data)


class ReservationItemAvailabilityPreviewAPIView(APIView):
    http_method_names = ["get", "head", "options"]
    permission_classes = [IsAuthenticated]

    def get(self, request, inventory_item_id):
        query_serializer = ReservationPeriodQuerySerializer(data=request.query_params)
        query_serializer.is_valid(raise_exception=True)

        inventory_item = get_object_or_404(
            InventoryItem.objects.filter(is_active=True, is_deleted=False),
            pk=inventory_item_id,
        )

        try:
            preview = preview_reservation_item_service(
                inventory_item=inventory_item,
                inventory_item_kind=inventory_item.kind,
                start_at=query_serializer.validated_data["start_at"],
                end_at=query_serializer.validated_data["end_at"],
            )
        except (TypeError, ValueError) as error:
            return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)

        if preview.status is ReservationItemPreviewStatus.INVALID:
            return Response(
                {"detail": preview.errors[0]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        response_serializer = ReservationItemAvailabilityPreviewSerializer(preview)
        return Response(response_serializer.data)
