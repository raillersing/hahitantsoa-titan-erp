from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.identity.authorization import access_capabilities_for_actor, can_assign_application_role
from apps.identity.models import ApplicationRole, UserRoleAssignment
from apps.identity.roles import APPROVED_GROUP_ROLE_SLUGS, capabilities_for_roles
from apps.identity.selectors import user_effective_role_slugs

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    """Serialize Django users for the admin user list."""

    display_name = serializers.SerializerMethodField()
    role_names = serializers.SerializerMethodField()
    role_slugs = serializers.SerializerMethodField()
    assigned_role_slugs = serializers.SerializerMethodField()
    group_role_slugs = serializers.SerializerMethodField()
    capabilities = serializers.SerializerMethodField()
    base_capabilities = serializers.SerializerMethodField()

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
            "role_slugs",
            "assigned_role_slugs",
            "group_role_slugs",
            "capabilities",
            "base_capabilities",
        )
        read_only_fields = fields

    def get_base_capabilities(self, obj) -> dict[str, bool]:
        return capabilities_for_roles(
            [],
            is_staff=obj.is_active and obj.is_staff,
            is_superuser=obj.is_active and obj.is_superuser,
        )

    def get_capabilities(self, obj) -> dict[str, bool]:
        return access_capabilities_for_actor(actor=obj)

    def get_display_name(self, obj):
        full = f"{obj.first_name} {obj.last_name}".strip()
        return full or obj.username

    def get_role_names(self, obj) -> list[str]:
        slugs = self.get_role_slugs(obj)
        names = dict(ApplicationRole.objects.filter(slug__in=slugs).values_list("slug", "name"))
        return [names.get(slug, slug) for slug in slugs]

    def get_role_slugs(self, obj) -> list[str]:
        return sorted(user_effective_role_slugs(user=obj))

    def get_assigned_role_slugs(self, obj) -> list[str]:
        return sorted(
            UserRoleAssignment.objects.filter(
                user=obj,
                is_active=True,
                role__is_active=True,
            ).values_list("role__slug", flat=True)
        )

    def get_group_role_slugs(self, obj) -> list[str]:
        groups = set(obj.groups.values_list("name", flat=True)) & APPROVED_GROUP_ROLE_SLUGS
        inactive = set(
            ApplicationRole.objects.filter(slug__in=groups, is_active=False).values_list(
                "slug", flat=True
            )
        )
        return sorted(groups - inactive)


class ApplicationRoleSerializer(serializers.ModelSerializer):
    capabilities = serializers.SerializerMethodField()
    assignable = serializers.SerializerMethodField()

    def get_assignable(self, obj) -> bool:
        request = self.context.get("request")
        return can_assign_application_role(actor=getattr(request, "user", None), role=obj)

    def get_capabilities(self, obj) -> dict[str, bool]:
        return capabilities_for_roles([obj.slug] if obj.is_active else [])

    class Meta:
        model = ApplicationRole
        fields = (
            "id",
            "name",
            "slug",
            "capabilities",
            "assignable",
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


class UserCreateSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField(required=False, allow_blank=True, default="")
    first_name = serializers.CharField(required=False, allow_blank=True, max_length=150, default="")
    last_name = serializers.CharField(required=False, allow_blank=True, max_length=150, default="")
    password = serializers.CharField(write_only=True, min_length=8)
    role_slugs = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        default=list,
    )


class UserUpdateSerializer(serializers.Serializer):
    first_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    last_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    email = serializers.EmailField(required=False, allow_blank=True)
    is_active = serializers.BooleanField(required=False)
    role_slugs = serializers.ListField(
        child=serializers.CharField(),
        required=False,
    )


class UserResetPasswordSerializer(serializers.Serializer):
    new_password = serializers.CharField(write_only=True, min_length=8)
