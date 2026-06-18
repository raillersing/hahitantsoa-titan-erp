from rest_framework.permissions import IsAuthenticated


class IsAuthenticatedBillingBoundary(IsAuthenticated):
    """Explicit authenticated boundary for billing invoice endpoints."""
