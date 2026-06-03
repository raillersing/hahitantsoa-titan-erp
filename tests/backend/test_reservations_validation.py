from datetime import datetime, timedelta

import pytest
from django.utils import timezone

from apps.reservations.periods import ReservationPeriod
from apps.reservations.validation import (
    ReservationItemValidation,
    validate_reservation_item_request,
)


def _valid_period_bounds() -> tuple[datetime, datetime]:
    start_at = timezone.now().replace(microsecond=0)
    end_at = start_at + timedelta(hours=2)
    return start_at, end_at


@pytest.mark.parametrize(
    "inventory_item_kind",
    [
        "material",
        "article",
        "material_pack",
    ],
)
def test_validate_reservation_item_request_accepts_allowed_titan_kinds(
    inventory_item_kind: str,
) -> None:
    start_at, end_at = _valid_period_bounds()

    validation = validate_reservation_item_request(
        inventory_item_kind=inventory_item_kind,
        start_at=start_at,
        end_at=end_at,
    )

    assert validation == ReservationItemValidation(
        inventory_item_kind=inventory_item_kind,
        period=ReservationPeriod(start_at=start_at, end_at=end_at),
    )


@pytest.mark.parametrize(
    "inventory_item_kind",
    [
        "venue",
        "local",
        "room",
        "service",
        "event_service",
        "unknown",
        "",
    ],
)
def test_validate_reservation_item_request_rejects_non_reservable_kinds(
    inventory_item_kind: str,
) -> None:
    start_at, end_at = _valid_period_bounds()

    with pytest.raises(ValueError) as error:
        validate_reservation_item_request(
            inventory_item_kind=inventory_item_kind,
            start_at=start_at,
            end_at=end_at,
        )

    assert "not reservable" in str(error.value)


def test_validate_reservation_item_request_rejects_naive_start_at() -> None:
    _, end_at = _valid_period_bounds()
    naive_start_at = datetime(2026, 1, 1, 10, 0, 0)

    with pytest.raises(ValueError) as error:
        validate_reservation_item_request(
            inventory_item_kind="material",
            start_at=naive_start_at,
            end_at=end_at,
        )

    assert "timezone-aware" in str(error.value)


def test_validate_reservation_item_request_rejects_naive_end_at() -> None:
    start_at, _ = _valid_period_bounds()
    naive_end_at = datetime(2026, 1, 1, 12, 0, 0)

    with pytest.raises(ValueError) as error:
        validate_reservation_item_request(
            inventory_item_kind="material",
            start_at=start_at,
            end_at=naive_end_at,
        )

    assert "timezone-aware" in str(error.value)


@pytest.mark.parametrize("delta", [timedelta(), -timedelta(minutes=1)])
def test_validate_reservation_item_request_rejects_end_at_not_after_start_at(
    delta: timedelta,
) -> None:
    start_at, _ = _valid_period_bounds()
    end_at = start_at + delta

    with pytest.raises(ValueError) as error:
        validate_reservation_item_request(
            inventory_item_kind="material",
            start_at=start_at,
            end_at=end_at,
        )

    assert str(error.value) == "Reservation period end_at must be after start_at."


def test_validate_reservation_item_request_preserves_half_open_period_bounds() -> None:
    start_at, end_at = _valid_period_bounds()

    validation = validate_reservation_item_request(
        inventory_item_kind="material",
        start_at=start_at,
        end_at=end_at,
    )

    assert validation.period.start_at == start_at
    assert validation.period.end_at == end_at
