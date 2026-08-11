from django.conf import settings
from django.http import Http404
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.generics import ListCreateAPIView, RetrieveAPIView
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from apps.finance.models import FinanceAccount
from apps.hahitantsoa.models import HahitantsoaEventDraft
from apps.identity.permissions import HasReservationSensitiveAccess
from apps.reservations.models import ReservationDraft

from .gateway import PaymentGatewayError
from .models import PaymentReconciliationImport
from .permissions import IsAuthenticatedPaymentBoundary
from .reminders import build_hahitantsoa_payment_reminder, build_reservation_payment_reminder
from .serializers import (
    GatewayPaymentCallbackSerializer,
    GatewayPaymentInitiateSerializer,
    PaymentConfirmSerializer,
    PaymentCreateSerializer,
    PaymentSerializer,
    ReconciliationCommitSerializer,
    ReconciliationCsvPreviewSerializer,
    RefundPaymentConfirmSerializer,
    RefundPaymentCreateSerializer,
)
from .services import (
    PaymentLifecycleError,
    PaymentReconciliationError,
    active_payments,
    cancel_payment,
    commit_reconciliation_import,
    confirm_payment,
    confirm_refund_payment,
    create_payment,
    create_refund_payment,
    initiate_mobile_money_payment,
    process_gateway_callback,
    stage_reconciliation_csv,
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


class PaymentReminderWhatsAppAPIView(APIView):
    """Build a reviewed payment recap for an operator to open in WhatsApp."""

    http_method_names = ["get", "head", "options"]
    permission_classes = [HasReservationSensitiveAccess]

    def get(self, request):
        reservation_draft_id = request.query_params.get("reservation_draft_id")
        hahitantsoa_event_draft_id = request.query_params.get("hahitantsoa_event_draft_id")
        if bool(reservation_draft_id) == bool(hahitantsoa_event_draft_id):
            return Response(
                {
                    "detail": (
                        "Provide exactly one reservation_draft_id or hahitantsoa_event_draft_id."
                    ),
                    "code": "payment_reminder_single_draft_required",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if reservation_draft_id:
            draft = get_object_or_404(
                ReservationDraft.objects.select_related("customer"),
                id=reservation_draft_id,
                is_deleted=False,
            )
            reminder = build_reservation_payment_reminder(reservation_draft=draft)
        else:
            draft = get_object_or_404(
                HahitantsoaEventDraft.objects.select_related("customer"),
                id=hahitantsoa_event_draft_id,
                is_deleted=False,
            )
            reminder = build_hahitantsoa_payment_reminder(hahitantsoa_event_draft=draft)

        return Response(
            {
                "business_scope": reminder.business_scope,
                "draft_id": reminder.draft_id,
                "reference": reminder.reference,
                "customer_name": reminder.customer_name,
                "customer_phone": reminder.customer_phone,
                "event_label": reminder.event_label,
                "start_at": reminder.start_at,
                "end_at": reminder.end_at,
                "confirmed_payment_count": reminder.confirmed_payment_count,
                "confirmed_amount": str(reminder.confirmed_amount),
                "refunded_amount": str(reminder.refunded_amount),
                "net_amount": str(reminder.net_amount),
                "payments": reminder.payments,
                "message": reminder.message,
                "whatsapp_url": reminder.whatsapp_url,
                "whatsapp_available": reminder.whatsapp_url is not None,
            },
            status=status.HTTP_200_OK,
        )


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


class PaymentReconciliationCsvPreviewAPIView(APIView):
    http_method_names = ["post", "head", "options"]
    permission_classes = [HasReservationSensitiveAccess]

    def post(self, request):
        serializer = ReconciliationCsvPreviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        account = FinanceAccount.objects.filter(id=serializer.validated_data["account_id"]).first()
        if account is None:
            raise Http404("Finance account not found.")
        try:
            reconciliation_import = stage_reconciliation_csv(
                account=account,
                actor=request.user,
                csv_content=serializer.validated_data["csv_content"],
            )
        except PaymentReconciliationError as error:
            return Response(
                {"detail": str(error), "code": error.code}, status=status.HTTP_400_BAD_REQUEST
            )
        return Response(
            {
                "id": str(reconciliation_import.id),
                "status": reconciliation_import.status,
                "line_count": reconciliation_import.lines.count(),
            },
            status=status.HTTP_201_CREATED,
        )


class PaymentReconciliationImportCommitAPIView(APIView):
    http_method_names = ["post", "head", "options"]
    permission_classes = [HasReservationSensitiveAccess]

    def post(self, request, id):
        serializer = ReconciliationCommitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reconciliation_import = PaymentReconciliationImport.objects.filter(id=id).first()
        if reconciliation_import is None:
            raise Http404("Reconciliation import not found.")
        try:
            committed = commit_reconciliation_import(
                reconciliation_import=reconciliation_import,
                actor=request.user,
                **serializer.validated_data,
            )
        except PaymentReconciliationError as error:
            return Response(
                {"detail": str(error), "code": error.code}, status=status.HTTP_400_BAD_REQUEST
            )
        return Response(
            {"id": str(committed.id), "status": committed.status}, status=status.HTTP_200_OK
        )


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
        return Response(
            {
                "detail": (
                    "Direct reconciliation is disabled; commit an external statement "
                    "reconciliation import."
                ),
                "code": "reconciliation_evidence_required",
            },
            status=status.HTTP_409_CONFLICT,
        )


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
