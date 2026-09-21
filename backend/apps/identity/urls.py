from django.urls import path

from .views import (
    ApplicationRoleDetailAPIView,
    ApplicationRoleListCreateAPIView,
    AssignRoleAPIView,
    RevokeRoleAPIView,
    SyncSystemRolesAPIView,
    UserDetailAPIView,
    UserListAPIView,
    UserResetPasswordAPIView,
    UserRoleAssignmentDetailAPIView,
    UserRoleAssignmentListAPIView,
)

urlpatterns = [
    path("roles/", ApplicationRoleListCreateAPIView.as_view(), name="identity-role-list"),
    path("users/", UserListAPIView.as_view(), name="identity-user-list"),
    path("users/<int:pk>/", UserDetailAPIView.as_view(), name="identity-user-detail"),
    path(
        "users/<int:pk>/reset-password/",
        UserResetPasswordAPIView.as_view(),
        name="identity-user-reset-password",
    ),
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
        "assignments/<uuid:id>/",
        UserRoleAssignmentDetailAPIView.as_view(),
        name="identity-assignment-detail",
    ),
    path(
        "assignments/<uuid:id>/revoke/",
        RevokeRoleAPIView.as_view(),
        name="identity-assignment-revoke",
    ),
]
