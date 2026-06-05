from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.reservations.serializers import (
    ReservationAvailabilitySummaryQuerySerializer,
    ReservationAvailabilitySummarySerializer,
)
from apps.reservations.services import get_reservation_availability_summary_service


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
