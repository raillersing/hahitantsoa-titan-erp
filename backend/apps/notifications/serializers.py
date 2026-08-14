from rest_framework import serializers

from apps.notifications.models import BugReport, PaymentReminderDispatch, SystemNotification


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


class BugReportSerializer(serializers.ModelSerializer):
    reporter_username = serializers.CharField(source="reporter.username", read_only=True)

    class Meta:
        model = BugReport
        fields = (
            "id",
            "reporter",
            "reporter_username",
            "title",
            "description",
            "severity",
            "status",
            "page_url",
            "user_agent",
            "error_message",
            "correlation_id",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "reporter",
            "reporter_username",
            "status",
            "created_at",
            "updated_at",
        )

    def validate_description(self, value):
        if not value.strip():
            raise serializers.ValidationError("La description du problème est obligatoire.")
        return value.strip()


class BugReportStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=("new", "in_progress", "resolved"))


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
