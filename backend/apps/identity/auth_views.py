from __future__ import annotations

from django.contrib.auth import authenticate
from django.contrib.auth import login as django_login
from django.contrib.auth import logout as django_logout
from django.http import JsonResponse
from django.middleware.csrf import get_token, rotate_token
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.identity.auth_serializers import SessionLoginSerializer, SessionStateSerializer
from apps.identity.auth_services import (
    consume_login_attempt,
    login_throttle_keys,
    record_login_failure,
    record_login_success,
    record_logout_started,
    record_logout_success,
)
from apps.identity.selectors import user_effective_role_slugs


class _CsrfProtectedAPIView(APIView):
    @method_decorator(csrf_protect)
    def _dispatch_with_csrf(self, request, *args, **kwargs):
        return super().dispatch(request, *args, **kwargs)

    def dispatch(self, request, *args, **kwargs):
        response = self._dispatch_with_csrf(request, *args, **kwargs)
        if response.status_code == status.HTTP_403_FORBIDDEN and not isinstance(response, Response):
            # ponytail: keep CSRF enforcement native while exposing a stable API error.
            response = JsonResponse(
                {
                    "detail": "CSRF verification failed.",
                    "code": "csrf_failed",
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        response["Cache-Control"] = "no-store"
        return response


def _session_payload(user: object) -> dict[str, object]:
    if getattr(user, "is_authenticated", False) is not True:
        return {"authenticated": False, "user": None}

    get_full_name = getattr(user, "get_full_name")
    get_username = getattr(user, "get_username")
    display_name = get_full_name().strip() or get_username()

    # ponytail: reuse the existing role selector instead of introducing a second capability model.
    return {
        "authenticated": True,
        "user": {
            "id": str(getattr(user, "pk")),
            "username": get_username(),
            "display_name": display_name,
            "is_staff": bool(getattr(user, "is_staff", False)),
            "roles": sorted(user_effective_role_slugs(user=user)),
        },
    }


class SessionStateAPIView(APIView):
    http_method_names = ["get", "head", "options"]
    permission_classes = [AllowAny]

    @extend_schema(responses={200: SessionStateSerializer})
    def get(self, request):
        get_token(request)
        response = Response(_session_payload(request.user), status=status.HTTP_200_OK)
        response["Cache-Control"] = "no-store"
        return response


class SessionLoginAPIView(_CsrfProtectedAPIView):
    http_method_names = ["post", "options"]
    permission_classes = [AllowAny]

    @extend_schema(
        request=SessionLoginSerializer,
        responses={
            200: SessionStateSerializer,
            400: OpenApiResponse(description="Invalid credentials."),
            403: OpenApiResponse(description="CSRF verification failed."),
            429: OpenApiResponse(description="Too many login attempts."),
        },
    )
    def post(self, request):
        serializer = SessionLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        throttle_keys = login_throttle_keys(
            username=serializer.validated_data["username"],
            remote_address=request.META.get("REMOTE_ADDR", "unknown"),
        )
        retry_after = consume_login_attempt(keys=throttle_keys)
        if retry_after is not None:
            response = Response(
                {
                    "detail": "Too many login attempts. Try again later.",
                    "code": "login_throttled",
                },
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
            response["Retry-After"] = str(retry_after)
            response["Cache-Control"] = "no-store"
            return response

        user = authenticate(
            request=request,
            username=serializer.validated_data["username"],
            password=serializer.validated_data["password"],
        )
        if user is None:
            record_login_failure(keys=throttle_keys)
            response = Response(
                {
                    "detail": "Unable to log in with the provided credentials.",
                    "code": "invalid_credentials",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
            response["Cache-Control"] = "no-store"
            return response

        django_login(request, user)
        try:
            record_login_success(user=user, keys=throttle_keys)
        except Exception:
            # Do not leave a usable session when its mandatory audit write fails.
            django_logout(request)
            rotate_token(request)
            raise
        get_token(request)
        response = Response(_session_payload(user), status=status.HTTP_200_OK)
        response["Cache-Control"] = "no-store"
        return response


class SessionLogoutAPIView(_CsrfProtectedAPIView):
    http_method_names = ["post", "options"]
    permission_classes = [AllowAny]

    @extend_schema(
        request=None,
        responses={
            204: None,
            403: OpenApiResponse(description="CSRF verification failed."),
        },
    )
    def post(self, request):
        authenticated_user = request.user if request.user.is_authenticated else None
        if authenticated_user is not None:
            # Persist intent first so an audit failure never silently follows logout.
            record_logout_started(user=authenticated_user)
        django_logout(request)
        rotate_token(request)
        if authenticated_user is not None:
            record_logout_success(user=authenticated_user)
        response = Response(status=status.HTTP_204_NO_CONTENT)
        response["Cache-Control"] = "no-store"
        return response
