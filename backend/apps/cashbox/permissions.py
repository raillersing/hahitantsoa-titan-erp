from rest_framework.permissions import IsAuthenticated


class IsAuthenticatedCashboxBoundary(IsAuthenticated):
    """Explicit authenticated boundary for cashbox read endpoints."""
