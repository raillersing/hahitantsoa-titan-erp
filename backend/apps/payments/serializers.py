from decimal import Decimal

from rest_framework import serializers

from apps.documents.serializers import DocumentInstanceSerializer
from apps.hahitantsoa.models import HahitantsoaEventDraft
from apps.inventory.models import InventoryCautionRefundObligation
from apps.reservations.models import ReservationDraft

from .models import Payment, PaymentKind, PaymentStatus


class PaymentSerializer(serializers.ModelSerializer):
    receipt_document = DocumentInstanceSerializer(read_only=True)

    class Meta:
        model = Payment
        fields = (
            "id",
            "reservation_draft",
            "hahitantsoa_event_draft",
            "receipt_document",
            "refund_obligation",
            "billing_refund_obligation",
            "payment_kind",
            "payment_method",
            "payment_status",
            "amount",
            "paid_at",
            "external_reference",
            "source_label",
            "notes",
            "confirmed_at",
            "confirmed_by",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "receipt_document",
            "confirmed_at",
            "confirmed_by",
            "created_at",
            "updated_at",
        )


class PaymentCreateSerializer(serializers.ModelSerializer):
    reservation_draft = serializers.PrimaryKeyRelatedField(
        queryset=ReservationDraft.objects.filter(is_deleted=False),
        required=False,
        allow_null=True,
    )
    hahitantsoa_event_draft = serializers.PrimaryKeyRelatedField(
        queryset=HahitantsoaEventDraft.objects.filter(is_deleted=False),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = Payment
        fields = (
            "reservation_draft",
            "hahitantsoa_event_draft",
            "payment_kind",
            "payment_method",
            "payment_status",
            "amount",
            "external_reference",
            "source_label",
            "notes",
        )

    def validate_payment_status(self, value: str) -> str:
        if value in {PaymentStatus.CONFIRMED, PaymentStatus.RECONCILED}:
            raise serializers.ValidationError(
                "Confirmed or reconciled payments must be created through the confirm workflow."
            )
        return value

    def validate_amount(self, value: Decimal) -> Decimal:
        if value is None or value <= Decimal("0.00"):
            raise serializers.ValidationError("Amount must be greater than zero.")
        return value

    def validate_payment_kind(self, value: str) -> str:
        if value == PaymentKind.REFUND:
            raise serializers.ValidationError(
                "Refund payments must be created through the dedicated refund endpoint."
            )
        return value

    def validate(self, attrs):
        reservation_draft = attrs.get("reservation_draft")
        hahitantsoa_event_draft = attrs.get("hahitantsoa_event_draft")
        source_label = (attrs.get("source_label") or "").strip()
        if reservation_draft is not None and hahitantsoa_event_draft is not None:
            raise serializers.ValidationError(
                {
                    "hahitantsoa_event_draft": (
                        "Payments must not link both a reservation draft and a "
                        "Hahitantsoa event draft."
                    )
                }
            )
        if reservation_draft is None and hahitantsoa_event_draft is None and not source_label:
            raise serializers.ValidationError(
                {
                    "source_label": (
                        "Standalone payments must define a source label when no "
                        "reservation draft or Hahitantsoa event draft is linked."
                    )
                }
            )
        return attrs


class PaymentConfirmSerializer(serializers.Serializer):
    paid_at = serializers.DateTimeField(required=False)
    external_reference = serializers.CharField(required=False, allow_blank=True, max_length=255)
    notes = serializers.CharField(required=False, allow_blank=True)


class RefundPaymentCreateSerializer(serializers.Serializer):
    refund_obligation_id = serializers.UUIDField(required=True)
    notes = serializers.CharField(required=False, allow_blank=True)

    def validate_refund_obligation_id(self, value):
        try:
            obligation = InventoryCautionRefundObligation.objects.get(id=value)
        except InventoryCautionRefundObligation.DoesNotExist:
            raise serializers.ValidationError("Refund obligation not found.")
        if obligation.status != "pending":
            raise serializers.ValidationError("Refund obligation must be pending.")
        return obligation


class RefundPaymentConfirmSerializer(serializers.Serializer):
    paid_at = serializers.DateTimeField(required=False)
    notes = serializers.CharField(required=False, allow_blank=True)
