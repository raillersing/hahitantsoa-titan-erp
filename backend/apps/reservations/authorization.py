"""Narrow backend-only authorization helpers for reservation-sensitive writes."""

from apps.identity.authorization import (
    is_reservation_sensitive_actor,
    require_reservation_sensitive_actor,
)


def is_reservation_sensitive_staff_actor(*, actor: object) -> bool:
    return is_reservation_sensitive_actor(actor=actor)


def require_reservation_sensitive_staff_actor(*, actor: object) -> None:
    require_reservation_sensitive_actor(actor=actor)
