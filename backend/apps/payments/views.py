from django.http import Http404
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.generics import ListCreateAPIView, RetrieveAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.payments.permissions import IsAuthenticatedPaymentBoundary
from apps.payments.serializers import (
    PaymentConfirmSerializer,
    PaymentCreateSerializer,
    PaymentSerializer,
)
from apps.payments.services import (
    PaymentLifecycleError,
    active_payments,
    confirm_payment,
    create_payment,
)


class PaymentListCreateAPIView(ListCreateAPIView):
    http_method_names = ["get", "post", "head", "options"]
    permission_classes = [IsAuthenticatedPaymentBoundary]

    def get_serializer_class(self):
        if self.request.method.lower() == "post":
            return PaymentCreateSerializer
        return PaymentSerializer

    def get_queryset(self):
        return active_payments()

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
