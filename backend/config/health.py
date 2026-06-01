from django.db import connections
from django.http import JsonResponse
from django.views.decorators.http import require_GET


@require_GET
def healthz(request):
    response = JsonResponse({"status": "ok"})
    response["Cache-Control"] = "no-store"
    return response


@require_GET
def readyz(request):
    status_code = 200
    payload = {"status": "ready", "checks": {"database": "ok"}}

    try:
        with connections["default"].cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
    except Exception:
        status_code = 503
        payload = {"status": "not_ready", "checks": {"database": "error"}}

    response = JsonResponse(payload, status=status_code)
    response["Cache-Control"] = "no-store"
    return response
