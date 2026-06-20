from dataclasses import fields, is_dataclass
from datetime import timedelta

import pytest
from django.utils import timezone

from apps.audit.models import AuditEvent
from apps.customers.models import Customer
from apps.documents.services import create_document_instance_from_hahitantsoa_event_draft
from apps.hahitantsoa.models import HahitantsoaEventDraft, HahitantsoaEventDraftLine
from apps.hahitantsoa.services import (
    HahitantsoaEventDraftConfirmationResult,
    confirm_hahitantsoa_event_draft,
)
from apps.inventory.availability import is_inventory_item_available
from apps.inventory.models import InventoryAvailability, InventoryAvailabilityStatus, InventoryItem
from apps.payments.services import confirm_payment, create_payment
from apps.reservations.confirmation import (
    ReservationConfirmationPreflightError,
    ReservationLifecycleStateError,
)

pytestmark = pytest.mark.django_db


def _period():
    start_at = timezone.now().replace(microsecond=0)
    return start_at, start_at + timedelta(hours=4)


def _customer() -> Customer:
    return Customer.objects.create(display_name="Hahitantsoa Confirm Customer")


def _item(*, name: str = "Shared article", kind: str = "article") -> InventoryItem:
    return InventoryItem.objects.create(name=name, kind=kind)


def _actor(*, django_user_model, username: str = "hahitantsoa-staff"):
    return django_user_model.objects.create_user(
        username=username,
        password="test-password",
        is_staff=True,
    )


def _confirmable_draft(*, actor) -> HahitantsoaEventDraft:
    start_at, end_at = _period()
    draft = HahitantsoaEventDraft.objects.create(
        customer=_customer(),
        event_name="Confirmable event",
        start_at=start_at,
        end_at=end_at,
        created_by=actor,
    )
    HahitantsoaEventDraftLine.objects.create(
        event_draft=draft,
        inventory_item=_item(),
        quantity=1,
        created_by=actor,
    )
    _create_confirmation_truth(event_draft=draft, actor=actor)
    return draft


def _create_confirmation_truth(*, event_draft: HahitantsoaEventDraft, actor) -> None:
    instance = create_document_instance_from_hahitantsoa_event_draft(
        event_draft=event_draft,
        template_key="hahitantsoa.contract.v1",
        actor=actor,
    )
    from apps.documents.runtime import generate_document_instance_html

    generate_document_instance_html(document_instance=instance, actor=actor)
    payment = create_payment(
        actor=actor,
        hahitantsoa_event_draft=event_draft,
        payment_kind="deposit",
        payment_method="cash",
        payment_status="pending",
        amount="150000.00",
        notes="Required event deposit",
    )
    confirm_payment(payment=payment, actor=actor)


def test_hahitantsoa_confirmation_result_dataclass_shape() -> None:
    assert is_dataclass(HahitantsoaEventDraftConfirmationResult)
    assert HahitantsoaEventDraftConfirmationResult.__dataclass_params__.frozen is True
    assert tuple(field.name for field in fields(HahitantsoaEventDraftConfirmationResult)) == (
        "event_draft",
        "blocked_item_count",
    )


def test_hahitantsoa_confirmation_succeeds_persists_state_blocks_and_audit(
    django_user_model, django_capture_on_commit_callbacks
) -> None:
    actor = _actor(django_user_model=django_user_model)
    draft = _confirmable_draft(actor=actor)
    line = draft.lines.select_related("inventory_item").get()

    with django_capture_on_commit_callbacks(execute=True):
        result = confirm_hahitantsoa_event_draft(event_draft=draft, actor=actor)

    draft.refresh_from_db()
    assert result == HahitantsoaEventDraftConfirmationResult(
        event_draft=draft,
        blocked_item_count=1,
    )
    assert draft.status == "confirmed"
    assert draft.confirmed_at is not None
    assert draft.confirmed_by_id == actor.pk
    assert draft.updated_by == actor

    blocked_period = InventoryAvailability.objects.get(hahitantsoa_event_draft=draft)
    assert blocked_period.status == InventoryAvailabilityStatus.RESERVED
    assert blocked_period.reservation_draft_id is None
    assert blocked_period.is_deleted is False
    assert (
        is_inventory_item_available(
            inventory_item=line.inventory_item,
            start_at=draft.start_at,
            end_at=draft.end_at,
        )
        is False
    )

    audit_event = AuditEvent.objects.filter(action="hahitantsoa.event_draft.confirmed").get()
    assert audit_event.target_id == str(draft.id)
    assert audit_event.metadata["blocked_item_count"] == 1


def test_hahitantsoa_confirmation_refuses_when_preflight_fails(django_user_model) -> None:
    actor = _actor(django_user_model=django_user_model)
    draft = _confirmable_draft(actor=actor)
    draft.payments.all().delete()

    with pytest.raises(ReservationConfirmationPreflightError) as error_info:
        confirm_hahitantsoa_event_draft(event_draft=draft, actor=actor)

    assert error_info.value.blockers == ("missing_required_deposit",)


def test_hahitantsoa_confirmation_refuses_when_availability_conflicts(django_user_model) -> None:
    actor = _actor(django_user_model=django_user_model)
    draft = _confirmable_draft(actor=actor)
    line = draft.lines.select_related("inventory_item").get()
    InventoryAvailability.objects.create(
        inventory_item=line.inventory_item,
        status=InventoryAvailabilityStatus.BLOCKED,
        start_at=draft.start_at,
        end_at=draft.end_at,
        notes="Conflict",
    )

    with pytest.raises(ReservationConfirmationPreflightError) as error_info:
        confirm_hahitantsoa_event_draft(event_draft=draft, actor=actor)

    assert error_info.value.blockers == ("active_availability_conflict",)


def test_hahitantsoa_confirmation_refuses_without_active_lines(django_user_model) -> None:
    actor = _actor(django_user_model=django_user_model)
    start_at, end_at = _period()
    draft = HahitantsoaEventDraft.objects.create(
        customer=_customer(),
        event_name="No lines event",
        start_at=start_at,
        end_at=end_at,
        created_by=actor,
    )
    _create_confirmation_truth(event_draft=draft, actor=actor)

    with pytest.raises(ReservationLifecycleStateError) as error_info:
        confirm_hahitantsoa_event_draft(event_draft=draft, actor=actor)

    assert error_info.value.code == "draft_has_no_active_lines"


def test_hahitantsoa_confirmation_allows_truth_without_markers(django_user_model) -> None:
    actor = _actor(django_user_model=django_user_model, username="truth-without-markers")
    draft = _confirmable_draft(actor=actor)

    draft.contract_signed_at = None
    draft.contract_signed_by = None
    draft.required_deposit_received_at = None
    draft.required_deposit_received_by = None
    draft.save(
        update_fields=[
            "contract_signed_at",
            "contract_signed_by",
            "required_deposit_received_at",
            "required_deposit_received_by",
        ]
    )

    result = confirm_hahitantsoa_event_draft(event_draft=draft, actor=actor)

    assert result.blocked_item_count == 1


def test_hahitantsoa_confirmation_rejects_marker_only_without_truth(django_user_model) -> None:
    actor = _actor(django_user_model=django_user_model, username="marker-only")
    start_at, end_at = _period()
    draft = HahitantsoaEventDraft.objects.create(
        customer=_customer(),
        event_name="Marker only event",
        start_at=start_at,
        end_at=end_at,
        contract_signed_at=timezone.now(),
        contract_signed_by=actor,
        required_deposit_received_at=timezone.now(),
        required_deposit_received_by=actor,
        created_by=actor,
    )
    HahitantsoaEventDraftLine.objects.create(
        event_draft=draft,
        inventory_item=_item(name="Marker only item"),
        quantity=1,
        created_by=actor,
    )

    with pytest.raises(ReservationConfirmationPreflightError) as error_info:
        confirm_hahitantsoa_event_draft(event_draft=draft, actor=actor)

    assert error_info.value.blockers == (
        "missing_signed_contract",
        "missing_required_data",
        "missing_required_deposit",
    )


@pytest.mark.django_db(transaction=True)
def test_hahitantsoa_confirmation_rolls_back_blocks_when_state_persist_fails(
    django_user_model, monkeypatch: pytest.MonkeyPatch
) -> None:
    from apps.hahitantsoa import services as hahitantsoa_services

    actor = _actor(django_user_model=django_user_model)
    draft = _confirmable_draft(actor=actor)
    audit_count_before = AuditEvent.objects.count()

    def raise_after_blocking(**kwargs):
        raise RuntimeError("boom after blocking")

    monkeypatch.setattr(
        hahitantsoa_services,
        "_persist_hahitantsoa_event_draft_confirmation",
        raise_after_blocking,
    )

    with pytest.raises(RuntimeError):
        confirm_hahitantsoa_event_draft(event_draft=draft, actor=actor)

    draft.refresh_from_db()
    assert draft.status == "draft"
    assert draft.confirmed_at is None
    assert draft.confirmed_by_id is None
    assert InventoryAvailability.objects.filter(hahitantsoa_event_draft=draft).count() == 0
    assert AuditEvent.objects.count() == audit_count_before
