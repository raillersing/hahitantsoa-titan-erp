from django.urls import path

from apps.identity.auth_views import (
    SessionLoginAPIView,
    SessionLogoutAPIView,
    SessionStateAPIView,
)

urlpatterns = [
    path("session/", SessionStateAPIView.as_view(), name="auth-session"),
    path("login/", SessionLoginAPIView.as_view(), name="auth-login"),
    path("logout/", SessionLogoutAPIView.as_view(), name="auth-logout"),
]
