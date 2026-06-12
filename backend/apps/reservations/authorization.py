"""Narrow backend-only authorization helpers for reservation-sensitive writes."""


def is_reservation_sensitive_staff_actor(*, actor: object) -> bool:
    if actor is None:
        return False

    is_authenticated = getattr(actor, "is_authenticated", False)
    if is_authenticated is not True:
        return False

    # Keep compatibility with simple authenticated/staff stubs while still denying
    # explicit inactive actors when the attribute exists.
    is_active = getattr(actor, "is_active", None)
    if is_active is False:
        return False

    is_staff = getattr(actor, "is_staff", False)
    return is_staff is True


def require_reservation_sensitive_staff_actor(*, actor: object) -> None:
    if not is_reservation_sensitive_staff_actor(actor=actor):
        raise PermissionError("Actor is not allowed to perform a reservation-sensitive write.")
