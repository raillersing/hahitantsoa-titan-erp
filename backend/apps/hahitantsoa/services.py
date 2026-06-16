from dataclasses import dataclass
from datetime import datetime

from django.db import transaction
from django.utils import timezone

from apps.audit.services import record_audit_event_on_commit
from apps.hahitantsoa.models import (
    HahitantsoaEventDraft,
    HahitantsoaEventDraftAmendmentRequest,
)
from apps.hahitantsoa.selectors import _get_available_hahitantsoa_shared_inventory_items_for_period
from apps.inventory.models import InventoryAvailability, InventoryAvailabilityStatus, InventoryItem
from apps.reservations.attribution import capture_reservation_sensitive_actor_attribution
from apps.reservations.confirmation import (
    RESERVATION_CONFIRMATION_BLOCKER_ACTIVE_AVAILABILITY_CONFLICT,
    RESERVATION_CONFIRMATION_BLOCKER_MISSING_REQUIRED_DATA,
    RESERVATION_CONFIRMATION_BLOCKER_MISSING_REQUIRED_DEPOSIT,
    RESERVATION_CONFIRMATION_BLOCKER_MISSING_SIGNED_CONTRACT,
    ReservationConfirmationPreflightError,
    ReservationLifecycleStateError,
)
from apps.reservations.periods import ReservationPeriod, make_reservation_period
from apps.reservations.preview import ReservationItemPreview, preview_reservation_item_request


@dataclass(frozen=True)
class HahitantsoaSharedAvailabilityItemPreview:
    inventory_item: InventoryItem
    period: ReservationPeriod
    status: str


@dataclass(frozen=True)
class HahitantsoaEventDraftAvailabilityLinePreview:
    event_draft_line_id: str
    quantity: int
    inventory_item_id: str
    inventory_item_name: str
    inventory_item_kind: str
    status: str
    conflict_count: int


@dataclass(frozen=True)
class HahitantsoaEventDraftAvailabilityPreview:
    event_draft_id: str
    public_reference: str
    start_at: datetime
    end_at: datetime
    line_count: int
    available_line_count: int
    unavailable_line_count: int
    lines: tuple[HahitantsoaEventDraftAvailabilityLinePreview, ...]


@dataclass(frozen=True)
class HahitantsoaEventDraftConfirmationPreflight:
    event_draft_id: str
    public_reference: str
    status: str
    can_confirm: bool
    blockers: tuple[str, ...]
    active_line_count: int
    unavailable_line_count: int


@dataclass(frozen=True)
class HahitantsoaEventDraftAmendmentPreflight:
    event_draft_id: str
    public_reference: str
    status: str
    can_amend: bool
    blockers: tuple[str, ...]
    active_line_count: int


@dataclass(frozen=True)
class HahitantsoaEventDraftConfirmationResult:
    event_draft: HahitantsoaEventDraft
    blocked_item_count: int


@dataclass(frozen=True)
class HahitantsoaEventDraftAmendmentRequestResult:
    amendment_request: HahitantsoaEventDraftAmendmentRequest


def get_hahitantsoa_shared_availability_item_previews(
    *,
    start_at: datetime,
    end_at: datetime,
) -> tuple[HahitantsoaSharedAvailabilityItemPreview, ...]:
    period = make_reservation_period(start_at=start_at, end_at=end_at)
    items = tuple(
        _get_available_hahitantsoa_shared_inventory_items_for_period(
            start_at=period.start_at,
            end_at=period.end_at,
        )
    )
    return tuple(
        HahitantsoaSharedAvailabilityItemPreview(
            inventory_item=item,
            period=period,
            status="available",
        )
        for item in items
    )


def _build_hahitantsoa_event_draft_line_preview(
    *,
    preview: ReservationItemPreview,
    line,
) -> HahitantsoaEventDraftAvailabilityLinePreview:
    return HahitantsoaEventDraftAvailabilityLinePreview(
        event_draft_line_id=str(line.id),
        quantity=line.quantity,
        inventory_item_id=str(line.inventory_item.id),
        inventory_item_name=line.inventory_item.name,
        inventory_item_kind=line.inventory_item.kind,
        status=preview.status.value,
        conflict_count=len(preview.conflicts),
    )


def get_hahitantsoa_event_draft_availability_preview(
    *,
    event_draft: HahitantsoaEventDraft,
) -> HahitantsoaEventDraftAvailabilityPreview:
    period = make_reservation_period(start_at=event_draft.start_at, end_at=event_draft.end_at)
    lines = tuple(
        event_draft.lines.filter(is_deleted=False)
        .select_related("inventory_item")
        .order_by("created_at", "id")
    )
    line_previews = tuple(
        _build_hahitantsoa_event_draft_line_preview(
            line=line,
            preview=preview_reservation_item_request(
                inventory_item=line.inventory_item,
                inventory_item_kind=line.inventory_item.kind,
                start_at=period.start_at,
                end_at=period.end_at,
            ),
        )
        for line in lines
    )
    available_line_count = sum(1 for line in line_previews if line.status == "available")
    unavailable_line_count = len(line_previews) - available_line_count

    return HahitantsoaEventDraftAvailabilityPreview(
        event_draft_id=str(event_draft.id),
        public_reference=event_draft.public_reference,
        start_at=period.start_at,
        end_at=period.end_at,
        line_count=len(line_previews),
        available_line_count=available_line_count,
        unavailable_line_count=unavailable_line_count,
        lines=line_previews,
    )


def _append_blocker(*, blockers: list[str], blocker: str) -> None:
    if blocker not in blockers:
        blockers.append(blocker)


def _is_contract_signed(*, event_draft: HahitantsoaEventDraft) -> bool:
    return (
        event_draft.contract_signed_at is not None and event_draft.contract_signed_by_id is not None
    )


def _is_required_deposit_received(*, event_draft: HahitantsoaEventDraft) -> bool:
    return (
        event_draft.required_deposit_received_at is not None
        and event_draft.required_deposit_received_by_id is not None
    )


def _active_hahitantsoa_event_draft_lines(
    *,
    event_draft: HahitantsoaEventDraft,
) -> tuple:
    return tuple(
        event_draft.lines.filter(is_deleted=False)
        .select_related("inventory_item")
        .order_by("created_at", "id")
    )


def _locked_active_hahitantsoa_event_draft_lines(
    *,
    event_draft: HahitantsoaEventDraft,
) -> tuple:
    return tuple(
        event_draft.lines.filter(is_deleted=False)
        .select_related("inventory_item")
        .select_for_update()
        .order_by("created_at", "id")
    )


def _is_confirmed(*, event_draft: HahitantsoaEventDraft) -> bool:
    return (
        event_draft.status == "confirmed"
        and event_draft.confirmed_at is not None
        and event_draft.confirmed_by_id is not None
    )


def _availability_revalidation_failed(
    *,
    event_draft: HahitantsoaEventDraft,
    active_lines: tuple,
) -> bool:
    for line in active_lines:
        if not line.inventory_item.is_active or line.inventory_item.is_deleted:
            return True

        preview = preview_reservation_item_request(
            inventory_item=line.inventory_item,
            inventory_item_kind=line.inventory_item.kind,
            start_at=event_draft.start_at,
            end_at=event_draft.end_at,
        )
        if preview.status != "available":
            return True

    return False


def _get_locked_hahitantsoa_event_draft(
    *,
    event_draft: HahitantsoaEventDraft,
) -> HahitantsoaEventDraft:
    return HahitantsoaEventDraft.objects.select_for_update().get(pk=event_draft.pk)


def _assert_active_draft_state(*, event_draft: HahitantsoaEventDraft) -> None:
    if event_draft.is_deleted:
        raise ReservationLifecycleStateError(
            "Hahitantsoa event draft must not be soft-deleted.",
            code="soft_deleted_draft",
        )

    if event_draft.status != "draft":
        raise ReservationLifecycleStateError(
            "Hahitantsoa event draft must remain in draft state.",
            code="draft_not_in_draft_state",
        )

    if event_draft.confirmed_at is not None or event_draft.confirmed_by_id is not None:
        raise ReservationLifecycleStateError(
            "Hahitantsoa event draft already carries confirmation metadata.",
            code="draft_has_confirmation_metadata",
        )


def assert_hahitantsoa_event_draft_mutable(*, event_draft: HahitantsoaEventDraft) -> None:
    if _is_confirmed(event_draft=event_draft):
        raise ReservationLifecycleStateError(
            "Confirmed Hahitantsoa event drafts are immutable until amendment workflow exists.",
            code="confirmed_draft_is_immutable",
        )


def get_hahitantsoa_event_draft_amendment_preflight(
    *,
    event_draft: HahitantsoaEventDraft,
) -> HahitantsoaEventDraftAmendmentPreflight:
    active_line_count = len(_active_hahitantsoa_event_draft_lines(event_draft=event_draft))
    blockers: list[str] = []

    if not _is_confirmed(event_draft=event_draft):
        blockers.append("draft_not_confirmed_for_amendment")

    return HahitantsoaEventDraftAmendmentPreflight(
        event_draft_id=str(event_draft.id),
        public_reference=event_draft.public_reference,
        status=event_draft.status,
        can_amend=not blockers,
        blockers=tuple(blockers),
        active_line_count=active_line_count,
    )


def create_hahitantsoa_event_draft_amendment_request(
    *,
    event_draft: HahitantsoaEventDraft,
    actor: object | None,
    reason: str = "",
    notes: str = "",
) -> HahitantsoaEventDraftAmendmentRequestResult:
    capture_reservation_sensitive_actor_attribution(actor=actor)

    with transaction.atomic():
        locked_event_draft = _get_locked_hahitantsoa_event_draft(event_draft=event_draft)

        if locked_event_draft.is_deleted:
            raise ReservationLifecycleStateError(
                "Hahitantsoa event draft must not be soft-deleted.",
                code="soft_deleted_draft",
            )

        preflight = get_hahitantsoa_event_draft_amendment_preflight(event_draft=locked_event_draft)
        if not preflight.can_amend:
            raise ReservationLifecycleStateError(
                "Hahitantsoa event draft amendment request preflight failed: "
                + ", ".join(preflight.blockers),
                code=preflight.blockers[0] if preflight.blockers else "amendment_not_allowed",
            )

        amendment_request = HahitantsoaEventDraftAmendmentRequest(
            event_draft=locked_event_draft,
            reason=reason,
            notes=notes,
            created_by=actor,
        )
        amendment_request.full_clean()
        amendment_request.save()

        record_audit_event_on_commit(
            actor=actor,
            action="hahitantsoa.event_draft.amendment_request.created",
            target_type="hahitantsoa_event_draft_amendment_request",
            target_id=str(amendment_request.id),
            metadata={
                "event_draft_id": str(locked_event_draft.id),
                "status": amendment_request.status,
            },
        )

        return HahitantsoaEventDraftAmendmentRequestResult(amendment_request=amendment_request)


def _lock_inventory_items_for_active_lines(*, active_lines: tuple) -> tuple[InventoryItem, ...]:
    inventory_item_ids = sorted({line.inventory_item_id for line in active_lines})
    return tuple(
        InventoryItem.objects.select_for_update().filter(id__in=inventory_item_ids).order_by("id")
    )


def _create_confirmation_inventory_blocks(
    *,
    event_draft: HahitantsoaEventDraft,
    active_lines: tuple,
) -> tuple[InventoryAvailability, ...]:
    blocked_periods: list[InventoryAvailability] = []

    for line in active_lines:
        blocked_periods.append(
            InventoryAvailability.objects.create(
                inventory_item=line.inventory_item,
                hahitantsoa_event_draft=event_draft,
                status=InventoryAvailabilityStatus.RESERVED,
                start_at=event_draft.start_at,
                end_at=event_draft.end_at,
                notes=f"Confirmed Hahitantsoa event draft {event_draft.public_reference}.",
            )
        )

    return tuple(blocked_periods)


def _persist_hahitantsoa_event_draft_confirmation(
    *,
    event_draft: HahitantsoaEventDraft,
    actor: object,
) -> HahitantsoaEventDraft:
    attributed_at = timezone.now()
    event_draft.status = "confirmed"
    event_draft.confirmed_at = attributed_at
    event_draft.confirmed_by_id = actor.pk
    event_draft.updated_by = actor
    event_draft.save(
        update_fields=[
            "status",
            "confirmed_at",
            "confirmed_by",
            "updated_by",
            "updated_at",
        ]
    )
    return event_draft


def _schedule_confirmation_success_audit(
    *,
    event_draft: HahitantsoaEventDraft,
    actor: object | None,
    blocked_item_count: int,
) -> None:
    record_audit_event_on_commit(
        actor=actor,
        action="hahitantsoa.event_draft.confirmed",
        target_type="hahitantsoa_event_draft",
        target_id=str(event_draft.id),
        metadata={"blocked_item_count": blocked_item_count},
    )


def get_hahitantsoa_event_draft_confirmation_preflight(
    *,
    event_draft: HahitantsoaEventDraft,
) -> HahitantsoaEventDraftConfirmationPreflight:
    blockers: list[str] = []

    if event_draft.is_deleted:
        _append_blocker(
            blockers=blockers,
            blocker=RESERVATION_CONFIRMATION_BLOCKER_MISSING_REQUIRED_DATA,
        )

    if event_draft.status != "draft":
        _append_blocker(
            blockers=blockers,
            blocker=RESERVATION_CONFIRMATION_BLOCKER_MISSING_REQUIRED_DATA,
        )

    customer = event_draft.customer
    if (not customer.is_active) or customer.is_deleted:
        _append_blocker(
            blockers=blockers,
            blocker=RESERVATION_CONFIRMATION_BLOCKER_MISSING_REQUIRED_DATA,
        )

    active_lines = _active_hahitantsoa_event_draft_lines(event_draft=event_draft)
    if not active_lines:
        _append_blocker(
            blockers=blockers,
            blocker=RESERVATION_CONFIRMATION_BLOCKER_MISSING_REQUIRED_DATA,
        )
        return HahitantsoaEventDraftConfirmationPreflight(
            event_draft_id=str(event_draft.id),
            public_reference=event_draft.public_reference,
            status=event_draft.status,
            can_confirm=not blockers,
            blockers=tuple(blockers),
            active_line_count=0,
            unavailable_line_count=0,
        )

    unavailable_line_count = 0
    for line in active_lines:
        inventory_item = line.inventory_item
        if not inventory_item.is_active or inventory_item.is_deleted:
            unavailable_line_count += 1
            _append_blocker(
                blockers=blockers,
                blocker=RESERVATION_CONFIRMATION_BLOCKER_ACTIVE_AVAILABILITY_CONFLICT,
            )
            continue

        preview = preview_reservation_item_request(
            inventory_item=inventory_item,
            inventory_item_kind=inventory_item.kind,
            start_at=event_draft.start_at,
            end_at=event_draft.end_at,
        )
        if preview.status != "available":
            unavailable_line_count += 1
            _append_blocker(
                blockers=blockers,
                blocker=RESERVATION_CONFIRMATION_BLOCKER_ACTIVE_AVAILABILITY_CONFLICT,
            )

    if not _is_contract_signed(event_draft=event_draft):
        _append_blocker(
            blockers=blockers,
            blocker=RESERVATION_CONFIRMATION_BLOCKER_MISSING_SIGNED_CONTRACT,
        )
        if (
            event_draft.contract_signed_at is not None
            or event_draft.contract_signed_by_id is not None
        ):
            _append_blocker(
                blockers=blockers,
                blocker=RESERVATION_CONFIRMATION_BLOCKER_MISSING_REQUIRED_DATA,
            )

    if not _is_required_deposit_received(event_draft=event_draft):
        _append_blocker(
            blockers=blockers,
            blocker=RESERVATION_CONFIRMATION_BLOCKER_MISSING_REQUIRED_DEPOSIT,
        )
        if (
            event_draft.required_deposit_received_at is not None
            or event_draft.required_deposit_received_by_id is not None
        ):
            _append_blocker(
                blockers=blockers,
                blocker=RESERVATION_CONFIRMATION_BLOCKER_MISSING_REQUIRED_DATA,
            )

    return HahitantsoaEventDraftConfirmationPreflight(
        event_draft_id=str(event_draft.id),
        public_reference=event_draft.public_reference,
        status=event_draft.status,
        can_confirm=not blockers,
        blockers=tuple(blockers),
        active_line_count=len(active_lines),
        unavailable_line_count=unavailable_line_count,
    )


def confirm_hahitantsoa_event_draft(
    *,
    event_draft: HahitantsoaEventDraft,
    actor: object | None,
) -> HahitantsoaEventDraftConfirmationResult:
    capture_reservation_sensitive_actor_attribution(actor=actor)

    with transaction.atomic():
        locked_event_draft = _get_locked_hahitantsoa_event_draft(event_draft=event_draft)
        _assert_active_draft_state(event_draft=locked_event_draft)

        active_lines = _locked_active_hahitantsoa_event_draft_lines(event_draft=locked_event_draft)
        if not active_lines:
            raise ReservationLifecycleStateError(
                "Hahitantsoa event draft must have at least one active line.",
                code="draft_has_no_active_lines",
            )

        _lock_inventory_items_for_active_lines(active_lines=active_lines)

        preflight = get_hahitantsoa_event_draft_confirmation_preflight(
            event_draft=locked_event_draft
        )
        if not preflight.can_confirm:
            raise ReservationConfirmationPreflightError(
                "Hahitantsoa event draft confirmation preflight failed: "
                + ", ".join(preflight.blockers),
                blockers=preflight.blockers,
            )

        blocked_periods = _create_confirmation_inventory_blocks(
            event_draft=locked_event_draft,
            active_lines=active_lines,
        )
        confirmed_event_draft = _persist_hahitantsoa_event_draft_confirmation(
            event_draft=locked_event_draft,
            actor=actor,
        )
        _schedule_confirmation_success_audit(
            event_draft=confirmed_event_draft,
            actor=actor,
            blocked_item_count=len(blocked_periods),
        )

        return HahitantsoaEventDraftConfirmationResult(
            event_draft=confirmed_event_draft,
            blocked_item_count=len(blocked_periods),
        )
