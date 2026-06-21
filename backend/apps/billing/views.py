from django.http import Http404
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.identity.permissions import HasReservationSensitiveAccess
from apps.payments.models import Payment

from .models import BillingRefundObligation
from .permissions import IsAuthenticatedBillingBoundary
from .serializers import (
    BillingInstallmentAllocateSerializer,
    BillingInstallmentScheduleCreateSerializer,
    BillingInvoiceCorrectSerializer,
    BillingInvoiceInstallmentSerializer,
    BillingInvoiceSerializer,
    BillingInvoiceSettleSerializer,
    BillingRefundObligationExecuteSerializer,
    BillingRefundObligationSerializer,
)
from .services import (
    BillingInstallmentItem,
    BillingLifecycleError,
    active_billing_invoice_installments,
    active_billing_invoices,
    allocate_payment_to_installment,
    cancel_billing_invoice,
    create_billing_invoice_installments,
    create_billing_invoice_refund_obligation,
    execute_billing_refund_obligation,
    filter_billing_invoices_by_closeout_status,
    filter_billing_invoices_by_remaining_balance,
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
        closeout_status = self.request.query_params.get("closeout_status")
        if closeout_status:
            qs = filter_billing_invoices_by_closeout_status(qs, closeout_status)
        has_remaining_balance = self.request.query_params.get("has_remaining_balance")
        if has_remaining_balance is not None:
            normalized = has_remaining_balance.strip().lower()
            if normalized in {"true", "1", "yes"}:
                qs = filter_billing_invoices_by_remaining_balance(qs, has_remaining_balance=True)
            elif normalized in {"false", "0", "no"}:
                qs = filter_billing_invoices_by_remaining_balance(qs, has_remaining_balance=False)
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
    permission_classes = [HasReservationSensitiveAccess]

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
    permission_classes = [HasReservationSensitiveAccess]

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


class BillingInvoiceInstallmentCreateAPIView(APIView):
    http_method_names = ["post", "head", "options"]
    permission_classes = [HasReservationSensitiveAccess]

    @extend_schema(
        request=BillingInstallmentScheduleCreateSerializer,
        responses={
            200: BillingInvoiceInstallmentSerializer(many=True),
            400: OpenApiResponse(description="Installment schedule creation failed."),
            403: OpenApiResponse(description="Unauthorized."),
            404: OpenApiResponse(description="Billing invoice not found."),
        },
    )
    def post(self, request, id):
        serializer = BillingInstallmentScheduleCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        invoice = active_billing_invoices().filter(id=id).first()
        if invoice is None:
            raise Http404("Billing invoice not found.")

        items = [
            BillingInstallmentItem(amount=item["amount"], due_at=item["due_at"])
            for item in serializer.validated_data["installments"]
        ]

        try:
            installments = create_billing_invoice_installments(
                invoice=invoice,
                installments=items,
                actor=request.user,
                notes=serializer.validated_data.get("notes", ""),
            )
        except BillingLifecycleError as error:
            return Response(
                {"detail": str(error), "code": error.code},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            BillingInvoiceInstallmentSerializer(installments, many=True).data,
            status=status.HTTP_201_CREATED,
        )


class BillingInstallmentAllocateAPIView(APIView):
    http_method_names = ["post", "head", "options"]
    permission_classes = [HasReservationSensitiveAccess]

    @extend_schema(
        request=BillingInstallmentAllocateSerializer,
        responses={
            200: BillingInvoiceInstallmentSerializer,
            400: OpenApiResponse(description="Installment allocation failed."),
            403: OpenApiResponse(description="Unauthorized."),
            404: OpenApiResponse(description="Installment or payment not found."),
        },
    )
    def post(self, request, id):
        serializer = BillingInstallmentAllocateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        installment = active_billing_invoice_installments().filter(id=id).first()
        if installment is None:
            raise Http404("Billing installment not found.")

        payment = Payment.objects.filter(id=serializer.validated_data["payment"]).first()
        if payment is None:
            raise Http404("Payment not found.")

        try:
            result = allocate_payment_to_installment(
                installment=installment,
                payment=payment,
                actor=request.user,
                notes=serializer.validated_data.get("notes", ""),
            )
        except BillingLifecycleError as error:
            return Response(
                {"detail": str(error), "code": error.code},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            BillingInvoiceInstallmentSerializer(result.installment).data,
            status=status.HTTP_200_OK,
        )


class BillingInvoiceCorrectAPIView(APIView):
    http_method_names = ["post", "head", "options"]
    permission_classes = [HasReservationSensitiveAccess]

    @extend_schema(
        request=BillingInvoiceCorrectSerializer,
        responses={
            201: BillingRefundObligationSerializer,
            400: OpenApiResponse(description="Billing invoice correction failed."),
            403: OpenApiResponse(description="Unauthorized."),
            404: OpenApiResponse(description="Billing invoice not found."),
        },
    )
    def post(self, request, id):
        serializer = BillingInvoiceCorrectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        invoice = active_billing_invoices().filter(id=id).first()
        if invoice is None:
            raise Http404("Billing invoice not found.")

        try:
            obligation = create_billing_invoice_refund_obligation(
                invoice=invoice,
                actor=request.user,
                notes=serializer.validated_data.get("notes", ""),
            )
        except BillingLifecycleError as error:
            return Response(
                {"detail": str(error), "code": error.code},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            BillingRefundObligationSerializer(obligation).data,
            status=status.HTTP_201_CREATED,
        )


class BillingRefundObligationExecuteAPIView(APIView):
    http_method_names = ["post", "head", "options"]
    permission_classes = [HasReservationSensitiveAccess]

    @extend_schema(
        request=BillingRefundObligationExecuteSerializer,
        responses={
            200: BillingRefundObligationSerializer,
            403: OpenApiResponse(description="Unauthorized."),
            404: OpenApiResponse(description="Billing refund obligation not found."),
        },
    )
    def post(self, request, id):
        serializer = BillingRefundObligationExecuteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        obligation = (
            BillingRefundObligation.objects.select_related(
                "invoice",
                "invoice__reservation_draft",
                "invoice__reservation_draft__customer",
                "document_instance",
                "executed_by",
            )
            .prefetch_related("refund_payments", "refund_payments__receipt_document")
            .filter(id=id)
            .first()
        )
        if obligation is None:
            raise Http404("Billing refund obligation not found.")

        try:
            result = execute_billing_refund_obligation(
                obligation=obligation,
                actor=request.user,
                notes=serializer.validated_data.get("notes"),
            )
        except BillingLifecycleError as error:
            return Response(
                {"detail": str(error), "code": error.code},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(
            BillingRefundObligationSerializer(result.obligation).data,
            status=status.HTTP_200_OK,
        )
