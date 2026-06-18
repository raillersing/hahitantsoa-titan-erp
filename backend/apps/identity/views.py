from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.identity.models import ApplicationRole, UserRoleAssignment
from apps.identity.serializers import (
    ApplicationRoleSerializer,
    AssignRoleRequestSerializer,
    RevokeRoleRequestSerializer,
    UserRoleAssignmentSerializer,
)
from apps.identity.services import (
    IdentityServiceError,
    assign_role,
    revoke_role,
    sync_system_roles,
)

from .permissions import HasReservationSensitiveAccess

User = get_user_model()


class ApplicationRoleListAPIView(generics.ListAPIView):
    http_method_names = ["get", "head", "options"]
    permission_classes = [HasReservationSensitiveAccess]
    serializer_class = ApplicationRoleSerializer

    def get_queryset(self):
        return ApplicationRole.objects.filter(is_active=True).order_by("name")


class UserRoleAssignmentListAPIView(generics.ListAPIView):
    http_method_names = ["get", "head", "options"]
    permission_classes = [HasReservationSensitiveAccess]
    serializer_class = UserRoleAssignmentSerializer

    def get_queryset(self):
        queryset = UserRoleAssignment.objects.select_related("role").order_by("-assigned_at")
        user_id = self.request.query_params.get("user_id")
        if user_id:
            queryset = queryset.filter(user__id=user_id)
        is_active = self.request.query_params.get("is_active")
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() in ("true", "1"))
        return queryset


class AssignRoleAPIView(APIView):
    http_method_names = ["post", "head", "options"]
    permission_classes = [HasReservationSensitiveAccess]

    @extend_schema(
        request=AssignRoleRequestSerializer,
        responses={
            201: UserRoleAssignmentSerializer,
            400: OpenApiResponse(description="Invalid request or role assignment conflict."),
            403: OpenApiResponse(description="Unauthorized to assign roles."),
        },
    )
    def post(self, request):
        serializer = AssignRoleRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = get_object_or_404(User, pk=serializer.validated_data["user_id"])
        role = get_object_or_404(ApplicationRole, pk=serializer.validated_data["role_id"])

        try:
            assignment = assign_role(
                actor=request.user,
                user=user,
                role=role,
                notes=serializer.validated_data.get("notes", ""),
            )
        except IdentityServiceError as exc:
            return Response(
                {"detail": str(exc), "code": exc.code}, status=status.HTTP_400_BAD_REQUEST
            )

        return Response(
            UserRoleAssignmentSerializer(assignment).data,
            status=status.HTTP_201_CREATED,
        )


class RevokeRoleAPIView(APIView):
    http_method_names = ["post", "head", "options"]
    permission_classes = [HasReservationSensitiveAccess]

    @extend_schema(
        request=RevokeRoleRequestSerializer,
        responses={
            200: UserRoleAssignmentSerializer,
            400: OpenApiResponse(description="Invalid request or already revoked."),
            403: OpenApiResponse(description="Unauthorized to revoke roles."),
            404: OpenApiResponse(description="Assignment not found."),
        },
    )
    def post(self, request, id):
        serializer = RevokeRoleRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            assignment = revoke_role(
                actor=request.user,
                assignment_id=str(id),
                notes=serializer.validated_data.get("notes", ""),
            )
        except IdentityServiceError as exc:
            if exc.code == "role_assignment_not_found":
                return Response({"detail": str(exc)}, status=status.HTTP_404_NOT_FOUND)
            return Response(
                {"detail": str(exc), "code": exc.code}, status=status.HTTP_400_BAD_REQUEST
            )

        return Response(UserRoleAssignmentSerializer(assignment).data, status=status.HTTP_200_OK)


class SyncSystemRolesAPIView(APIView):
    http_method_names = ["post", "head", "options"]
    permission_classes = [HasReservationSensitiveAccess]

    @extend_schema(
        responses={
            200: ApplicationRoleSerializer(many=True),
            403: OpenApiResponse(description="Unauthorized."),
        },
    )
    def post(self, request):
        roles = sync_system_roles(actor=request.user)
        return Response(
            ApplicationRoleSerializer(roles, many=True).data,
            status=status.HTTP_200_OK,
        )
