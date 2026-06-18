from decimal import Decimal

from rest_framework import serializers

from apps.documents.serializers import DocumentInstanceSerializer
from apps.reservations.models import ReservationDraft

from .models import Payment, PaymentStatus


class PaymentSerializer(serializers.ModelSerializer):
    receipt_document = DocumentInstanceSerializer(read_only=True)

    class Meta:
        model = Payment
        fields = (
            "id",
            "reservation_draft",
            "receipt_document",
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

    class Meta:
        model = Payment
        fields = (
            "reservation_draft",
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

    def validate(self, attrs):
        reservation_draft = attrs.get("reservation_draft")
        source_label = (attrs.get("source_label") or "").strip()
        if reservation_draft is None and not source_label:
            raise serializers.ValidationError(
                {
                    "source_label": (
                        "Standalone payments must define a source label when no "
                        "reservation draft is linked."
                    )
                }
            )
        return attrs


class PaymentConfirmSerializer(serializers.Serializer):
    paid_at = serializers.DateTimeField(required=False)
    external_reference = serializers.CharField(required=False, allow_blank=True, max_length=255)
    notes = serializers.CharField(required=False, allow_blank=True)
