from django.http import Http404
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.generics import ListCreateAPIView, RetrieveAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from .permissions import IsAuthenticatedPaymentBoundary
from .serializers import (
    PaymentConfirmSerializer,
    PaymentCreateSerializer,
    PaymentSerializer,
)
from .services import (
    PaymentLifecycleError,
    active_payments,
    cancel_payment,
    confirm_payment,
    create_payment,
    reconcile_payment,
)


class PaymentListCreateAPIView(ListCreateAPIView):
    http_method_names = ["get", "post", "head", "options"]
    permission_classes = [IsAuthenticatedPaymentBoundary]

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
    permission_classes = [IsAuthenticatedPaymentBoundary]

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
    permission_classes = [IsAuthenticatedPaymentBoundary]

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
    permission_classes = [IsAuthenticatedPaymentBoundary]

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
