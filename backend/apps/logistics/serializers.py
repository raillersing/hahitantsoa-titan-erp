from rest_framework import serializers

from apps.logistics.models import LogisticsEvent, LogisticsEventStatus, LogisticsEventType


class LogisticsEventSerializer(serializers.ModelSerializer):
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
        )


class LogisticsEventCreateSerializer(serializers.Serializer):
    reservation_draft_id = serializers.UUIDField()
    event_type = serializers.ChoiceField(choices=LogisticsEventType.choices)
    scheduled_at = serializers.DateTimeField(required=False, allow_null=True)
    address = serializers.CharField(required=False, allow_blank=True)
    contact_name = serializers.CharField(required=False, allow_blank=True, max_length=255)
    contact_phone = serializers.CharField(required=False, allow_blank=True, max_length=64)
    notes = serializers.CharField(required=False, allow_blank=True)


class LogisticsEventUpdateSerializer(serializers.Serializer):
    scheduled_at = serializers.DateTimeField(required=False, allow_null=True)
    address = serializers.CharField(required=False, allow_blank=True)
    contact_name = serializers.CharField(required=False, allow_blank=True, max_length=255)
    contact_phone = serializers.CharField(required=False, allow_blank=True, max_length=64)
    notes = serializers.CharField(required=False, allow_blank=True)


class LogisticsEventStatusTransitionSerializer(serializers.Serializer):
    new_status = serializers.ChoiceField(choices=LogisticsEventStatus.choices)
    executed_at = serializers.DateTimeField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True)
