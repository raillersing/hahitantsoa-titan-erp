from dataclasses import FrozenInstanceError
from datetime import datetime, timedelta

import pytest
from django.utils import timezone

from apps.reservations.periods import (
    ReservationPeriod,
    is_aware_datetime,
    make_reservation_period,
    validate_reservation_period,
)


def _valid_period_bounds() -> tuple[datetime, datetime]:
    start_at = timezone.now().replace(microsecond=0)
    end_at = start_at + timedelta(hours=2)
    return start_at, end_at


def test_reservation_period_accepts_valid_timezone_aware_bounds() -> None:
    start_at, end_at = _valid_period_bounds()

    period = ReservationPeriod(start_at=start_at, end_at=end_at)

    assert period.start_at == start_at
    assert period.end_at == end_at


def test_make_reservation_period_returns_valid_period() -> None:
    start_at, end_at = _valid_period_bounds()

    period = make_reservation_period(start_at=start_at, end_at=end_at)

    assert period == ReservationPeriod(start_at=start_at, end_at=end_at)


def test_validate_reservation_period_accepts_valid_period() -> None:
    start_at, end_at = _valid_period_bounds()

    validate_reservation_period(start_at=start_at, end_at=end_at)


@pytest.mark.parametrize(
    ("start_at", "end_at", "error_type", "expected_message"),
    [
        (
            None,
            timezone.now(),
            ValueError,
            "Reservation period start_at is required.",
        ),
        (
            timezone.now(),
            None,
            ValueError,
            "Reservation period end_at is required.",
        ),
        (
            "2026-01-01T10:00:00Z",
            timezone.now(),
            TypeError,
            "Reservation period start_at must be a datetime.",
        ),
        (
            timezone.now(),
            "2026-01-01T12:00:00Z",
            TypeError,
            "Reservation period end_at must be a datetime.",
        ),
    ],
)
def test_validate_reservation_period_rejects_missing_or_invalid_types(
    start_at,
    end_at,
    error_type: type[Exception],
    expected_message: str,
) -> None:
    with pytest.raises(error_type) as error:
        validate_reservation_period(start_at=start_at, end_at=end_at)

    assert str(error.value) == expected_message


def test_validate_reservation_period_rejects_naive_start_at() -> None:
    _, end_at = _valid_period_bounds()
    naive_start_at = datetime(2026, 1, 1, 10, 0, 0)

    with pytest.raises(ValueError) as error:
        validate_reservation_period(start_at=naive_start_at, end_at=end_at)

    assert "timezone-aware" in str(error.value)


def test_validate_reservation_period_rejects_naive_end_at() -> None:
    start_at, _ = _valid_period_bounds()
    naive_end_at = datetime(2026, 1, 1, 12, 0, 0)

    with pytest.raises(ValueError) as error:
        validate_reservation_period(start_at=start_at, end_at=naive_end_at)

    assert "timezone-aware" in str(error.value)


@pytest.mark.parametrize("delta", [timedelta(), -timedelta(minutes=1)])
def test_validate_reservation_period_rejects_end_at_not_after_start_at(
    delta: timedelta,
) -> None:
    start_at, _ = _valid_period_bounds()
    end_at = start_at + delta

    with pytest.raises(ValueError) as error:
        validate_reservation_period(start_at=start_at, end_at=end_at)

    assert str(error.value) == "Reservation period end_at must be after start_at."


def test_reservation_period_rejects_invalid_bounds_in_post_init() -> None:
    start_at, _ = _valid_period_bounds()

    with pytest.raises(ValueError) as error:
        ReservationPeriod(start_at=start_at, end_at=start_at)

    assert str(error.value) == "Reservation period end_at must be after start_at."


def test_valid_reservation_period_uses_half_open_interval_semantics() -> None:
    start_at, end_at = _valid_period_bounds()

    period = make_reservation_period(start_at=start_at, end_at=end_at)

    assert period.start_at < period.end_at


def test_reservation_period_is_immutable() -> None:
    start_at, end_at = _valid_period_bounds()
    period = ReservationPeriod(start_at=start_at, end_at=end_at)

    with pytest.raises(FrozenInstanceError):
        period.start_at = start_at + timedelta(hours=1)


def test_is_aware_datetime_returns_true_only_for_timezone_aware_datetimes() -> None:
    aware_value = timezone.now()
    naive_value = datetime(2026, 1, 1, 10, 0, 0)

    assert is_aware_datetime(aware_value) is True
    assert is_aware_datetime(naive_value) is False
    assert is_aware_datetime(None) is False
    assert is_aware_datetime("2026-01-01T10:00:00Z") is False
