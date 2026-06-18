from django.http import Http404
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.payments.models import Payment

from .permissions import IsAuthenticatedBillingBoundary
from .serializers import BillingInvoiceSerializer, BillingInvoiceSettleSerializer
from .services import (
    BillingLifecycleError,
    active_billing_invoices,
    settle_billing_invoice,
)


class BillingInvoiceListAPIView(generics.ListAPIView):
    http_method_names = ["get", "head", "options"]
    permission_classes = [IsAuthenticatedBillingBoundary]
    serializer_class = BillingInvoiceSerializer

    def get_queryset(self):
        return active_billing_invoices()


class BillingInvoiceRetrieveAPIView(generics.RetrieveAPIView):
    http_method_names = ["get", "head", "options"]
    permission_classes = [IsAuthenticatedBillingBoundary]
    serializer_class = BillingInvoiceSerializer
    lookup_field = "id"

    def get_queryset(self):
        return active_billing_invoices()


class BillingInvoiceSettleAPIView(APIView):
    http_method_names = ["post", "head", "options"]
    permission_classes = [IsAuthenticatedBillingBoundary]

    @extend_schema(
        request=BillingInvoiceSettleSerializer,
        responses={
            200: BillingInvoiceSerializer,
            400: OpenApiResponse(description="Billing invoice settlement failed."),
        },
    )
    def post(self, request, id):
        serializer = BillingInvoiceSettleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        invoice = active_billing_invoices().filter(id=id).first()
        if invoice is None:
            raise Http404("Billing invoice not found.")

        payment = Payment.objects.filter(id=serializer.validated_data["payment"]).first()
        if payment is None:
            raise Http404("Payment not found.")

        try:
            result = settle_billing_invoice(
                invoice=invoice,
                payment=payment,
                actor=request.user,
                notes=serializer.validated_data["notes"],
            )
        except BillingLifecycleError as error:
            return Response(
                {"detail": str(error), "code": error.code},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            BillingInvoiceSerializer(result.invoice).data,
            status=status.HTTP_200_OK,
        )
