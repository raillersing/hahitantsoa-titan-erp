from rest_framework.permissions import IsAuthenticated


class IsAuthenticatedPaymentBoundary(IsAuthenticated):
    """Explicit authenticated boundary for payment ledger endpoints."""
