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
    cancel_billing_invoice,
    settle_billing_invoice,
)


class BillingInvoiceListAPIView(generics.ListAPIView):
    http_method_names = ["get", "head", "options"]
    permission_classes = [IsAuthenticatedBillingBoundary]
    serializer_class = BillingInvoiceSerializer

    def get_queryset(self):
        qs = active_billing_invoices()
        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(invoice_status=status_param)
        source_kind_param = self.request.query_params.get("source_kind")
        if source_kind_param:
            qs = qs.filter(source_kind=source_kind_param)
        reservation_draft_id = self.request.query_params.get("reservation_draft_id")
        if reservation_draft_id:
            qs = qs.filter(reservation_draft_id=reservation_draft_id)
        min_amount = self.request.query_params.get("min_amount")
        if min_amount:
            qs = qs.filter(amount__gte=min_amount)
        max_amount = self.request.query_params.get("max_amount")
        if max_amount:
            qs = qs.filter(amount__lte=max_amount)
        issued_after = self.request.query_params.get("issued_after")
        if issued_after:
            qs = qs.filter(issued_at__gte=issued_after)
        issued_before = self.request.query_params.get("issued_before")
        if issued_before:
            qs = qs.filter(issued_at__lte=issued_before)
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(reservation_draft__customer__display_name__icontains=search)
        return qs


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


class BillingInvoiceCancelAPIView(APIView):
    http_method_names = ["post", "head", "options"]
    permission_classes = [IsAuthenticatedBillingBoundary]

    @extend_schema(
        responses={
            200: BillingInvoiceSerializer,
            400: OpenApiResponse(description="Billing invoice cancellation failed."),
        },
    )
    def post(self, request, id):
        invoice = active_billing_invoices().filter(id=id).first()
        if invoice is None:
            raise Http404("Billing invoice not found.")

        try:
            cancelled_invoice = cancel_billing_invoice(
                invoice=invoice,
                actor=request.user,
                notes=request.data.get("notes", ""),
            )
        except BillingLifecycleError as error:
            return Response(
                {"detail": str(error), "code": error.code},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            BillingInvoiceSerializer(cancelled_invoice).data,
            status=status.HTTP_200_OK,
        )
