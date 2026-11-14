from __future__ import annotations

import logging

from django.contrib.auth import logout
from django.http import JsonResponse

from apps.identity.session_services import check_session_revocation_and_touch

logger = logging.getLogger(__name__)


class UserDeviceSessionActivityMiddleware:
    """
    Middleware that:
    1. Checks if the current session was revoked remotely. If so, immediately
       terminates the session and returns a 401 response with code 'session_revoked'.
    2. Throttles activity timestamps (last_seen_at) for authenticated sessions.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if getattr(request, "user", None) and request.user.is_authenticated:
            session_key = getattr(request.session, "session_key", None)
            if session_key:
                is_revoked = check_session_revocation_and_touch(
                    request=request,
                    user=request.user,
                    session_key=session_key,
                )
                if is_revoked:
                    logout(request)
                    return JsonResponse(
                        {
                            "detail": (
                                "Votre session a été révoquée à distance. "
                                "Veuillez vous reconnecter."
                            ),
                            "code": "session_revoked",
                        },
                        status=401,
                    )

        return self.get_response(request)
