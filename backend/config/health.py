import socket
from collections.abc import Callable

from django.conf import settings
from django.db import connections
from django.http import JsonResponse
from django.views.decorators.http import require_GET

REDIS_READY_TIMEOUT_SECONDS = 1.0


@require_GET
def healthz(request):
    response = JsonResponse({"status": "ok"})
    response["Cache-Control"] = "no-store"
    return response


def _build_redis_command(*parts: str) -> bytes:
    encoded_parts = [part.encode("utf-8") for part in parts]
    command = [f"*{len(encoded_parts)}\r\n".encode("ascii")]

    for part in encoded_parts:
        command.append(f"${len(part)}\r\n".encode("ascii"))
        command.append(part)
        command.append(b"\r\n")

    return b"".join(command)


def is_database_ready() -> bool:
    try:
        with connections["default"].cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
    except Exception:
        return False

    return True


def is_redis_ready() -> bool:
    try:
        with socket.create_connection(
            (settings.REDIS_HOST, settings.REDIS_PORT),
            timeout=REDIS_READY_TIMEOUT_SECONDS,
        ) as redis_socket:
            redis_socket.settimeout(REDIS_READY_TIMEOUT_SECONDS)

            if settings.REDIS_PASSWORD:
                redis_socket.sendall(_build_redis_command("AUTH", settings.REDIS_PASSWORD))
                auth_response = redis_socket.recv(1024)
                if not auth_response.startswith(b"+OK"):
                    return False

            redis_socket.sendall(_build_redis_command("PING"))
            ping_response = redis_socket.recv(1024)
    except Exception:
        return False

    return ping_response.startswith(b"+PONG")


def _readiness_status(check: Callable[[], bool]) -> str:
    try:
        return "ok" if check() else "error"
    except Exception:
        return "error"


@require_GET
def readyz(request):
    checks = {
        "database": _readiness_status(is_database_ready),
        "redis": _readiness_status(is_redis_ready),
    }
    ready = all(status == "ok" for status in checks.values())
    status_code = 200 if ready else 503
    payload = {"status": "ready" if ready else "not_ready", "checks": checks}

    response = JsonResponse(payload, status=status_code)
    response["Cache-Control"] = "no-store"
    return response
