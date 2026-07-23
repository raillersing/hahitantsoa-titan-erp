from decimal import Decimal

from rest_framework import serializers

from apps.billing.models import BillingInvoice, BillingRefundObligation
from apps.billing.serializers import BillingInvoiceSerializer, BillingRefundObligationSerializer
from apps.finance.models import FinanceAccount
from apps.payments.models import Payment
from apps.payments.serializers import PaymentSerializer

from .models import CashboxClosureAttempt, CashboxMovement, CashboxReopenEvent, CashboxSession
from .services import compute_cashbox_session_net_amount, compute_cashbox_session_theoretical_amount


class CashboxClosureAttemptSerializer(serializers.ModelSerializer):
    validated_at = serializers.SerializerMethodField()
    validated_by = serializers.SerializerMethodField()

    def get_validated_at(self, obj):
        try:
            return obj.validation.validated_at
        except CashboxClosureAttempt.validation.RelatedObjectDoesNotExist:
            return None

    def get_validated_by(self, obj):
        try:
            return obj.validation.validated_by_id
        except CashboxClosureAttempt.validation.RelatedObjectDoesNotExist:
            return None

    class Meta:
        model = CashboxClosureAttempt
        fields = (
            "id",
            "theoretical_amount",
            "actual_amount",
            "variance_amount",
            "variance_justification",
            "submitted_at",
            "submitted_by",
            "submission_idempotency_key",
            "validated_at",
            "validated_by",
        )
        read_only_fields = fields


class CashboxReopenEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = CashboxReopenEvent
        fields = (
            "id",
            "closure_attempt",
            "reason",
            "reopened_at",
            "reopened_by",
            "idempotency_key",
        )
        read_only_fields = fields


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
    closure_attempts = CashboxClosureAttemptSerializer(many=True, read_only=True)
    reopen_events = CashboxReopenEventSerializer(many=True, read_only=True)
    net_amount = serializers.SerializerMethodField()
    theoretical_amount = serializers.SerializerMethodField()

    def get_net_amount(self, obj):
        return compute_cashbox_session_net_amount(obj)

    def get_theoretical_amount(self, obj):
        return compute_cashbox_session_theoretical_amount(obj)

    class Meta:
        model = CashboxSession
        fields = (
            "id",
            "cash_account",
            "operator",
            "opening_amount",
            "status",
            "opened_at",
            "opened_by",
            "closed_at",
            "closed_by",
            "opening_note",
            "closing_note",
            "net_amount",
            "theoretical_amount",
            "movements",
            "closure_attempts",
            "reopen_events",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class CashboxSessionOpenSerializer(serializers.Serializer):
    operator = serializers.PrimaryKeyRelatedField(
        queryset=CashboxSession._meta.get_field("operator").remote_field.model.objects.all()
    )
    cash_account = serializers.PrimaryKeyRelatedField(queryset=FinanceAccount.objects.all())
    opening_amount = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal("0.00")
    )
    opening_note = serializers.CharField(required=False, allow_blank=True, default="")


class CashboxSessionCloseSerializer(serializers.Serializer):
    closing_note = serializers.CharField(required=False, allow_blank=True, default="")


class CashboxCountSubmitSerializer(serializers.Serializer):
    actual_amount = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal("0.00")
    )
    variance_justification = serializers.CharField(required=False, allow_blank=True, default="")
    idempotency_key = serializers.CharField(max_length=128, trim_whitespace=True)


class CashboxCountValidateSerializer(serializers.Serializer):
    idempotency_key = serializers.CharField(max_length=128, trim_whitespace=True)


class CashboxSessionReopenSerializer(serializers.Serializer):
    reason = serializers.CharField(trim_whitespace=True)
    idempotency_key = serializers.CharField(max_length=128, trim_whitespace=True)


class CashboxMovementCreateSerializer(serializers.Serializer):
    direction = serializers.ChoiceField(
        choices=CashboxMovement._meta.get_field("direction").choices
    )
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"))
    payment = serializers.PrimaryKeyRelatedField(
        queryset=Payment.objects.all(), required=False, allow_null=True
    )
    billing_invoice = serializers.PrimaryKeyRelatedField(
        queryset=BillingInvoice.objects.all(), required=False, allow_null=True
    )
    billing_refund_obligation = serializers.PrimaryKeyRelatedField(
        queryset=BillingRefundObligation.objects.all(), required=False, allow_null=True
    )
    note = serializers.CharField(required=False, allow_blank=True, default="")

    def validate(self, attrs):
        if (
            sum(
                attrs.get(key) is not None
                for key in ("payment", "billing_invoice", "billing_refund_obligation")
            )
            > 1
        ):
            raise serializers.ValidationError(
                "Cashbox movements may reference at most one financial record."
            )
        return attrs
