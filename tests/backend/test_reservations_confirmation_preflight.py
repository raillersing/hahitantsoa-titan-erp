from dataclasses import FrozenInstanceError
from datetime import datetime, timedelta
from typing import Any

import pytest
from django.utils import timezone

from apps.audit.models import AuditEvent
from apps.customers.models import Customer
from apps.inventory.models import (
    InventoryAvailability,
    InventoryAvailabilityStatus,
    InventoryItem,
)
from apps.reservations import confirmation as reservation_confirmation
from apps.reservations.confirmation import (
    RESERVATION_CONFIRMATION_BLOCKER_ACTIVE_AVAILABILITY_CONFLICT,
    RESERVATION_CONFIRMATION_BLOCKER_MISSING_REQUIRED_DATA,
    RESERVATION_CONFIRMATION_BLOCKER_MISSING_REQUIRED_DEPOSIT,
    RESERVATION_CONFIRMATION_BLOCKER_MISSING_SIGNED_CONTRACT,
    RESERVATION_CONFIRMATION_BLOCKER_PERMISSION_DENIED,
    ReservationDraftConfirmationPreflight,
    get_reservation_draft_confirmation_preflight,
)
from apps.reservations.models import (
    ReservationDraft,
    ReservationDraftLine,
    ReservationDraftStatus,
)

pytestmark = pytest.mark.django_db


def _period() -> tuple[datetime, datetime]:
    start_at = timezone.now().replace(microsecond=0)
    return start_at, start_at + timedelta(hours=2)


def _customer() -> Customer:
    return Customer.objects.create(display_name="Client Demo")


def _item(*, name: str = "Projecteur LED", kind: str = "article") -> InventoryItem:
    return InventoryItem.objects.create(name=name, kind=kind)


def _draft() -> ReservationDraft:
    start_at, end_at = _period()
    return ReservationDraft.objects.create(
        customer=_customer(),
        start_at=start_at,
        end_at=end_at,
    )


def _line(
    *, reservation_draft: ReservationDraft, inventory_item: InventoryItem
) -> ReservationDraftLine:
    return ReservationDraftLine.objects.create(
        reservation_draft=reservation_draft,
        inventory_item=inventory_item,
        quantity=1,
    )


def _actor(*, django_user_model, username: str = "reservation-staff", is_staff: bool = True):
    return django_user_model.objects.create_user(
        username=username,
        password="test-password",
        is_staff=is_staff,
    )


def _snapshot_reservation_draft(draft: ReservationDraft) -> dict[str, object | None]:
    draft.refresh_from_db()
    return {
        "status": draft.status,
        "contract_signed_at": draft.contract_signed_at,
        "contract_signed_by_id": draft.contract_signed_by_id,
        "required_deposit_received_at": draft.required_deposit_received_at,
        "required_deposit_received_by_id": draft.required_deposit_received_by_id,
        "confirmed_at": draft.confirmed_at,
        "confirmed_by_id": draft.confirmed_by_id,
        "cancelled_at": draft.cancelled_at,
        "cancelled_by_id": draft.cancelled_by_id,
    }


def _snapshot_availabilities() -> tuple[tuple[object | None, bool, object | None], ...]:
    return tuple(
        InventoryAvailability.objects.order_by("id").values_list(
            "reservation_draft_id",
            "is_deleted",
            "deleted_at",
        )
    )


def test_confirmation_preflight_returns_explicit_prerequisite_blockers(
    django_user_model,
) -> None:
    draft = _draft()
    item = _item(kind="material")
    _line(reservation_draft=draft, inventory_item=item)
    actor = _actor(django_user_model=django_user_model)

    preflight = get_reservation_draft_confirmation_preflight(
        reservation_draft=draft,
        actor=actor,
    )

    assert preflight == ReservationDraftConfirmationPreflight(
        can_confirm=False,
        blockers=(
            RESERVATION_CONFIRMATION_BLOCKER_MISSING_SIGNED_CONTRACT,
            RESERVATION_CONFIRMATION_BLOCKER_MISSING_REQUIRED_DEPOSIT,
        ),
        active_line_count=1,
        attribution_ready=True,
    )
    assert preflight.attribution_ready is True


def test_confirmation_preflight_prerequisite_blockers_clear_when_markers_exist(
    django_user_model,
) -> None:
    draft = _draft()
    item = _item(kind="material")
    actor = _actor(django_user_model=django_user_model)
    _line(reservation_draft=draft, inventory_item=item)

    draft.contract_signed_at = timezone.now()
    draft.contract_signed_by_id = actor.pk
    draft.required_deposit_received_at = timezone.now()
    draft.required_deposit_received_by_id = actor.pk
    draft.save(
        update_fields=[
            "contract_signed_at",
            "contract_signed_by",
            "required_deposit_received_at",
            "required_deposit_received_by",
        ]
    )

    preflight = get_reservation_draft_confirmation_preflight(
        reservation_draft=draft,
        actor=actor,
    )

    assert preflight.can_confirm is True
    assert preflight.blockers == ()


def test_confirmation_preflight_rejects_soft_deleted_draft(
    django_user_model,
) -> None:
    draft = _draft()
    draft.is_deleted = True
    draft.deleted_at = timezone.now()
    draft.save(update_fields=["is_deleted", "deleted_at"])
    actor = _actor(django_user_model=django_user_model)

    preflight = get_reservation_draft_confirmation_preflight(
        reservation_draft=draft,
        actor=actor,
    )

    assert RESERVATION_CONFIRMATION_BLOCKER_MISSING_REQUIRED_DATA in preflight.blockers


def test_confirmation_preflight_ignores_soft_deleted_lines_and_blocks_empty_active_lines(
    django_user_model,
) -> None:
    draft = _draft()
    line = _line(reservation_draft=draft, inventory_item=_item())
    line.is_deleted = True
    line.deleted_at = timezone.now()
    line.save(update_fields=["is_deleted", "deleted_at"])
    actor = _actor(django_user_model=django_user_model)

    preflight = get_reservation_draft_confirmation_preflight(
        reservation_draft=draft,
        actor=actor,
    )

    assert preflight.active_line_count == 0
    assert RESERVATION_CONFIRMATION_BLOCKER_MISSING_REQUIRED_DATA in preflight.blockers


def test_confirmation_preflight_blocks_unauthorized_actor() -> None:
    draft = _draft()
    _line(reservation_draft=draft, inventory_item=_item())

    preflight = get_reservation_draft_confirmation_preflight(
        reservation_draft=draft,
        actor=None,
    )

    assert preflight.attribution_ready is False
    assert RESERVATION_CONFIRMATION_BLOCKER_PERMISSION_DENIED in preflight.blockers


def test_confirmation_preflight_blocks_actor_without_persistent_identifier(
    monkeypatch: pytest.MonkeyPatch,
    django_user_model,
) -> None:
    draft = _draft()
    _line(reservation_draft=draft, inventory_item=_item())
    actor = _actor(django_user_model=django_user_model)

    def fake_capture(*, actor: object | None) -> object:
        raise ValueError("Reservation-sensitive actor must have a persistent identifier.")

    monkeypatch.setattr(
        reservation_confirmation,
        "capture_reservation_sensitive_actor_attribution",
        fake_capture,
    )

    preflight = get_reservation_draft_confirmation_preflight(
        reservation_draft=draft,
        actor=actor,
    )

    assert preflight.attribution_ready is False
    assert RESERVATION_CONFIRMATION_BLOCKER_MISSING_REQUIRED_DATA in preflight.blockers


def test_confirmation_preflight_revalidates_availability_through_existing_helper(
    monkeypatch: pytest.MonkeyPatch,
    django_user_model,
) -> None:
    draft = _draft()
    line = _line(reservation_draft=draft, inventory_item=_item(kind="material"))
    actor = _actor(django_user_model=django_user_model)
    calls: list[dict[str, Any]] = []

    def fake_validate(**kwargs: Any):
        calls.append(kwargs)

        class Result:
            valid = False
            available = False

        return Result()

    monkeypatch.setattr(
        reservation_confirmation,
        "validate_reservation_item_availability_request",
        fake_validate,
    )

    preflight = get_reservation_draft_confirmation_preflight(
        reservation_draft=draft,
        actor=actor,
    )

    assert RESERVATION_CONFIRMATION_BLOCKER_ACTIVE_AVAILABILITY_CONFLICT in preflight.blockers
    assert calls == [
        {
            "inventory_item": line.inventory_item,
            "inventory_item_kind": line.inventory_item.kind,
            "start_at": draft.start_at,
            "end_at": draft.end_at,
        }
    ]


def test_confirmation_preflight_reports_real_availability_conflict(
    django_user_model,
) -> None:
    draft = _draft()
    item = _item(kind="material")
    _line(reservation_draft=draft, inventory_item=item)
    actor = _actor(django_user_model=django_user_model)
    InventoryAvailability.objects.create(
        inventory_item=item,
        status=InventoryAvailabilityStatus.RESERVED,
        start_at=draft.start_at,
        end_at=draft.end_at,
    )

    preflight = get_reservation_draft_confirmation_preflight(
        reservation_draft=draft,
        actor=actor,
    )

    assert RESERVATION_CONFIRMATION_BLOCKER_ACTIVE_AVAILABILITY_CONFLICT in preflight.blockers


def test_confirmation_preflight_blocks_inactive_or_soft_deleted_inventory_item(
    django_user_model,
) -> None:
    draft = _draft()
    item = _item(kind="material")
    _line(reservation_draft=draft, inventory_item=item)
    actor = _actor(django_user_model=django_user_model)

    item.is_active = False
    item.is_deleted = True
    item.deleted_at = timezone.now()
    item.save(update_fields=["is_active", "is_deleted", "deleted_at"])

    preflight = get_reservation_draft_confirmation_preflight(
        reservation_draft=draft,
        actor=actor,
    )

    assert RESERVATION_CONFIRMATION_BLOCKER_ACTIVE_AVAILABILITY_CONFLICT in preflight.blockers


def test_confirmation_preflight_skips_soft_deleted_lines_during_revalidation(
    django_user_model,
) -> None:
    draft = _draft()
    active_item = _item(name="Pack sonorisation + eclairage", kind="material_pack")
    conflicting_item = _item(name="Projecteur LED", kind="material")
    _line(reservation_draft=draft, inventory_item=active_item)
    deleted_line = _line(reservation_draft=draft, inventory_item=conflicting_item)
    actor = _actor(django_user_model=django_user_model)
    InventoryAvailability.objects.create(
        inventory_item=conflicting_item,
        status=InventoryAvailabilityStatus.BLOCKED,
        start_at=draft.start_at,
        end_at=draft.end_at,
    )

    deleted_line.is_deleted = True
    deleted_line.deleted_at = timezone.now()
    deleted_line.save(update_fields=["is_deleted", "deleted_at"])

    preflight = get_reservation_draft_confirmation_preflight(
        reservation_draft=draft,
        actor=actor,
    )

    assert preflight.active_line_count == 1
    assert preflight.blockers == (
        RESERVATION_CONFIRMATION_BLOCKER_MISSING_SIGNED_CONTRACT,
        RESERVATION_CONFIRMATION_BLOCKER_MISSING_REQUIRED_DEPOSIT,
    )


def test_confirmation_preflight_does_not_confirm_or_write_side_effects(
    django_user_model,
) -> None:
    draft = _draft()
    _line(reservation_draft=draft, inventory_item=_item(kind="material"))
    actor = _actor(django_user_model=django_user_model)
    draft_state = _snapshot_reservation_draft(draft)
    availability_state = _snapshot_availabilities()
    availability_count = InventoryAvailability.objects.count()
    audit_count = AuditEvent.objects.count()

    preflight = get_reservation_draft_confirmation_preflight(
        reservation_draft=draft,
        actor=actor,
    )

    assert _snapshot_reservation_draft(draft) == draft_state
    assert draft.status == ReservationDraftStatus.DRAFT
    assert preflight.can_confirm is False
    assert InventoryAvailability.objects.count() == availability_count
    assert _snapshot_availabilities() == availability_state
    assert AuditEvent.objects.count() == audit_count


def test_confirmation_preflight_rejects_non_draft_source_state(
    django_user_model,
) -> None:
    draft = _draft()
    _line(reservation_draft=draft, inventory_item=_item(kind="material"))
    actor = _actor(django_user_model=django_user_model)
    draft.status = "pending_confirmation"

    preflight = get_reservation_draft_confirmation_preflight(
        reservation_draft=draft,
        actor=actor,
    )

    assert RESERVATION_CONFIRMATION_BLOCKER_MISSING_REQUIRED_DATA in preflight.blockers


@pytest.mark.parametrize(
    ("scenario", "configure"),
    [
        (
            "unauthorized_actor",
            lambda draft, actor, item: None,
        ),
        (
            "availability_conflict",
            lambda draft, actor, item: InventoryAvailability.objects.create(
                inventory_item=item,
                status=InventoryAvailabilityStatus.RESERVED,
                start_at=draft.start_at,
                end_at=draft.end_at,
            ),
        ),
        (
            "missing_prerequisites",
            lambda draft, actor, item: None,
        ),
        (
            "non_draft_state",
            lambda draft, actor, item: setattr(draft, "status", ReservationDraftStatus.CONFIRMED),
        ),
        (
            "soft_deleted_lines",
            lambda draft, actor, item: draft.lines.update(
                is_deleted=True,
                deleted_at=timezone.now(),
            ),
        ),
    ],
)
def test_confirmation_preflight_remains_read_only_across_blocker_scenarios(
    django_user_model,
    scenario: str,
    configure,
) -> None:
    draft = _draft()
    item = _item(kind="material")
    _line(reservation_draft=draft, inventory_item=item)
    actor = _actor(django_user_model=django_user_model)

    if scenario == "non_draft_state":
        configure(draft, actor, item)
    else:
        configure(draft, actor, item)
        if scenario == "soft_deleted_lines":
            pass

    if scenario == "non_draft_state":
        draft.save(update_fields=["status"])

    draft_state = _snapshot_reservation_draft(draft)
    availability_count = InventoryAvailability.objects.count()
    availability_state = _snapshot_availabilities()

    preflight = get_reservation_draft_confirmation_preflight(
        reservation_draft=draft,
        actor=None if scenario == "unauthorized_actor" else actor,
    )

    assert preflight.can_confirm is False
    assert _snapshot_reservation_draft(draft) == draft_state
    assert InventoryAvailability.objects.count() == availability_count
    assert _snapshot_availabilities() == availability_state


def test_confirmation_preflight_dataclass_is_frozen() -> None:
    preflight = ReservationDraftConfirmationPreflight(
        can_confirm=False,
        blockers=(),
        active_line_count=0,
        attribution_ready=False,
    )

    with pytest.raises(FrozenInstanceError):
        preflight.can_confirm = True
