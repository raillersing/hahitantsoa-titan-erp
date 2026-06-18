from django.contrib import admin

from apps.identity.models import ApplicationRole, UserRoleAssignment


@admin.register(ApplicationRole)
class ApplicationRoleAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "is_system_managed", "is_active", "created_at")
    list_filter = ("is_system_managed", "is_active")
    search_fields = ("name", "slug", "description")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(UserRoleAssignment)
class UserRoleAssignmentAdmin(admin.ModelAdmin):
    list_display = ("user", "role", "is_active", "assigned_at", "assigned_by")
    list_filter = ("is_active", "role", "assigned_at")
    search_fields = ("user__username", "role__name", "notes")
    readonly_fields = ("id", "created_at", "updated_at", "assigned_at")
