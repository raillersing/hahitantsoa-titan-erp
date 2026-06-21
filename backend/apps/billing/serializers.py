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
from .services import (
    billing_installment_due_date_presets,
    compute_billing_invoice_installment_lifecycle,
    installment_is_overdue,
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
    installment_lifecycle = serializers.SerializerMethodField()
    suggested_due_dates = serializers.SerializerMethodField()

    def get_installments(self, obj):
        items = list(obj.installments.all().order_by("due_at", "created_at", "id"))
        return BillingInvoiceInstallmentSerializer(items, many=True).data

    def get_installment_lifecycle(self, obj):
        return compute_billing_invoice_installment_lifecycle(obj)

    def get_suggested_due_dates(self, obj):
        start_at = obj.reservation_draft.start_at if obj.reservation_draft_id else None
        presets = billing_installment_due_date_presets(start_at=start_at)
        if presets is None:
            return None
        return {"j30": presets.j30.isoformat(), "j10": presets.j10.isoformat()}

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
            "installment_lifecycle",
            "suggested_due_dates",
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
    is_overdue = serializers.SerializerMethodField()

    def get_is_overdue(self, obj):
        return installment_is_overdue(obj)

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
            "is_overdue",
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
