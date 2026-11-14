from __future__ import annotations

from django.utils import timezone
from rest_framework import serializers

from apps.identity.models import UserDeviceSession

CONCURRENT_THRESHOLD_SECONDS = 900  # 15 minutes


class UserDeviceSessionSerializer(serializers.ModelSerializer):
    user_id = serializers.UUIDField(read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)
    display_name = serializers.SerializerMethodField()
    is_online = serializers.SerializerMethodField()
    is_current = serializers.SerializerMethodField()

    class Meta:
        model = UserDeviceSession
        fields = [
            "id",
            "user_id",
            "username",
            "display_name",
            "device_name",
            "device_type",
            "os_name",
            "browser_name",
            "client_platform",
            "ip_address",
            "logged_in_at",
            "last_seen_at",
            "is_active",
            "is_online",
            "is_current",
            "revoked_at",
            "revocation_reason",
        ]
        read_only_fields = fields

    def get_display_name(self, obj: UserDeviceSession) -> str:
        user = obj.user
        get_full_name = getattr(user, "get_full_name", lambda: "")
        get_username = getattr(user, "get_username", lambda: getattr(user, "username", ""))
        return get_full_name().strip() or get_username()

    def get_is_online(self, obj: UserDeviceSession) -> bool:
        if not obj.is_active:
            return False
        delta = (timezone.now() - obj.last_seen_at).total_seconds()
        return delta < CONCURRENT_THRESHOLD_SECONDS

    def get_is_current(self, obj: UserDeviceSession) -> bool:
        request = self.context.get("request")
        if not request:
            return False
        current_session_key = getattr(request.session, "session_key", None)
        return bool(current_session_key and obj.session_key == current_session_key)


class ConcurrentUserSummarySerializer(serializers.Serializer):
    user_id = serializers.CharField()
    username = serializers.CharField()
    display_name = serializers.CharField()
    active_devices_count = serializers.IntegerField()
    devices = serializers.ListField(child=serializers.CharField())


class IdentitySessionsListResponseSerializer(serializers.Serializer):
    total_active_sessions = serializers.IntegerField()
    users_with_concurrent_sessions = ConcurrentUserSummarySerializer(many=True)
    results = UserDeviceSessionSerializer(many=True)


class UserPersonalSessionsResponseSerializer(serializers.Serializer):
    has_concurrent_sessions = serializers.BooleanField()
    active_sessions_count = serializers.IntegerField()
    current_session_id = serializers.CharField(allow_null=True)
    sessions = UserDeviceSessionSerializer(many=True)
