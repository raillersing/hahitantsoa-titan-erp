from django.conf import settings
from django.http import Http404
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.generics import ListCreateAPIView, RetrieveAPIView
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from apps.identity.permissions import HasReservationSensitiveAccess

from .gateway import PaymentGatewayError
from .permissions import IsAuthenticatedPaymentBoundary
from .serializers import (
    GatewayPaymentCallbackSerializer,
    GatewayPaymentInitiateSerializer,
    PaymentConfirmSerializer,
    PaymentCreateSerializer,
    PaymentSerializer,
    RefundPaymentConfirmSerializer,
    RefundPaymentCreateSerializer,
)
from .services import (
    PaymentLifecycleError,
    active_payments,
    cancel_payment,
    confirm_payment,
    confirm_refund_payment,
    create_payment,
    create_refund_payment,
    initiate_mobile_money_payment,
    process_gateway_callback,
    reconcile_payment,
)


class SandboxGatewayUserThrottle(UserRateThrottle):
    rate = "30/minute"


def _sandbox_gateway_disabled_response() -> Response | None:
    if settings.DEBUG:
        return None
    return Response(
        {
            "detail": "The sandbox payment gateway is disabled in production.",
            "code": "gateway_sandbox_disabled",
        },
        status=status.HTTP_503_SERVICE_UNAVAILABLE,
    )


def _gateway_error_http_status(error: PaymentGatewayError) -> int:
    if error.code == "gateway_callback_payment_not_found":
        return status.HTTP_404_NOT_FOUND
    if error.code in {
        "gateway_callback_amount_mismatch",
        "gateway_callback_method_mismatch",
        "gateway_callback_reference_ambiguous",
        "gateway_callback_source_mismatch",
        "gateway_callback_status_conflict",
    }:
        return status.HTTP_409_CONFLICT
    if error.code in {
        "gateway_adapter_load_failed",
        "gateway_sandbox_disabled",
        "gateway_unknown",
    }:
        return status.HTTP_503_SERVICE_UNAVAILABLE
    return status.HTTP_400_BAD_REQUEST


class PaymentListCreateAPIView(ListCreateAPIView):
    http_method_names = ["get", "post", "head", "options"]
    permission_classes = [IsAuthenticatedPaymentBoundary]

    def get_permissions(self):
        if self.request.method.lower() == "post":
            return [HasReservationSensitiveAccess()]
        return [permission() for permission in self.permission_classes]

    def get_serializer_class(self):
        if self.request.method.lower() == "post":
            return PaymentCreateSerializer
        return PaymentSerializer

    def get_queryset(self):
        qs = active_payments()
        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(payment_status=status_param)
        kind_param = self.request.query_params.get("kind")
        if kind_param:
            qs = qs.filter(payment_kind=kind_param)
        method_param = self.request.query_params.get("method")
        if method_param:
            qs = qs.filter(payment_method=method_param)
        reservation_draft_id = self.request.query_params.get("reservation_draft_id")
        if reservation_draft_id:
            qs = qs.filter(reservation_draft_id=reservation_draft_id)
        hahitantsoa_event_draft_id = self.request.query_params.get("hahitantsoa_event_draft_id")
        if hahitantsoa_event_draft_id:
            qs = qs.filter(hahitantsoa_event_draft_id=hahitantsoa_event_draft_id)
        return qs

    @extend_schema(
        request=PaymentCreateSerializer,
        responses={201: PaymentSerializer},
    )
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payment = create_payment(actor=request.user, **serializer.validated_data)
        return Response(PaymentSerializer(payment).data, status=status.HTTP_201_CREATED)


class PaymentRetrieveAPIView(RetrieveAPIView):
    http_method_names = ["get", "head", "options"]
    permission_classes = [IsAuthenticatedPaymentBoundary]
    serializer_class = PaymentSerializer
    lookup_field = "id"

    def get_queryset(self):
        return active_payments()


class PaymentConfirmAPIView(APIView):
    http_method_names = ["post", "head", "options"]
    permission_classes = [HasReservationSensitiveAccess]

    @extend_schema(
        request=PaymentConfirmSerializer,
        responses={
            200: PaymentSerializer,
            400: OpenApiResponse(description="Payment confirmation failed."),
        },
    )
    def post(self, request, id):
        serializer = PaymentConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        payment = active_payments().filter(id=id).first()
        if payment is None:
            raise Http404("Payment not found.")

        try:
            result = confirm_payment(
                payment=payment,
                actor=request.user,
                **serializer.validated_data,
            )
        except PaymentLifecycleError as error:
            return Response(
                {"detail": str(error), "code": error.code},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(PaymentSerializer(result.payment).data, status=status.HTTP_200_OK)


class PaymentCancelAPIView(APIView):
    http_method_names = ["post", "head", "options"]
    permission_classes = [HasReservationSensitiveAccess]

    @extend_schema(
        responses={
            200: PaymentSerializer,
            400: OpenApiResponse(description="Payment cancellation failed."),
            403: OpenApiResponse(description="Unauthorized."),
            404: OpenApiResponse(description="Payment not found."),
        },
    )
    def post(self, request, id):
        payment = active_payments().filter(id=id).first()
        if payment is None:
            raise Http404("Payment not found.")

        try:
            payment = cancel_payment(
                payment=payment,
                actor=request.user,
                notes=request.data.get("notes"),
            )
        except PaymentLifecycleError as error:
            return Response(
                {"detail": str(error), "code": error.code},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(PaymentSerializer(payment).data, status=status.HTTP_200_OK)


class PaymentReconcileAPIView(APIView):
    http_method_names = ["post", "head", "options"]
    permission_classes = [HasReservationSensitiveAccess]

    @extend_schema(
        responses={
            200: PaymentSerializer,
            400: OpenApiResponse(description="Payment reconciliation failed."),
            403: OpenApiResponse(description="Unauthorized."),
            404: OpenApiResponse(description="Payment not found."),
        },
    )
    def post(self, request, id):
        payment = active_payments().filter(id=id).first()
        if payment is None:
            raise Http404("Payment not found.")

        try:
            payment = reconcile_payment(
                payment=payment,
                actor=request.user,
                notes=request.data.get("notes"),
            )
        except PaymentLifecycleError as error:
            return Response(
                {"detail": str(error), "code": error.code},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(PaymentSerializer(payment).data, status=status.HTTP_200_OK)


class RefundPaymentCreateAPIView(APIView):
    http_method_names = ["post", "head", "options"]
    permission_classes = [HasReservationSensitiveAccess]

    @extend_schema(
        request=RefundPaymentCreateSerializer,
        responses={
            201: PaymentSerializer,
            400: OpenApiResponse(description="Refund payment creation failed."),
        },
    )
    def post(self, request):
        serializer = RefundPaymentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            payment = create_refund_payment(
                refund_obligation=serializer.validated_data["refund_obligation_id"],
                actor=request.user,
                notes=serializer.validated_data.get("notes"),
            )
        except PaymentLifecycleError as error:
            return Response(
                {"detail": str(error), "code": error.code},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(PaymentSerializer(payment).data, status=status.HTTP_201_CREATED)


class RefundPaymentConfirmAPIView(APIView):
    http_method_names = ["post", "head", "options"]
    permission_classes = [HasReservationSensitiveAccess]

    @extend_schema(
        request=RefundPaymentConfirmSerializer,
        responses={
            200: PaymentSerializer,
            400: OpenApiResponse(description="Refund payment confirmation failed."),
            404: OpenApiResponse(description="Payment not found."),
        },
    )
    def post(self, request, id):
        serializer = RefundPaymentConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        payment = active_payments().filter(id=id).first()
        if payment is None:
            raise Http404("Payment not found.")

        try:
            result = confirm_refund_payment(
                payment=payment,
                actor=request.user,
                **serializer.validated_data,
            )
        except PaymentLifecycleError as error:
            return Response(
                {"detail": str(error), "code": error.code},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(PaymentSerializer(result.payment).data, status=status.HTTP_200_OK)


class GatewayPaymentInitiateAPIView(APIView):
    http_method_names = ["post", "head", "options"]
    permission_classes = [HasReservationSensitiveAccess]
    throttle_classes = [SandboxGatewayUserThrottle]

    @extend_schema(
        request=GatewayPaymentInitiateSerializer,
        responses={
            201: OpenApiResponse(description="Payment initiated via gateway."),
            400: OpenApiResponse(description="Initiation failed."),
            404: OpenApiResponse(description="Reservation draft not found."),
            503: OpenApiResponse(description="Sandbox gateway disabled or unavailable."),
        },
    )
    def post(self, request, reservation_draft_id):
        from apps.reservations.models import ReservationDraft

        disabled_response = _sandbox_gateway_disabled_response()
        if disabled_response is not None:
            return disabled_response

        serializer = GatewayPaymentInitiateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        draft = ReservationDraft.objects.filter(id=reservation_draft_id).first()
        if draft is None:
            raise Http404("Reservation draft not found.")

        try:
            result = initiate_mobile_money_payment(
                reservation_draft=draft,
                amount=serializer.validated_data["amount"],
                currency=serializer.validated_data["currency"],
                actor=request.user,
                notes=serializer.validated_data["notes"],
            )
        except PaymentGatewayError as error:
            return Response(
                {"detail": str(error), "code": error.code},
                status=_gateway_error_http_status(error),
            )

        return Response(
            {
                "payment_id": str(result.payment.id),
                "transaction_reference": result.gateway_result.transaction_reference,
                "status": result.payment.payment_status,
                "gateway": result.gateway_result.raw_response.get("gateway", "unknown"),
            },
            status=status.HTTP_201_CREATED,
        )


class GatewayPaymentCallbackAPIView(APIView):
    http_method_names = ["post", "head", "options"]
    permission_classes = [HasReservationSensitiveAccess]
    throttle_classes = [SandboxGatewayUserThrottle]

    @extend_schema(
        request=GatewayPaymentCallbackSerializer,
        responses={
            200: OpenApiResponse(description="Callback processed."),
            400: OpenApiResponse(description="Callback validation failed."),
            404: OpenApiResponse(description="Payment not found."),
            409: OpenApiResponse(description="Callback conflicts with payment state."),
            503: OpenApiResponse(description="Sandbox gateway disabled or unavailable."),
        },
    )
    def post(self, request):
        disabled_response = _sandbox_gateway_disabled_response()
        if disabled_response is not None:
            return disabled_response

        serializer = GatewayPaymentCallbackSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            result = process_gateway_callback(
                payload=serializer.validated_data,
                actor=request.user,
            )
        except PaymentGatewayError as error:
            return Response(
                {"detail": str(error), "code": error.code},
                status=_gateway_error_http_status(error),
            )

        return Response(
            {
                "payment_id": str(result.payment.id),
                "transaction_reference": result.callback_result.transaction_reference,
                "status": result.payment.payment_status,
            },
            status=status.HTTP_200_OK,
        )
