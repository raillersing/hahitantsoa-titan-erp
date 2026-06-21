from django.urls import path

from .views import (
    ApplicationRoleDetailAPIView,
    ApplicationRoleListCreateAPIView,
    AssignRoleAPIView,
    RevokeRoleAPIView,
    SyncSystemRolesAPIView,
    UserRoleAssignmentListAPIView,
)

urlpatterns = [
    path("roles/", ApplicationRoleListCreateAPIView.as_view(), name="identity-role-list"),
    path("roles/<uuid:pk>/", ApplicationRoleDetailAPIView.as_view(), name="identity-role-detail"),
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
