from rest_framework.permissions import IsAuthenticated


class IsAuthenticatedHahitantsoaEventDraftBoundary(IsAuthenticated):
    """Explicit authenticated boundary for approved Hahitantsoa draft endpoints."""
