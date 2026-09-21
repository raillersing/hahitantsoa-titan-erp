from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.identity.models import ApplicationRole, UserRoleAssignment
from apps.identity.roles import ROLE_GROUP_NAME_BY_ROLE
from apps.identity.serializers import (
    ApplicationRoleSerializer,
    ApplicationRoleWriteSerializer,
    AssignRoleRequestSerializer,
    RevokeRoleRequestSerializer,
    UserCreateSerializer,
    UserResetPasswordSerializer,
    UserRoleAssignmentSerializer,
    UserRoleAssignmentWriteSerializer,
    UserSerializer,
    UserUpdateSerializer,
)
from apps.identity.services import (
    UNAUTHORIZED_PLATFORM_ROLE,
    USER_NOT_FOUND,
    IdentityServiceError,
    assign_role,
    create_user,
    reset_user_password,
    revoke_role,
    sync_system_roles,
    update_user,
)

from .permissions import HasIdentityAdminAccess

User = get_user_model()


class ApplicationRoleListCreateAPIView(generics.ListCreateAPIView):
    http_method_names = ["get", "post", "head", "options"]
    permission_classes = [HasIdentityAdminAccess]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return ApplicationRoleWriteSerializer
        return ApplicationRoleSerializer

    def get_queryset(self):
        queryset = ApplicationRole.objects.order_by("name")
        name = self.request.query_params.get("name")
        if name:
            queryset = queryset.filter(name__icontains=name)
        is_system_managed = self.request.query_params.get("is_system_managed")
        if is_system_managed is not None:
            queryset = queryset.filter(is_system_managed=is_system_managed.lower() in ("true", "1"))
        is_active = self.request.query_params.get("is_active")
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() in ("true", "1"))
        else:
            queryset = queryset.filter(is_active=True)
        return queryset

    def create(self, request, *args, **kwargs):
        reserved_slugs = set(ROLE_GROUP_NAME_BY_ROLE.values())
        if request.data.get("slug") in reserved_slugs and not request.user.is_staff:
            return Response(
                {
                    "detail": "Only a platform administrator may manage reserved roles.",
                    "code": UNAUTHORIZED_PLATFORM_ROLE,
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().create(request, *args, **kwargs)


class ApplicationRoleDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    http_method_names = ["get", "put", "patch", "delete", "head", "options"]
    permission_classes = [HasIdentityAdminAccess]
    queryset = ApplicationRole.objects.all()

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return ApplicationRoleWriteSerializer
        return ApplicationRoleSerializer

    def _platform_mutation_guard(self, request, instance):
        reserved_slugs = set(ROLE_GROUP_NAME_BY_ROLE.values())
        requested_slug = request.data.get("slug", instance.slug)
        if not request.user.is_staff and (
            instance.is_system_managed
            or instance.slug in reserved_slugs
            or requested_slug in reserved_slugs
        ):
            return Response(
                {
                    "detail": "Only a platform administrator may manage reserved roles.",
                    "code": UNAUTHORIZED_PLATFORM_ROLE,
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        return None

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        guarded = self._platform_mutation_guard(request, instance)
        if guarded is not None:
            return guarded
        return super().update(request, *args, **kwargs)

    def delete(self, request, *args, **kwargs):
        instance = self.get_object()
        guarded = self._platform_mutation_guard(request, instance)
        if guarded is not None:
            return guarded
        if instance.is_system_managed:
            return Response(
                {"detail": "System-managed roles cannot be deleted."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class UserRoleAssignmentListAPIView(generics.ListAPIView):
    http_method_names = ["get", "head", "options"]
    permission_classes = [HasIdentityAdminAccess]
    serializer_class = UserRoleAssignmentSerializer

    def get_queryset(self):
        queryset = UserRoleAssignment.objects.select_related("role").order_by("-assigned_at")
        user_id = self.request.query_params.get("user_id")
        if user_id:
            queryset = queryset.filter(user__id=user_id)
        role_id = self.request.query_params.get("role_id")
        if role_id:
            queryset = queryset.filter(role__id=role_id)
        assigned_after = self.request.query_params.get("assigned_after")
        if assigned_after:
            queryset = queryset.filter(assigned_at__gte=assigned_after)
        assigned_before = self.request.query_params.get("assigned_before")
        if assigned_before:
            queryset = queryset.filter(assigned_at__lte=assigned_before)
        is_active = self.request.query_params.get("is_active")
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() in ("true", "1"))
        return queryset


class UserListAPIView(generics.ListCreateAPIView):
    """List and create users for identity administration."""

    http_method_names = ["get", "post", "head", "options"]
    permission_classes = [HasIdentityAdminAccess]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return UserCreateSerializer
        return UserSerializer

    def get_queryset(self):
        User = get_user_model()
        queryset = User.objects.order_by("username")

        search = self.request.query_params.get("search")
        if search:
            from django.db.models import Q

            queryset = queryset.filter(
                Q(username__icontains=search)
                | Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
                | Q(email__icontains=search)
            )
        return queryset

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            user = create_user(
                actor=request.user,
                username=serializer.validated_data["username"],
                email=serializer.validated_data.get("email", ""),
                first_name=serializer.validated_data.get("first_name", ""),
                last_name=serializer.validated_data.get("last_name", ""),
                password=serializer.validated_data["password"],
                role_slugs=serializer.validated_data.get("role_slugs", []),
            )
        except IdentityServiceError as exc:
            status_code = status.HTTP_400_BAD_REQUEST
            if exc.code == UNAUTHORIZED_PLATFORM_ROLE:
                status_code = status.HTTP_403_FORBIDDEN
            return Response(
                {"detail": str(exc), "code": exc.code},
                status=status_code,
            )
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class UserDetailAPIView(generics.RetrieveUpdateAPIView):
    """Retrieve and update a user with role synchronization."""

    http_method_names = ["get", "patch", "head", "options"]
    permission_classes = [HasIdentityAdminAccess]
    queryset = User.objects.all()

    def get_serializer_class(self):
        if self.request.method == "PATCH":
            return UserUpdateSerializer
        return UserSerializer

    def patch(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        try:
            updated_user = update_user(
                actor=request.user,
                user_id=instance.pk,
                first_name=serializer.validated_data.get("first_name"),
                last_name=serializer.validated_data.get("last_name"),
                email=serializer.validated_data.get("email"),
                is_active=serializer.validated_data.get("is_active"),
                role_slugs=serializer.validated_data.get("role_slugs"),
            )
        except IdentityServiceError as exc:
            status_code = status.HTTP_400_BAD_REQUEST
            if exc.code == UNAUTHORIZED_PLATFORM_ROLE:
                status_code = status.HTTP_403_FORBIDDEN
            return Response(
                {"detail": str(exc), "code": exc.code},
                status=status_code,
            )

        return Response(UserSerializer(updated_user).data, status=status.HTTP_200_OK)


class UserResetPasswordAPIView(APIView):
    """Administratively reset user password with audit."""

    http_method_names = ["post", "head", "options"]
    permission_classes = [HasIdentityAdminAccess]

    @extend_schema(
        request=UserResetPasswordSerializer,
        responses={
            200: OpenApiResponse(description="Mot de passe réinitialisé avec succès."),
            400: OpenApiResponse(description="Données ou mot de passe invalide."),
            403: OpenApiResponse(description="Opération non autorisée."),
            404: OpenApiResponse(description="Utilisateur introuvable."),
        },
    )
    def post(self, request, pk: int):
        serializer = UserResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            reset_user_password(
                actor=request.user,
                user_id=pk,
                new_password=serializer.validated_data["new_password"],
            )
        except IdentityServiceError as exc:
            status_code = status.HTTP_400_BAD_REQUEST
            if exc.code == USER_NOT_FOUND:
                status_code = status.HTTP_404_NOT_FOUND
            elif exc.code == UNAUTHORIZED_PLATFORM_ROLE:
                status_code = status.HTTP_403_FORBIDDEN
            return Response(
                {"detail": str(exc), "code": exc.code},
                status=status_code,
            )

        return Response(
            {"detail": "Mot de passe réinitialisé avec succès."},
            status=status.HTTP_200_OK,
        )


class UserRoleAssignmentDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    http_method_names = ["get", "patch", "delete", "head", "options"]
    permission_classes = [HasIdentityAdminAccess]
    lookup_field = "id"
    queryset = UserRoleAssignment.objects.select_related("role").all()

    def get_serializer_class(self):
        if self.request.method == "PATCH":
            return UserRoleAssignmentWriteSerializer
        return UserRoleAssignmentSerializer

    def delete(self, request, *args, **kwargs):
        assignment = self.get_object()
        try:
            updated = revoke_role(
                actor=request.user,
                assignment_id=str(assignment.id),
                notes="",
            )
        except IdentityServiceError as exc:
            if exc.code == "role_assignment_not_found":
                return Response({"detail": str(exc)}, status=status.HTTP_404_NOT_FOUND)
            return Response(
                {"detail": str(exc), "code": exc.code}, status=status.HTTP_400_BAD_REQUEST
            )
        return Response(UserRoleAssignmentSerializer(updated).data, status=status.HTTP_200_OK)


class AssignRoleAPIView(APIView):
    http_method_names = ["post", "head", "options"]
    permission_classes = [HasIdentityAdminAccess]

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
            if exc.code == UNAUTHORIZED_PLATFORM_ROLE:
                return Response(
                    {"detail": str(exc), "code": exc.code},
                    status=status.HTTP_403_FORBIDDEN,
                )
            return Response(
                {"detail": str(exc), "code": exc.code}, status=status.HTTP_400_BAD_REQUEST
            )

        return Response(
            UserRoleAssignmentSerializer(assignment).data,
            status=status.HTTP_201_CREATED,
        )


class RevokeRoleAPIView(APIView):
    http_method_names = ["post", "head", "options"]
    permission_classes = [HasIdentityAdminAccess]

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
            response_status = (
                status.HTTP_403_FORBIDDEN
                if exc.code == UNAUTHORIZED_PLATFORM_ROLE
                else status.HTTP_400_BAD_REQUEST
            )
            return Response({"detail": str(exc), "code": exc.code}, status=response_status)

        return Response(UserRoleAssignmentSerializer(assignment).data, status=status.HTTP_200_OK)


class SyncSystemRolesAPIView(APIView):
    http_method_names = ["post", "head", "options"]
    permission_classes = [HasIdentityAdminAccess]

    @extend_schema(
        responses={
            200: ApplicationRoleSerializer(many=True),
            403: OpenApiResponse(description="Unauthorized."),
        },
    )
    def post(self, request):
        try:
            roles = sync_system_roles(actor=request.user)
        except IdentityServiceError as exc:
            return Response(
                {"detail": str(exc), "code": exc.code},
                status=status.HTTP_403_FORBIDDEN,
            )
        return Response(
            ApplicationRoleSerializer(roles, many=True).data,
            status=status.HTTP_200_OK,
        )
