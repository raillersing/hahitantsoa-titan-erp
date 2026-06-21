from decimal import Decimal

from rest_framework import serializers

from apps.billing.models import BillingInvoice, BillingRefundObligation
from apps.billing.serializers import (
    BillingInvoiceSerializer,
    BillingRefundObligationSerializer,
)
from apps.payments.models import Payment
from apps.payments.serializers import PaymentSerializer

from .models import CashboxMovement, CashboxSession
from .services import compute_cashbox_session_net_amount


class CashboxMovementSerializer(serializers.ModelSerializer):
    payment = PaymentSerializer(read_only=True)
    billing_invoice = BillingInvoiceSerializer(read_only=True)
    billing_refund_obligation = BillingRefundObligationSerializer(read_only=True)

    class Meta:
        model = CashboxMovement
        fields = (
            "id",
            "session",
            "direction",
            "amount",
            "payment",
            "billing_invoice",
            "billing_refund_obligation",
            "moved_at",
            "moved_by",
            "note",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class CashboxSessionSerializer(serializers.ModelSerializer):
    movements = CashboxMovementSerializer(many=True, read_only=True)
    net_amount = serializers.SerializerMethodField()

    def get_net_amount(self, obj):
        return compute_cashbox_session_net_amount(obj)

    class Meta:
        model = CashboxSession
        fields = (
            "id",
            "operator",
            "opened_at",
            "opened_by",
            "closed_at",
            "closed_by",
            "opening_note",
            "closing_note",
            "net_amount",
            "movements",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class CashboxSessionOpenSerializer(serializers.Serializer):
    operator = serializers.PrimaryKeyRelatedField(
        queryset=CashboxSession._meta.get_field("operator").remote_field.model.objects.all()
    )
    opening_note = serializers.CharField(required=False, allow_blank=True, default="")


class CashboxSessionCloseSerializer(serializers.Serializer):
    closing_note = serializers.CharField(required=False, allow_blank=True, default="")


class CashboxMovementCreateSerializer(serializers.Serializer):
    direction = serializers.ChoiceField(
        choices=CashboxMovement._meta.get_field("direction").choices
    )
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"))
    payment = serializers.PrimaryKeyRelatedField(
        queryset=Payment.objects.all(),
        required=False,
        allow_null=True,
    )
    billing_invoice = serializers.PrimaryKeyRelatedField(
        queryset=BillingInvoice.objects.all(),
        required=False,
        allow_null=True,
    )
    billing_refund_obligation = serializers.PrimaryKeyRelatedField(
        queryset=BillingRefundObligation.objects.all(),
        required=False,
        allow_null=True,
    )
    note = serializers.CharField(required=False, allow_blank=True, default="")

    def validate(self, attrs):
        linked_reference_count = sum(
            1
            for key in ("payment", "billing_invoice", "billing_refund_obligation")
            if attrs.get(key) is not None
        )
        if linked_reference_count > 1:
            raise serializers.ValidationError(
                "Cashbox movements may reference at most one financial record."
            )
        return attrs
