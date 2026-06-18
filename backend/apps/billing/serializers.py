from rest_framework import serializers

from apps.documents.serializers import DocumentInstanceSerializer
from apps.payments.serializers import PaymentSerializer

from .models import BillingInvoice, BillingInvoiceSettlement


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
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class BillingInvoiceSettleSerializer(serializers.Serializer):
    payment = serializers.UUIDField()
    notes = serializers.CharField(required=False, allow_blank=True, default="")
