from dataclasses import dataclass
from datetime import datetime

from django.utils import timezone

from apps.reservations.authorization import require_reservation_sensitive_staff_actor


@dataclass(frozen=True)
class ReservationSensitiveActorAttribution:
    actor_id: object
    attributed_at: datetime


def capture_reservation_sensitive_actor_attribution(
    *,
    actor: object | None,
) -> ReservationSensitiveActorAttribution:
    require_reservation_sensitive_staff_actor(actor=actor)

    actor_id = getattr(actor, "pk", None)
    if actor_id is None:
        raise ValueError("Reservation-sensitive actor must have a persistent identifier.")

    return ReservationSensitiveActorAttribution(
        actor_id=actor_id,
        attributed_at=timezone.now(),
    )
