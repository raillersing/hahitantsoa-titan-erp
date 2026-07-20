from rest_framework import serializers

from apps.logistics.models import (
    LogisticsEvent,
    LogisticsEventItemLine,
    LogisticsEventStatus,
    LogisticsEventType,
)


class LogisticsEventItemLineSerializer(serializers.ModelSerializer):
    inventory_item_name = serializers.CharField(source="inventory_item.name", read_only=True)
    inventory_item_kind = serializers.CharField(source="inventory_item.kind", read_only=True)

    class Meta:
        model = LogisticsEventItemLine
        fields = (
            "id",
            "logistics_event",
            "inventory_item",
            "inventory_item_name",
            "inventory_item_kind",
            "quantity",
            "notes",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        )
        read_only_fields = (
            "id",
            "logistics_event",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
            "inventory_item_name",
            "inventory_item_kind",
        )


class LogisticsEventItemLineCreateSerializer(serializers.Serializer):
    inventory_item_id = serializers.UUIDField()
    quantity = serializers.IntegerField(min_value=1, default=1)
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class LogisticsEventSerializer(serializers.ModelSerializer):
    item_lines = LogisticsEventItemLineSerializer(many=True, read_only=True)

    class Meta:
        model = LogisticsEvent
        fields = (
            "id",
            "reservation_draft",
            "event_type",
            "status",
            "scheduled_at",
            "executed_at",
            "address",
            "contact_name",
            "contact_phone",
            "notes",
            "signature_required",
            "signature_received",
            "signed_by",
            "signed_at",
            "item_lines",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        )
        read_only_fields = (
            "id",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
            "status",
            "executed_at",
            "signature_received",
            "signed_by",
            "signed_at",
        )


class LogisticsEventCreateSerializer(serializers.Serializer):
    reservation_draft = serializers.UUIDField()
    event_type = serializers.ChoiceField(choices=LogisticsEventType.choices)
    scheduled_at = serializers.DateTimeField(required=False, allow_null=True)
    address = serializers.CharField(required=False, allow_blank=True)
    contact_name = serializers.CharField(required=False, allow_blank=True, max_length=255)
    contact_phone = serializers.CharField(required=False, allow_blank=True, max_length=64)
    notes = serializers.CharField(required=False, allow_blank=True)
    signature_required = serializers.BooleanField(required=False, default=False)


class LogisticsEventUpdateSerializer(serializers.Serializer):
    scheduled_at = serializers.DateTimeField(required=False, allow_null=True)
    address = serializers.CharField(required=False, allow_blank=True)
    contact_name = serializers.CharField(required=False, allow_blank=True, max_length=255)
    contact_phone = serializers.CharField(required=False, allow_blank=True, max_length=64)
    notes = serializers.CharField(required=False, allow_blank=True)
    signature_required = serializers.BooleanField(required=False)


class LogisticsEventStatusTransitionSerializer(serializers.Serializer):
    new_status = serializers.ChoiceField(choices=LogisticsEventStatus.choices)
    executed_at = serializers.DateTimeField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True)


class LogisticsEventCompletePassationSerializer(serializers.Serializer):
    signed_at = serializers.DateTimeField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True)
