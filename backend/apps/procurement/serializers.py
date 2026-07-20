from rest_framework import serializers

from .models import PurchaseOrder, PurchaseOrderStatus, QuickExpense, QuickExpenseCategory


class PurchaseOrderSerializer(serializers.ModelSerializer):
    class Meta:
        model = PurchaseOrder
        fields = [
            "id",
            "reference",
            "supplier_name",
            "subject",
            "amount",
            "status",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "reference", "created_at", "updated_at"]


class PurchaseOrderCreateSerializer(serializers.Serializer):
    supplier_name = serializers.CharField(max_length=255)
    subject = serializers.CharField(max_length=512, required=False, allow_blank=True, default="")
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    status = serializers.ChoiceField(
        choices=PurchaseOrderStatus.choices,
        default=PurchaseOrderStatus.PENDING,
        required=False,
    )
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class PurchaseOrderUpdateSerializer(serializers.Serializer):
    supplier_name = serializers.CharField(max_length=255, required=False)
    subject = serializers.CharField(max_length=512, required=False)
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, required=False)
    status = serializers.ChoiceField(choices=PurchaseOrderStatus.choices, required=False)
    notes = serializers.CharField(required=False)


class QuickExpenseSerializer(serializers.ModelSerializer):
    recorded_by_display = serializers.CharField(source="recorded_by.get_full_name", read_only=True)

    class Meta:
        model = QuickExpense
        fields = [
            "id",
            "amount",
            "category",
            "description",
            "recorded_by",
            "recorded_by_display",
            "created_at",
        ]
        read_only_fields = ["id", "created_at", "recorded_by", "recorded_by_display"]


class QuickExpenseCreateSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    category = serializers.ChoiceField(
        choices=QuickExpenseCategory.choices,
        default=QuickExpenseCategory.OTHER,
        required=False,
    )
    description = serializers.CharField(required=False, allow_blank=True, default="")
