from rest_framework.permissions import IsAuthenticated


class IsAuthenticatedVisitReadBoundary(IsAuthenticated):
    """Explicit authenticated boundary for visit reads."""
