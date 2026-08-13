from rest_framework import serializers

from apps.notifications.models import SystemNotification
from apps.notifications.models import PaymentReminderDispatch


class SystemNotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemNotification
        fields = (
            "id",
            "notification_type",
            "title",
            "message",
            "severity",
            "is_read",
            "link",
            "created_at",
        )
        read_only_fields = ("id", "created_at")


class SystemNotificationMarkReadSerializer(serializers.Serializer):
    is_read = serializers.BooleanField()


class PaymentReminderDispatchSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentReminderDispatch
        fields = (
            "id",
            "reservation_draft",
            "hahitantsoa_event_draft",
            "reminder_key",
            "message",
            "whatsapp_url",
            "prepared_by",
            "prepared_at",
            "created_at",
        )
        read_only_fields = fields


class PaymentReminderDispatchCreateSerializer(serializers.Serializer):
    reservation_draft_id = serializers.UUIDField(required=False)
    hahitantsoa_event_draft_id = serializers.UUIDField(required=False)
    reminder_key = serializers.CharField(max_length=96, default="payment_due")
