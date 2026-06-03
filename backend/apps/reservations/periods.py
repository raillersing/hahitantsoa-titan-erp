from dataclasses import dataclass
from datetime import datetime

from django.utils import timezone


@dataclass(frozen=True)
class ReservationPeriod:
    start_at: datetime
    end_at: datetime

    def __post_init__(self) -> None:
        validate_reservation_period(start_at=self.start_at, end_at=self.end_at)


def is_aware_datetime(value: datetime) -> bool:
    return isinstance(value, datetime) and timezone.is_aware(value)


def validate_reservation_period(start_at: datetime, end_at: datetime) -> None:
    if start_at is None:
        raise ValueError("Reservation period start_at is required.")
    if end_at is None:
        raise ValueError("Reservation period end_at is required.")
    if not isinstance(start_at, datetime):
        raise TypeError("Reservation period start_at must be a datetime.")
    if not isinstance(end_at, datetime):
        raise TypeError("Reservation period end_at must be a datetime.")
    if not is_aware_datetime(start_at):
        raise ValueError("Reservation period start_at must be timezone-aware.")
    if not is_aware_datetime(end_at):
        raise ValueError("Reservation period end_at must be timezone-aware.")
    if end_at <= start_at:
        raise ValueError("Reservation period end_at must be after start_at.")


def make_reservation_period(start_at: datetime, end_at: datetime) -> ReservationPeriod:
    return ReservationPeriod(start_at=start_at, end_at=end_at)
