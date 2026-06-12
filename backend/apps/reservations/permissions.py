from rest_framework.permissions import IsAuthenticated


class IsAuthenticatedReservationReadBoundary(IsAuthenticated):
    """Explicit authenticated boundary for approved reservations read endpoints."""


class IsAuthenticatedReservationDraftBoundary(IsAuthenticated):
    """Explicit authenticated boundary for approved reservations draft endpoints."""
