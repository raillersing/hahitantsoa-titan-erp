from rest_framework import serializers

from apps.identity.models import ApplicationRole, UserRoleAssignment


class ApplicationRoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = ApplicationRole
        fields = (
            "id",
            "name",
            "slug",
            "description",
            "is_system_managed",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class UserRoleAssignmentSerializer(serializers.ModelSerializer):
    role = ApplicationRoleSerializer(read_only=True)
    user_id = serializers.ReadOnlyField()
    assigned_by_id = serializers.ReadOnlyField()

    class Meta:
        model = UserRoleAssignment
        fields = (
            "id",
            "user_id",
            "role",
            "assigned_by_id",
            "assigned_at",
            "revoked_at",
            "is_active",
            "notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "user_id",
            "role",
            "assigned_by_id",
            "assigned_at",
            "revoked_at",
            "created_at",
            "updated_at",
        )


class AssignRoleRequestSerializer(serializers.Serializer):
    user_id = serializers.CharField()
    role_id = serializers.UUIDField()
    notes = serializers.CharField(required=False, allow_blank=True, max_length=1000)


class RevokeRoleRequestSerializer(serializers.Serializer):
    notes = serializers.CharField(required=False, allow_blank=True, max_length=1000)
