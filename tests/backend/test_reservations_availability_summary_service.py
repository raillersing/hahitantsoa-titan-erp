from datetime import datetime, timedelta
from typing import Any

import pytest
from django.apps import apps
from django.utils import timezone

from apps.inventory.models import (
    InventoryAvailability,
    InventoryAvailabilityStatus,
    InventoryItem,
)
from apps.reservations import services as reservation_services
from apps.reservations.periods import make_reservation_period
from apps.reservations.preview import ReservationItemPreviewStatus
from apps.reservations.services import (
    ReservationAvailabilitySummary,
    ReservationAvailableItemsOptions,
    get_reservation_availability_summary_service,
    get_reservation_available_item_previews_service,
    get_reservation_available_items_options_service,
)

pytestmark = pytest.mark.django_db


def _valid_period_bounds() -> tuple[datetime, datetime]:
    start_at = timezone.now().replace(microsecond=0)
    end_at = start_at + timedelta(hours=2)
    return start_at, end_at


def _create_inventory_item(
    *,
    name: str,
    kind: str = "material",
) -> InventoryItem:
    return InventoryItem.objects.create(name=name, kind=kind)


def _create_availability(
    *,
    inventory_item: InventoryItem,
    start_at: datetime,
    end_at: datetime,
    status: InventoryAvailabilityStatus,
) -> InventoryAvailability:
    return InventoryAvailability.objects.create(
        inventory_item=inventory_item,
        status=status,
        start_at=start_at,
        end_at=end_at,
    )


def _reservations_model_counts() -> dict[str, int]:
    return {
        model._meta.label: model.objects.count()
        for model in apps.get_models()
        if model._meta.app_label == "reservations"
    }


def test_reservation_availability_summary_service_returns_dataclass() -> None:
    start_at, end_at = _valid_period_bounds()
    _create_inventory_item(name="Available camera")

    summary = get_reservation_availability_summary_service(
        start_at=start_at,
        end_at=end_at,
    )

    assert isinstance(summary, ReservationAvailabilitySummary)
    assert summary.period.start_at == start_at
    assert summary.period.end_at == end_at
    assert summary.available_item_count == 1
    assert summary.available_preview_count == 1
    assert summary.available_item_kinds == ("material",)


def test_reservation_availability_summary_service_returns_counts_and_kinds_in_stable_order() -> (
    None
):
    start_at, end_at = _valid_period_bounds()
    _create_inventory_item(name="Gamma pack", kind="material_pack")
    _create_inventory_item(name="Alpha material", kind="material")
    _create_inventory_item(name="Beta article", kind="article")

    summary = get_reservation_availability_summary_service(
        start_at=start_at,
        end_at=end_at,
    )

    assert summary.available_item_count == 3
    assert summary.available_preview_count == 3
    assert summary.available_item_kinds == (
        "material",
        "article",
        "material_pack",
    )


def test_reservation_availability_summary_matches_options_and_previews() -> None:
    start_at, end_at = _valid_period_bounds()
    alpha_material = _create_inventory_item(name="Alpha material", kind="material")
    beta_article = _create_inventory_item(name="Beta article", kind="article")
    gamma_pack = _create_inventory_item(name="Gamma pack", kind="material_pack")
    unavailable_item = _create_inventory_item(name="Unavailable material", kind="material")
    _create_availability(
        inventory_item=unavailable_item,
        status=InventoryAvailabilityStatus.BLOCKED,
        start_at=start_at,
        end_at=end_at,
    )

    options = get_reservation_available_items_options_service(
        start_at=start_at,
        end_at=end_at,
    )
    previews = get_reservation_available_item_previews_service(
        start_at=start_at,
        end_at=end_at,
    )
    summary = get_reservation_availability_summary_service(
        start_at=start_at,
        end_at=end_at,
    )

    assert options.items == (alpha_material, beta_article, gamma_pack)
    assert unavailable_item not in options.items
    assert unavailable_item not in tuple(preview.inventory_item for preview in previews)
    assert summary.available_item_count == options.count
    assert summary.available_preview_count == len(previews)
    assert summary.available_item_kinds == tuple(
        preview.inventory_item_kind for preview in previews
    )
    assert summary.available_item_kinds == (
        "material",
        "article",
        "material_pack",
    )


@pytest.mark.parametrize(
    "status",
    [
        InventoryAvailabilityStatus.BLOCKED,
        InventoryAvailabilityStatus.RESERVED,
    ],
)
def test_reservation_availability_summary_service_excludes_unavailable_items(
    status: InventoryAvailabilityStatus,
) -> None:
    start_at, end_at = _valid_period_bounds()
    _create_inventory_item(name="Available camera", kind="article")
    unavailable_item = _create_inventory_item(name="Unavailable camera", kind="material")
    _create_availability(
        inventory_item=unavailable_item,
        status=status,
        start_at=start_at,
        end_at=end_at,
    )

    summary = get_reservation_availability_summary_service(
        start_at=start_at,
        end_at=end_at,
    )

    assert summary.available_item_count == 1
    assert summary.available_preview_count == 1
    assert summary.available_item_kinds == ("article",)


def test_reservation_availability_summary_service_propagates_invalid_period() -> None:
    start_at = timezone.now()

    with pytest.raises(ValueError) as error:
        get_reservation_availability_summary_service(
            start_at=start_at,
            end_at=start_at,
        )

    assert str(error.value) == "Reservation period end_at must be after start_at."


def test_summary_service_does_not_create_availability_or_reservations() -> None:
    start_at, end_at = _valid_period_bounds()
    _create_inventory_item(name="Available light")
    availability_count = InventoryAvailability.objects.count()
    reservation_counts = _reservations_model_counts()

    summary = get_reservation_availability_summary_service(
        start_at=start_at,
        end_at=end_at,
    )

    assert summary.available_item_count == 1
    assert InventoryAvailability.objects.count() == availability_count
    assert _reservations_model_counts() == reservation_counts


def test_reservation_availability_summary_service_reuses_options_without_public_previews(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    start_at, end_at = _valid_period_bounds()
    period = make_reservation_period(start_at=start_at, end_at=end_at)
    first_item = InventoryItem(name="Unsaved camera", kind="material")
    second_item = InventoryItem(name="Unsaved article", kind="article")
    options = ReservationAvailableItemsOptions(
        period=period,
        items=(first_item, second_item),
        count=2,
    )
    options_calls: list[dict[str, Any]] = []
    builder_calls: list[ReservationAvailableItemsOptions] = []

    def fake_get_reservation_available_items_options_service(
        **kwargs: Any,
    ) -> ReservationAvailableItemsOptions:
        options_calls.append(kwargs)
        return options

    def fake_get_reservation_available_item_previews_service(**kwargs: Any) -> tuple[Any, ...]:
        raise AssertionError("Summary service must reuse options instead of public previews.")

    def fake_build_reservation_available_item_previews_from_options(
        **kwargs: ReservationAvailableItemsOptions,
    ) -> tuple[Any, ...]:
        builder_calls.append(kwargs["options"])
        return (
            type(
                "FakePreview",
                (),
                {
                    "inventory_item_kind": first_item.kind,
                    "status": ReservationItemPreviewStatus.AVAILABLE,
                },
            )(),
            type(
                "FakePreview",
                (),
                {
                    "inventory_item_kind": second_item.kind,
                    "status": ReservationItemPreviewStatus.AVAILABLE,
                },
            )(),
        )

    monkeypatch.setattr(
        reservation_services,
        "get_reservation_available_items_options_service",
        fake_get_reservation_available_items_options_service,
    )
    monkeypatch.setattr(
        reservation_services,
        "get_reservation_available_item_previews_service",
        fake_get_reservation_available_item_previews_service,
    )
    monkeypatch.setattr(
        reservation_services,
        "_build_reservation_available_item_previews_from_options",
        fake_build_reservation_available_item_previews_from_options,
    )

    summary = get_reservation_availability_summary_service(
        start_at=start_at,
        end_at=end_at,
    )

    assert summary == ReservationAvailabilitySummary(
        period=period,
        available_item_count=2,
        available_preview_count=2,
        available_item_kinds=("material", "article"),
    )
    assert options_calls == [{"start_at": start_at, "end_at": end_at}]
    assert builder_calls == [options]


def test_reservation_availability_summary_service_does_not_expose_count_by_kind() -> None:
    start_at, end_at = _valid_period_bounds()
    _create_inventory_item(name="Available material", kind="material")

    summary = get_reservation_availability_summary_service(
        start_at=start_at,
        end_at=end_at,
    )

    assert not hasattr(summary, "count_by_kind")
    assert not hasattr(summary, "by_kind")
    assert not hasattr(summary, "kind_count")
    assert not hasattr(summary, "kind_counts")
