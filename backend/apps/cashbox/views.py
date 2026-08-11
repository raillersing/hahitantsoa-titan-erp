from django.db.models import Q
from django.http import Http404
from drf_spectacular.utils import extend_schema
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.identity.permissions import HasReservationSensitiveAccess
from apps.identity.authorization import is_cashbox_supervisor_actor

from .serializers import (
    CashboxCountSubmitSerializer,
    CashboxCountValidateSerializer,
    CashboxMovementCreateSerializer,
    CashboxMovementSerializer,
    CashboxSessionOpenSerializer,
    CashboxSessionReopenSerializer,
    CashboxSessionSerializer,
)
from .services import (
    CashboxLifecycleError,
    active_cashbox_movements,
    active_cashbox_sessions,
    open_cashbox_session,
    record_cashbox_movement,
    reopen_cashbox_session,
    submit_cashbox_count,
    validate_cashbox_count,
)


def _lifecycle_error_response(error):
    return Response({"detail": str(error), "code": error.code}, status=status.HTTP_400_BAD_REQUEST)


def _sessions_visible_to_actor(actor):
    queryset = active_cashbox_sessions()
    if getattr(actor, "is_staff", False) or is_cashbox_supervisor_actor(actor=actor):
        return queryset
    return queryset.filter(operator=actor)


class CashboxSessionListAPIView(generics.ListAPIView):
    http_method_names = ["get", "head", "options"]
    permission_classes = [HasReservationSensitiveAccess]
    serializer_class = CashboxSessionSerializer

    def get_queryset(self):
        qs = _sessions_visible_to_actor(self.request.user)
        if operator_id := self.request.query_params.get("operator_id"):
            qs = qs.filter(operator_id=operator_id)
        if status_param := self.request.query_params.get("status"):
            qs = qs.filter(status=status_param)
        return qs


class CashboxSessionRetrieveAPIView(generics.RetrieveAPIView):
    http_method_names = ["get", "head", "options"]
    permission_classes = [HasReservationSensitiveAccess]
    serializer_class = CashboxSessionSerializer
    lookup_field = "id"

    def get_queryset(self):
        return _sessions_visible_to_actor(self.request.user)


class CashboxSessionOpenAPIView(APIView):
    http_method_names = ["post", "head", "options"]
    permission_classes = [HasReservationSensitiveAccess]

    @extend_schema(request=CashboxSessionOpenSerializer, responses={201: CashboxSessionSerializer})
    def post(self, request):
        serializer = CashboxSessionOpenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        operator = serializer.validated_data["operator"]
        privileged = getattr(request.user, "is_staff", False) or is_cashbox_supervisor_actor(
            actor=request.user
        )
        if operator.pk != request.user.pk and not privileged:
            return Response(
                {"detail": "Un opérateur ne peut ouvrir que sa propre caisse."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if not privileged:
            serializer.validated_data["cash_account"] = None
        try:
            session = open_cashbox_session(actor=request.user, **serializer.validated_data)
        except CashboxLifecycleError as error:
            return _lifecycle_error_response(error)
        return Response(CashboxSessionSerializer(session).data, status=status.HTTP_201_CREATED)


class CashboxSessionLegacyCloseAPIView(APIView):
    """Preserve the retired endpoint without allowing a direct close bypass."""

    http_method_names = ["post", "head", "options"]
    permission_classes = [HasReservationSensitiveAccess]

    def post(self, request, id):
        if not _sessions_visible_to_actor(request.user).filter(id=id).exists():
            raise Http404("Cashbox session not found.")
        return Response(
            {
                "detail": (
                    "Direct cashbox closure is deprecated; submit a count and have a supervisor "
                    "validate it."
                ),
                "code": "cashbox_direct_close_deprecated",
            },
            status=status.HTTP_410_GONE,
        )


class CashboxSessionCountSubmitAPIView(APIView):
    http_method_names = ["post", "head", "options"]
    permission_classes = [HasReservationSensitiveAccess]

    @extend_schema(request=CashboxCountSubmitSerializer, responses={200: CashboxSessionSerializer})
    def post(self, request, id):
        serializer = CashboxCountSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        session = _sessions_visible_to_actor(request.user).filter(id=id).first()
        if session is None:
            raise Http404("Cashbox session not found.")
        try:
            submit_cashbox_count(session=session, actor=request.user, **serializer.validated_data)
        except CashboxLifecycleError as error:
            return _lifecycle_error_response(error)
        session.refresh_from_db()
        return Response(CashboxSessionSerializer(session).data)


class CashboxSessionCountValidateAPIView(APIView):
    http_method_names = ["post", "head", "options"]
    permission_classes = [HasReservationSensitiveAccess]

    @extend_schema(
        request=CashboxCountValidateSerializer, responses={200: CashboxSessionSerializer}
    )
    def post(self, request, id):
        serializer = CashboxCountValidateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        session = _sessions_visible_to_actor(request.user).filter(id=id).first()
        if session is None:
            raise Http404("Cashbox session not found.")
        idempotency_key = serializer.validated_data["idempotency_key"]
        closure = (
            session.closure_attempts.filter(
                Q(validation__isnull=True) | Q(validation__idempotency_key=idempotency_key)
            )
            .order_by("-submitted_at")
            .first()
        )
        if closure is None:
            return Response(
                {"detail": "No submitted cashbox count exists.", "code": "cashbox_count_not_found"},
                status=400,
            )
        try:
            validate_cashbox_count(closure=closure, actor=request.user, **serializer.validated_data)
        except PermissionError as error:
            return Response({"detail": str(error)}, status=status.HTTP_403_FORBIDDEN)
        except CashboxLifecycleError as error:
            return _lifecycle_error_response(error)
        session.refresh_from_db()
        return Response(CashboxSessionSerializer(session).data)


class CashboxSessionReopenAPIView(APIView):
    http_method_names = ["post", "head", "options"]
    permission_classes = [HasReservationSensitiveAccess]

    @extend_schema(
        request=CashboxSessionReopenSerializer, responses={200: CashboxSessionSerializer}
    )
    def post(self, request, id):
        serializer = CashboxSessionReopenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        session = _sessions_visible_to_actor(request.user).filter(id=id).first()
        if session is None:
            raise Http404("Cashbox session not found.")
        try:
            session = reopen_cashbox_session(
                session=session, actor=request.user, **serializer.validated_data
            )
        except PermissionError as error:
            return Response({"detail": str(error)}, status=status.HTTP_403_FORBIDDEN)
        except CashboxLifecycleError as error:
            return _lifecycle_error_response(error)
        return Response(CashboxSessionSerializer(session).data)


class CashboxMovementListAPIView(generics.ListAPIView):
    http_method_names = ["get", "head", "options"]
    permission_classes = [HasReservationSensitiveAccess]
    serializer_class = CashboxMovementSerializer

    def get_queryset(self):
        qs = active_cashbox_movements()
        if not (getattr(self.request.user, "is_staff", False) or is_cashbox_supervisor_actor(actor=self.request.user)):
            qs = qs.filter(session__operator=self.request.user)
        if session_id := self.request.query_params.get("session_id"):
            qs = qs.filter(session_id=session_id)
        if direction := self.request.query_params.get("direction"):
            qs = qs.filter(direction=direction)
        return qs


class CashboxMovementCreateAPIView(APIView):
    http_method_names = ["post", "head", "options"]
    permission_classes = [HasReservationSensitiveAccess]

    @extend_schema(
        request=CashboxMovementCreateSerializer, responses={201: CashboxMovementSerializer}
    )
    def post(self, request, id):
        serializer = CashboxMovementCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        session = _sessions_visible_to_actor(request.user).filter(id=id).first()
        if session is None:
            raise Http404("Cashbox session not found.")
        try:
            movement = record_cashbox_movement(
                session=session, actor=request.user, **serializer.validated_data
            )
        except CashboxLifecycleError as error:
            return _lifecycle_error_response(error)
        return Response(CashboxMovementSerializer(movement).data, status=status.HTTP_201_CREATED)
