from __future__ import annotations

from django.db.models import Q
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.identity.models import UserDeviceSession
from apps.identity.permissions import HasIdentityAdminAccess
from apps.identity.session_serializers import (
    IdentitySessionsListResponseSerializer,
    UserDeviceSessionSerializer,
    UserPersonalSessionsResponseSerializer,
)
from apps.identity.session_services import (
    get_all_concurrent_users_summary,
    get_user_concurrent_status,
    revoke_all_other_sessions,
    revoke_session_by_id,
)


class IdentitySessionsListAPIView(APIView):
    """
    Administrator endpoint to inspect active and historical device sessions
    across all accounts, identify users with concurrent sessions, and search by device/IP.
    """

    http_method_names = ["get", "options"]
    permission_classes = [HasIdentityAdminAccess]

    @extend_schema(
        parameters=[
            OpenApiParameter(name="user_id", type=str, description="Filter by user UUID"),
            OpenApiParameter(name="is_active", type=bool, description="Filter by active status"),
            OpenApiParameter(name="device_type", type=str, description="Filter by device type"),
            OpenApiParameter(name="search", type=str, description="Search username, device, IP"),
        ],
        responses={200: IdentitySessionsListResponseSerializer},
    )
    def get(self, request):
        qs = UserDeviceSession.objects.select_related("user").all().order_by("-last_seen_at")

        user_id = request.query_params.get("user_id")
        if user_id:
            qs = qs.filter(user_id=user_id)

        is_active = request.query_params.get("is_active")
        if is_active is not None:
            active_val = is_active.lower() in ("true", "1", "yes")
            qs = qs.filter(is_active=active_val)

        device_type = request.query_params.get("device_type")
        if device_type:
            qs = qs.filter(device_type=device_type)

        search = request.query_params.get("search")
        if search:
            search_str = search.strip()
            qs = qs.filter(
                Q(user__username__icontains=search_str)
                | Q(user__first_name__icontains=search_str)
                | Q(user__last_name__icontains=search_str)
                | Q(device_name__icontains=search_str)
                | Q(ip_address__icontains=search_str)
                | Q(os_name__icontains=search_str)
                | Q(browser_name__icontains=search_str)
            )

        total_active_sessions = UserDeviceSession.objects.filter(is_active=True).count()
        concurrent_users = get_all_concurrent_users_summary()

        # Limit results list to avoid huge payloads (e.g. 100 most recent sessions)
        limited_results = qs[:100]
        serialized_results = UserDeviceSessionSerializer(
            limited_results, many=True, context={"request": request}
        ).data

        payload = {
            "total_active_sessions": total_active_sessions,
            "users_with_concurrent_sessions": concurrent_users,
            "results": serialized_results,
        }
        return Response(payload, status=status.HTTP_200_OK)


class UserPersonalSessionsAPIView(APIView):
    """
    Self-service endpoint for any authenticated user to view their own active
    and recent device sessions and check whether their account is active elsewhere.
    """

    http_method_names = ["get", "options"]
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: UserPersonalSessionsResponseSerializer})
    def get(self, request):
        user = request.user
        qs = (
            UserDeviceSession.objects.filter(user=user)
            .select_related("user")
            .order_by("-last_seen_at")[:20]
        )

        concurrent_status = get_user_concurrent_status(user=user)
        current_session_id = None

        serialized_sessions = UserDeviceSessionSerializer(
            qs, many=True, context={"request": request}
        ).data

        for s in serialized_sessions:
            if s.get("is_current"):
                current_session_id = s["id"]
                break

        payload = {
            "has_concurrent_sessions": concurrent_status["has_concurrent_sessions"],
            "active_sessions_count": concurrent_status["active_sessions_count"],
            "current_session_id": current_session_id,
            "sessions": serialized_sessions,
        }
        return Response(payload, status=status.HTTP_200_OK)


class RevokeSessionAPIView(APIView):
    """
    Endpoint to terminate and invalidate an active device session.
    Allowed for the session owner or administrators with HasIdentityAdminAccess.
    """

    http_method_names = ["post", "options"]
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: UserDeviceSessionSerializer})
    def post(self, request, session_id: str):
        try:
            device_session = revoke_session_by_id(
                session_id=session_id,
                actor=request.user,
                reason=request.data.get("reason", "admin_revocation"),
            )
        except ValueError:
            return Response(
                {"detail": "Session introuvable.", "code": "session_not_found"},
                status=status.HTTP_404_NOT_FOUND,
            )
        except PermissionError:
            return Response(
                {
                    "detail": "Vous n'êtes pas autorisé à révoquer cette session.",
                    "code": "forbidden",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        serialized = UserDeviceSessionSerializer(device_session, context={"request": request}).data
        return Response(serialized, status=status.HTTP_200_OK)


class RevokeOtherSessionsAPIView(APIView):
    """
    Endpoint for a user to remotely disconnect all other devices
    where their account is currently active.
    """

    http_method_names = ["post", "options"]
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: None})
    def post(self, request):
        current_session_key = getattr(request.session, "session_key", "")
        revoked_count = revoke_all_other_sessions(
            user=request.user,
            current_session_key=current_session_key,
            actor=request.user,
        )
        return Response(
            {
                "detail": f"{revoked_count} autre(s) session(s) ont été révoquées avec succès.",
                "revoked_count": revoked_count,
            },
            status=status.HTTP_200_OK,
        )
