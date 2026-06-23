from __future__ import annotations

import platform
import time as time_module

import django
from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.http import require_GET

from config.health import is_database_ready, is_redis_ready

# Module-level import time serves as a coarse uptime anchor.
_UPTIME_ANCHOR = time_module.time()


@require_GET
def metrics(request):
    uptime_seconds = int(time_module.time() - _UPTIME_ANCHOR)

    payload = {
        "app_version": getattr(settings, "APP_VERSION", "0.1.0"),
        "django_version": django.get_version(),
        "python_version": platform.python_version(),
        "debug": settings.DEBUG,
        "uptime_seconds": uptime_seconds,
        "allowed_hosts_count": len(getattr(settings, "ALLOWED_HOSTS", [])),
        "installed_apps_count": len(getattr(settings, "INSTALLED_APPS", [])),
        "database_ready": is_database_ready(),
        "redis_ready": is_redis_ready(),
    }

    response = JsonResponse(payload)
    response["Cache-Control"] = "no-store"
    return response
