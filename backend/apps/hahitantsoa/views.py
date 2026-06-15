from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.hahitantsoa.selectors import list_hahitantsoa_discovery_items
from apps.hahitantsoa.serializers import (
    HahitantsoaDiscoveryItemSerializer,
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
