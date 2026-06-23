from django.http import Http404
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.identity.permissions import HasReservationSensitiveAccess
from apps.inventory.models import InventoryItem
from apps.logistics.selectors import (
    active_logistics_events,
    get_logistics_event_item_lines,
    logistics_events_for_reservation_draft,
)
from apps.logistics.serializers import (
    LogisticsEventCompletePassationSerializer,
    LogisticsEventCreateSerializer,
    LogisticsEventItemLineCreateSerializer,
    LogisticsEventItemLineSerializer,
    LogisticsEventSerializer,
    LogisticsEventStatusTransitionSerializer,
    LogisticsEventUpdateSerializer,
)
from apps.logistics.services import (
    LOGISTICS_EVENT_NOT_FOUND,
    LogisticsServiceError,
    add_item_line_to_logistics_event,
    complete_handover_passation,
    create_logistics_event,
    remove_item_line_from_logistics_event,
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
                signature_required=serializer.validated_data.get("signature_required", False),
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
                signature_required=serializer.validated_data.get("signature_required"),
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


class LogisticsEventItemLineListAPIView(generics.ListAPIView):
    http_method_names = ["get", "head", "options"]
    permission_classes = [HasReservationSensitiveAccess]
    serializer_class = LogisticsEventItemLineSerializer

    def get_queryset(self):
        event_id = self.kwargs.get("id")
        return get_logistics_event_item_lines(event_id=event_id)


class LogisticsEventItemLineAddAPIView(APIView):
    http_method_names = ["post", "head", "options"]
    permission_classes = [HasReservationSensitiveAccess]

    @extend_schema(
        request=LogisticsEventItemLineCreateSerializer,
        responses={
            201: LogisticsEventItemLineSerializer,
            400: OpenApiResponse(description="Invalid request."),
            403: OpenApiResponse(description="Unauthorized."),
            404: OpenApiResponse(description="Event not found."),
        },
    )
    def post(self, request, id):
        event = active_logistics_events().filter(pk=id).first()
        if event is None:
            raise Http404("Logistics event not found.")

        serializer = LogisticsEventItemLineCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        inventory_item = get_object_or_404(
            InventoryItem,
            pk=serializer.validated_data["inventory_item_id"],
        )

        try:
            line = add_item_line_to_logistics_event(
                actor=request.user,
                event=event,
                inventory_item=inventory_item,
                quantity=serializer.validated_data.get("quantity", 1),
                notes=serializer.validated_data.get("notes", ""),
            )
        except LogisticsServiceError as exc:
            return Response(
                {"detail": str(exc), "code": exc.code}, status=status.HTTP_400_BAD_REQUEST
            )

        return Response(
            LogisticsEventItemLineSerializer(line).data,
            status=status.HTTP_201_CREATED,
        )


class LogisticsEventItemLineRemoveAPIView(APIView):
    http_method_names = ["post", "head", "options"]
    permission_classes = [HasReservationSensitiveAccess]

    @extend_schema(
        responses={
            204: OpenApiResponse(description="Line removed."),
            400: OpenApiResponse(description="Invalid request."),
            403: OpenApiResponse(description="Unauthorized."),
            404: OpenApiResponse(description="Event not found."),
        },
    )
    def post(self, request, id, line_id):
        event = active_logistics_events().filter(pk=id).first()
        if event is None:
            raise Http404("Logistics event not found.")

        try:
            remove_item_line_from_logistics_event(
                actor=request.user,
                event=event,
                line_id=line_id,
            )
        except LogisticsServiceError as exc:
            return Response(
                {"detail": str(exc), "code": exc.code}, status=status.HTTP_400_BAD_REQUEST
            )

        return Response(status=status.HTTP_204_NO_CONTENT)


class LogisticsEventCompletePassationAPIView(APIView):
    http_method_names = ["post", "head", "options"]
    permission_classes = [HasReservationSensitiveAccess]

    @extend_schema(
        request=LogisticsEventCompletePassationSerializer,
        responses={
            200: LogisticsEventSerializer,
            400: OpenApiResponse(description="Invalid passation state."),
            403: OpenApiResponse(description="Unauthorized."),
            404: OpenApiResponse(description="Not found."),
        },
    )
    def post(self, request, id):
        event = active_logistics_events().filter(pk=id).first()
        if event is None:
            raise Http404("Logistics event not found.")

        serializer = LogisticsEventCompletePassationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            event, document_instance = complete_handover_passation(
                actor=request.user,
                event=event,
                signed_at=serializer.validated_data.get("signed_at") or None,
                notes=serializer.validated_data.get("notes", ""),
            )
        except LogisticsServiceError as exc:
            return Response(
                {"detail": str(exc), "code": exc.code}, status=status.HTTP_400_BAD_REQUEST
            )

        return Response(
            {
                "event": LogisticsEventSerializer(event).data,
                "document_instance_id": str(document_instance.id),
            },
            status=status.HTTP_200_OK,
        )
