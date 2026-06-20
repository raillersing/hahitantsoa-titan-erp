from django.http import Http404
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.identity.permissions import HasReservationSensitiveAccess
from apps.logistics.selectors import active_logistics_events, logistics_events_for_reservation_draft
from apps.logistics.serializers import (
    LogisticsEventCreateSerializer,
    LogisticsEventSerializer,
    LogisticsEventStatusTransitionSerializer,
    LogisticsEventUpdateSerializer,
)
from apps.logistics.services import (
    LOGISTICS_EVENT_NOT_FOUND,
    LogisticsServiceError,
    create_logistics_event,
    transition_logistics_event_status,
    update_logistics_event,
)
from apps.reservations.models import ReservationDraft


class LogisticsEventListAPIView(generics.ListAPIView):
    http_method_names = ["get", "head", "options"]
    permission_classes = [HasReservationSensitiveAccess]
    serializer_class = LogisticsEventSerializer

    def get_queryset(self):
        reservation_draft_id = self.request.query_params.get("reservation_draft_id")
        if reservation_draft_id:
            qs = logistics_events_for_reservation_draft(reservation_draft_id=reservation_draft_id)
        else:
            qs = active_logistics_events()

        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param)
        event_type_param = self.request.query_params.get("event_type")
        if event_type_param:
            qs = qs.filter(event_type=event_type_param)
        scheduled_after = self.request.query_params.get("scheduled_after")
        if scheduled_after:
            qs = qs.filter(scheduled_at__gte=scheduled_after)
        scheduled_before = self.request.query_params.get("scheduled_before")
        if scheduled_before:
            qs = qs.filter(scheduled_at__lte=scheduled_before)
        return qs


class LogisticsEventRetrieveAPIView(generics.RetrieveAPIView):
    http_method_names = ["get", "head", "options"]
    permission_classes = [HasReservationSensitiveAccess]
    serializer_class = LogisticsEventSerializer
    lookup_field = "id"

    def get_queryset(self):
        return active_logistics_events()


class LogisticsEventCreateAPIView(APIView):
    http_method_names = ["post", "head", "options"]
    permission_classes = [HasReservationSensitiveAccess]

    @extend_schema(
        request=LogisticsEventCreateSerializer,
        responses={
            201: LogisticsEventSerializer,
            400: OpenApiResponse(description="Invalid request."),
            403: OpenApiResponse(description="Unauthorized."),
        },
    )
    def post(self, request):
        serializer = LogisticsEventCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        reservation_draft = get_object_or_404(
            ReservationDraft,
            pk=serializer.validated_data["reservation_draft_id"],
        )

        try:
            event = create_logistics_event(
                actor=request.user,
                reservation_draft=reservation_draft,
                event_type=serializer.validated_data["event_type"],
                scheduled_at=serializer.validated_data.get("scheduled_at") or None,
                address=serializer.validated_data.get("address", ""),
                contact_name=serializer.validated_data.get("contact_name", ""),
                contact_phone=serializer.validated_data.get("contact_phone", ""),
                notes=serializer.validated_data.get("notes", ""),
            )
        except LogisticsServiceError as exc:
            return Response(
                {"detail": str(exc), "code": exc.code}, status=status.HTTP_400_BAD_REQUEST
            )

        return Response(
            LogisticsEventSerializer(event).data,
            status=status.HTTP_201_CREATED,
        )


class LogisticsEventUpdateAPIView(APIView):
    http_method_names = ["post", "head", "options"]
    permission_classes = [HasReservationSensitiveAccess]

    @extend_schema(
        request=LogisticsEventUpdateSerializer,
        responses={
            200: LogisticsEventSerializer,
            400: OpenApiResponse(description="Invalid request."),
            403: OpenApiResponse(description="Unauthorized."),
            404: OpenApiResponse(description="Not found."),
        },
    )
    def post(self, request, id):
        event = active_logistics_events().filter(pk=id).first()
        if event is None:
            raise Http404("Logistics event not found.")

        serializer = LogisticsEventUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            event = update_logistics_event(
                actor=request.user,
                event=event,
                scheduled_at=serializer.validated_data.get("scheduled_at") or None,
                address=serializer.validated_data.get("address", ""),
                contact_name=serializer.validated_data.get("contact_name", ""),
                contact_phone=serializer.validated_data.get("contact_phone", ""),
                notes=serializer.validated_data.get("notes", ""),
            )
        except LogisticsServiceError as exc:
            return Response(
                {"detail": str(exc), "code": exc.code}, status=status.HTTP_400_BAD_REQUEST
            )

        return Response(LogisticsEventSerializer(event).data, status=status.HTTP_200_OK)


class LogisticsEventTransitionAPIView(APIView):
    http_method_names = ["post", "head", "options"]
    permission_classes = [HasReservationSensitiveAccess]

    @extend_schema(
        request=LogisticsEventStatusTransitionSerializer,
        responses={
            200: LogisticsEventSerializer,
            400: OpenApiResponse(description="Invalid transition."),
            403: OpenApiResponse(description="Unauthorized."),
            404: OpenApiResponse(description="Not found."),
        },
    )
    def post(self, request, id):
        event = active_logistics_events().filter(pk=id).first()
        if event is None:
            raise Http404("Logistics event not found.")

        serializer = LogisticsEventStatusTransitionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            event = transition_logistics_event_status(
                actor=request.user,
                event=event,
                new_status=serializer.validated_data["new_status"],
                executed_at=serializer.validated_data.get("executed_at") or None,
                notes=serializer.validated_data.get("notes", ""),
            )
        except LogisticsServiceError as exc:
            if exc.code == LOGISTICS_EVENT_NOT_FOUND:
                return Response({"detail": str(exc)}, status=status.HTTP_404_NOT_FOUND)
            return Response(
                {"detail": str(exc), "code": exc.code}, status=status.HTTP_400_BAD_REQUEST
            )

        return Response(LogisticsEventSerializer(event).data, status=status.HTTP_200_OK)
