from django.urls import path

from .views import (
    ApplicationRoleListAPIView,
    AssignRoleAPIView,
    RevokeRoleAPIView,
    SyncSystemRolesAPIView,
    UserRoleAssignmentListAPIView,
)

urlpatterns = [
    path("roles/", ApplicationRoleListAPIView.as_view(), name="identity-role-list"),
    path(
        "roles/sync-system/",
        SyncSystemRolesAPIView.as_view(),
        name="identity-role-sync-system",
    ),
    path(
        "assignments/",
        UserRoleAssignmentListAPIView.as_view(),
        name="identity-assignment-list",
    ),
    path(
        "assignments/assign/",
        AssignRoleAPIView.as_view(),
        name="identity-assignment-assign",
    ),
    path(
        "assignments/<uuid:id>/revoke/",
        RevokeRoleAPIView.as_view(),
        name="identity-assignment-revoke",
    ),
]
