from rest_framework import serializers

from apps.notifications.models import SystemNotification


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
