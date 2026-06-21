from decimal import Decimal

from rest_framework import serializers

from apps.documents.serializers import DocumentInstanceSerializer
from apps.payments.serializers import PaymentSerializer

from .models import (
    BillingInstallmentAllocation,
    BillingInvoice,
    BillingInvoiceInstallment,
    BillingInvoiceSettlement,
)


class BillingInvoiceSettlementSerializer(serializers.ModelSerializer):
    payment = PaymentSerializer(read_only=True)

    class Meta:
        model = BillingInvoiceSettlement
        fields = (
            "id",
            "payment",
            "amount",
            "settled_at",
            "settled_by",
            "notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class BillingInvoiceSerializer(serializers.ModelSerializer):
    document_instance = DocumentInstanceSerializer(read_only=True)
    settlement = BillingInvoiceSettlementSerializer(read_only=True)
    installments = serializers.SerializerMethodField()

    def get_installments(self, obj):
        items = list(obj.installments.all().order_by("due_at", "created_at", "id"))
        return BillingInvoiceInstallmentSerializer(items, many=True).data

    class Meta:
        model = BillingInvoice
        fields = (
            "id",
            "excess_receivable",
            "document_instance",
            "reservation_draft",
            "source_kind",
            "invoice_status",
            "amount",
            "issued_at",
            "settled_at",
            "settled_by",
            "notes",
            "settlement",
            "installments",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class BillingInvoiceSettleSerializer(serializers.Serializer):
    payment = serializers.UUIDField()
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class BillingInstallmentAllocationSerializer(serializers.ModelSerializer):
    payment = PaymentSerializer(read_only=True)

    class Meta:
        model = BillingInstallmentAllocation
        fields = (
            "id",
            "payment",
            "amount",
            "allocated_at",
            "allocated_by",
            "notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class BillingInvoiceInstallmentSerializer(serializers.ModelSerializer):
    allocations = BillingInstallmentAllocationSerializer(many=True, read_only=True)

    class Meta:
        model = BillingInvoiceInstallment
        fields = (
            "id",
            "invoice",
            "amount",
            "paid_amount",
            "due_at",
            "status",
            "notes",
            "allocations",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class BillingInstallmentItemSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"))
    due_at = serializers.DateTimeField()


class BillingInstallmentScheduleCreateSerializer(serializers.Serializer):
    installments = BillingInstallmentItemSerializer(many=True)
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class BillingInstallmentAllocateSerializer(serializers.Serializer):
    payment = serializers.UUIDField()
    notes = serializers.CharField(required=False, allow_blank=True, default="")
