from django.http import Http404
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.identity.permissions import HasReservationSensitiveAccess

from .serializers import (
    CashboxMovementCreateSerializer,
    CashboxMovementSerializer,
    CashboxSessionCloseSerializer,
    CashboxSessionOpenSerializer,
    CashboxSessionSerializer,
)
from .services import (
    CashboxLifecycleError,
    active_cashbox_movements,
    active_cashbox_sessions,
    close_cashbox_session,
    open_cashbox_session,
    record_cashbox_movement,
)


class CashboxSessionListAPIView(generics.ListAPIView):
    http_method_names = ["get", "head", "options"]
    permission_classes = [HasReservationSensitiveAccess]
    serializer_class = CashboxSessionSerializer

    def get_queryset(self):
        qs = active_cashbox_sessions()
        operator_id = self.request.query_params.get("operator_id")
        if operator_id:
            qs = qs.filter(operator_id=operator_id)
        status_param = self.request.query_params.get("status")
        if status_param == "open":
            qs = qs.filter(closed_at__isnull=True)
        elif status_param == "closed":
            qs = qs.filter(closed_at__isnull=False)
        return qs


class CashboxSessionRetrieveAPIView(generics.RetrieveAPIView):
    http_method_names = ["get", "head", "options"]
    permission_classes = [HasReservationSensitiveAccess]
    serializer_class = CashboxSessionSerializer
    lookup_field = "id"

    def get_queryset(self):
        return active_cashbox_sessions()


class CashboxSessionOpenAPIView(APIView):
    http_method_names = ["post", "head", "options"]
    permission_classes = [HasReservationSensitiveAccess]

    @extend_schema(
        request=CashboxSessionOpenSerializer,
        responses={
            201: CashboxSessionSerializer,
            400: OpenApiResponse(description="Cashbox session opening failed."),
        },
    )
    def post(self, request):
        serializer = CashboxSessionOpenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            session = open_cashbox_session(
                operator=serializer.validated_data["operator"],
                actor=request.user,
                opening_note=serializer.validated_data["opening_note"],
            )
        except CashboxLifecycleError as error:
            return Response(
                {"detail": str(error), "code": error.code},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(CashboxSessionSerializer(session).data, status=status.HTTP_201_CREATED)


class CashboxSessionCloseAPIView(APIView):
    http_method_names = ["post", "head", "options"]
    permission_classes = [HasReservationSensitiveAccess]

    @extend_schema(
        request=CashboxSessionCloseSerializer,
        responses={
            200: CashboxSessionSerializer,
            400: OpenApiResponse(description="Cashbox session closing failed."),
            404: OpenApiResponse(description="Cashbox session not found."),
        },
    )
    def post(self, request, id):
        serializer = CashboxSessionCloseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        session = active_cashbox_sessions().filter(id=id).first()
        if session is None:
            raise Http404("Cashbox session not found.")
        try:
            result = close_cashbox_session(
                session=session,
                actor=request.user,
                closing_note=serializer.validated_data["closing_note"],
            )
        except CashboxLifecycleError as error:
            return Response(
                {"detail": str(error), "code": error.code},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(CashboxSessionSerializer(result.session).data, status=status.HTTP_200_OK)


class CashboxMovementListAPIView(generics.ListAPIView):
    http_method_names = ["get", "head", "options"]
    permission_classes = [HasReservationSensitiveAccess]
    serializer_class = CashboxMovementSerializer

    def get_queryset(self):
        qs = active_cashbox_movements()
        session_id = self.request.query_params.get("session_id")
        if session_id:
            qs = qs.filter(session_id=session_id)
        direction = self.request.query_params.get("direction")
        if direction:
            qs = qs.filter(direction=direction)
        return qs


class CashboxMovementCreateAPIView(APIView):
    http_method_names = ["post", "head", "options"]
    permission_classes = [HasReservationSensitiveAccess]

    @extend_schema(
        request=CashboxMovementCreateSerializer,
        responses={
            201: CashboxMovementSerializer,
            400: OpenApiResponse(description="Cashbox movement creation failed."),
            404: OpenApiResponse(description="Cashbox session not found."),
        },
    )
    def post(self, request, id):
        serializer = CashboxMovementCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        session = active_cashbox_sessions().filter(id=id).first()
        if session is None:
            raise Http404("Cashbox session not found.")

        try:
            movement = record_cashbox_movement(
                session=session,
                actor=request.user,
                **serializer.validated_data,
            )
        except CashboxLifecycleError as error:
            return Response(
                {"detail": str(error), "code": error.code},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(CashboxMovementSerializer(movement).data, status=status.HTTP_201_CREATED)
