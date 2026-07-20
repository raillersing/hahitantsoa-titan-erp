from rest_framework import serializers

from django.contrib.auth import get_user_model
from apps.identity.models import ApplicationRole, UserRoleAssignment

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    """Serialize Django users for the admin user list."""
    display_name = serializers.SerializerMethodField()
    role_names = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "display_name",
            "is_active",
            "is_staff",
            "last_login",
            "date_joined",
            "role_names",
        )
        read_only_fields = fields

    def get_display_name(self, obj):
        full = f"{obj.first_name} {obj.last_name}".strip()
        return full or obj.username

    def get_role_names(self, obj):
        assignments = UserRoleAssignment.objects.filter(
            user=obj, is_active=True
        ).select_related("role")
        return [a.role.name for a in assignments]




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


class ApplicationRoleWriteSerializer(serializers.ModelSerializer):
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
        read_only_fields = ("id", "is_system_managed", "created_at", "updated_at")

    def validate_slug(self, value: str) -> str:
        if ApplicationRole.objects.filter(slug=value).exists():
            raise serializers.ValidationError("A role with this slug already exists.")
        return value

    def validate(self, attrs):
        instance = self.instance
        request = self.context.get("request")
        actor = getattr(request, "user", None)
        if instance is not None and instance.is_system_managed:
            if not getattr(actor, "is_staff", False):
                raise serializers.ValidationError(
                    "Only a platform administrator may update system roles."
                )
            if attrs.get("is_active", instance.is_active) is False:
                raise serializers.ValidationError("System-managed roles cannot be deactivated.")
        return attrs


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


class UserRoleAssignmentWriteSerializer(serializers.ModelSerializer):
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
            "is_active",
            "created_at",
            "updated_at",
        )


class RevokeRoleRequestSerializer(serializers.Serializer):
    notes = serializers.CharField(required=False, allow_blank=True, max_length=1000)
