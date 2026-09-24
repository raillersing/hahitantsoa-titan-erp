from __future__ import annotations

from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.audit.models import AuditEvent
from apps.customers.models import Customer
from apps.documents.services import create_document_instance_from_hahitantsoa_event_draft
from apps.hahitantsoa.models import (
    HahitantsoaEventDraft,
    HahitantsoaEventDraftLine,
    HahitantsoaEventDraftStatus,
)
from apps.hahitantsoa.selectors import list_hahitantsoa_venue_occupancies_for_period
from apps.hahitantsoa.services import (
    _venue_has_confirmed_overlap,
    cancel_hahitantsoa_event,
    confirm_hahitantsoa_event_draft,
    resume_hahitantsoa_event_draft,
)
from apps.inventory.models import InventoryAvailability, InventoryAvailabilityStatus, InventoryItem
from apps.payments.models import Payment
from apps.payments.services import confirm_payment, create_payment
from apps.reservations.confirmation import ReservationLifecycleStateError

pytestmark = pytest.mark.django_db(transaction=True)


def _period(offset_days: int = 2):
    start_at = (timezone.now() + timedelta(days=offset_days)).replace(microsecond=0)
    return start_at, start_at + timedelta(hours=6)


def _customer(name: str = "Hahitantsoa Cancellation Customer") -> Customer:
    return Customer.objects.create(display_name=name)


def _item(*, name: str = "Pack Tables et Chaises", kind: str = "article") -> InventoryItem:
    return InventoryItem.objects.create(name=name, kind=kind, rental_price=50000)


def _actor(*, django_user_model, username: str = "sensitive-staff", is_staff: bool = True):
    return django_user_model.objects.create_user(
        username=username,
        password="test-password",
        is_staff=is_staff,
    )


def _create_confirmable_draft(
    *,
    actor,
    customer=None,
    venue_name: str = "Espace Salohy",
    offset_days: int = 2,
) -> HahitantsoaEventDraft:
    start_at, end_at = _period(offset_days=offset_days)
    draft = HahitantsoaEventDraft.objects.create(
        customer=customer or _customer(),
        event_name="Mariage Princier",
        rental_type="logistics",
        venue_name=venue_name,
        start_at=start_at,
        end_at=end_at,
        created_by=actor,
    )
    HahitantsoaEventDraftLine.objects.create(
        event_draft=draft,
        inventory_item=_item(),
        quantity=2,
        created_by=actor,
    )
    doc = create_document_instance_from_hahitantsoa_event_draft(
        event_draft=draft,
        template_key="hahitantsoa.contract.v1",
        actor=actor,
    )
    from apps.documents.runtime import generate_document_instance_html

    generate_document_instance_html(document_instance=doc, actor=actor)

    payment = create_payment(
        actor=actor,
        hahitantsoa_event_draft=draft,
        payment_kind="deposit",
        payment_method="cash",
        payment_status="pending",
        amount="1000000.00",
        notes="Acompte officiel Hahitantsoa",
    )
    confirm_payment(payment=payment, actor=actor)

    now = timezone.now()
    draft.contract_signed_at = now
    draft.contract_signed_by = actor
    draft.required_deposit_received_at = now
    draft.required_deposit_received_by = actor
    draft.save(
        update_fields=[
            "contract_signed_at",
            "contract_signed_by",
            "required_deposit_received_at",
            "required_deposit_received_by",
        ]
    )
    return draft


def _confirmed_draft(
    *,
    actor,
    customer=None,
    venue_name: str = "Espace Salohy",
    offset_days: int = 2,
) -> HahitantsoaEventDraft:
    draft = _create_confirmable_draft(
        actor=actor,
        customer=customer,
        venue_name=venue_name,
        offset_days=offset_days,
    )
    result = confirm_hahitantsoa_event_draft(event_draft=draft, actor=actor)
    return result.event_draft


# ---------------------------------------------------------------------------
# Test Cases
# ---------------------------------------------------------------------------


def test_cancel_hahitantsoa_event_service_success(django_user_model) -> None:
    actor = _actor(django_user_model=django_user_model)
    draft = _confirmed_draft(actor=actor)

    # Verify inventory availability block was created during confirmation
    blocks = InventoryAvailability.objects.filter(hahitantsoa_event_draft=draft, is_deleted=False)
    assert blocks.count() == 1
    assert blocks.first().status == InventoryAvailabilityStatus.RESERVED

    # Venue is currently occupied
    assert _venue_has_confirmed_overlap(
        venue_key=draft.venue_key,
        start_at=draft.start_at,
        end_at=draft.end_at,
        exclude_id=None,
    )

    reason = (
        "Annulation exceptionnelle pour cas de force majeure : "
        "inondation majeure de la route d'accès."
    )
    cancelled = cancel_hahitantsoa_event(event_draft=draft, actor=actor, reason=reason)

    assert cancelled.status == HahitantsoaEventDraftStatus.CANCELLED
    assert cancelled.cancellation_reason == reason
    assert cancelled.cancelled_at is not None
    assert cancelled.cancelled_by == actor

    # Inventory blocks must be soft-deleted (freed for other events)
    active_blocks = InventoryAvailability.objects.filter(
        hahitantsoa_event_draft=draft, is_deleted=False
    )
    assert active_blocks.count() == 0

    all_blocks = InventoryAvailability.objects.filter(hahitantsoa_event_draft=draft)
    assert all_blocks.count() == 1
    assert all_blocks.first().is_deleted is True

    # Venue is now free
    assert not _venue_has_confirmed_overlap(
        venue_key=draft.venue_key,
        start_at=draft.start_at,
        end_at=draft.end_at,
        exclude_id=None,
    )

    # Strictly NO refund: payment must still exist unchanged
    payments = Payment.objects.filter(hahitantsoa_event_draft=draft)
    assert payments.count() == 1
    assert payments.first().payment_status == "confirmed"

    # Audit event is emitted
    audit = AuditEvent.objects.filter(
        action="hahitantsoa.event_cancelled",
        target_id=str(draft.id),
    ).first()
    assert audit is not None
    assert audit.metadata["cancellation_reason"] == reason
    assert audit.metadata["no_refund_policy_applied"] is True


def test_cancel_hahitantsoa_event_api_success(django_user_model) -> None:
    actor = _actor(django_user_model=django_user_model)
    draft = _confirmed_draft(actor=actor)

    client = APIClient()
    client.force_login(actor)

    url = f"/api/v1/hahitantsoa/event-drafts/{draft.id}/cancel/"
    payload = {
        "reason": (
            "Cas de force majeure avéré : tempête tropicale avec arrêté préfectoral "
            "interdisant tout rassemblement public."
        )
    }
    response = client.post(url, payload, format="json")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "cancelled"
    assert data["cancellation_reason"] == payload["reason"]
    assert data["cancelled_at"] is not None


def test_cancel_hahitantsoa_event_requires_sensitive_permission(django_user_model) -> None:
    sensitive_actor = _actor(django_user_model=django_user_model, username="admin-user")
    draft = _confirmed_draft(actor=sensitive_actor)

    unprivileged_actor = _actor(
        django_user_model=django_user_model,
        username="unprivileged-staff",
        is_staff=False,
    )
    client = APIClient()
    client.force_login(unprivileged_actor)

    url = f"/api/v1/hahitantsoa/event-drafts/{draft.id}/cancel/"
    response = client.post(
        url,
        {"reason": "Annulation motif valide plus de 15 caractères."},
        format="json",
    )
    assert response.status_code == 403


def test_cancel_hahitantsoa_event_requires_detailed_reason(django_user_model) -> None:
    actor = _actor(django_user_model=django_user_model)
    draft = _confirmed_draft(actor=actor)

    client = APIClient()
    client.force_login(actor)

    url = f"/api/v1/hahitantsoa/event-drafts/{draft.id}/cancel/"

    # Empty reason
    response = client.post(url, {"reason": ""}, format="json")
    assert response.status_code == 400

    # Short reason (< 15 characters)
    response = client.post(url, {"reason": "Trop court"}, format="json")
    assert response.status_code == 400

    # Service directly
    with pytest.raises(ReservationLifecycleStateError) as exc_info:
        cancel_hahitantsoa_event(event_draft=draft, actor=actor, reason="Court")
    assert exc_info.value.code == "cancellation_reason_insufficient"


def test_cancel_hahitantsoa_event_fails_if_not_confirmed(django_user_model) -> None:
    actor = _actor(django_user_model=django_user_model)
    draft = _create_confirmable_draft(actor=actor)  # Still in draft status

    with pytest.raises(ReservationLifecycleStateError) as exc_info:
        cancel_hahitantsoa_event(
            event_draft=draft,
            actor=actor,
            reason="Motif valide de plus de 15 caractères.",
        )
    assert exc_info.value.code == "draft_not_confirmed"


def test_cancelled_event_draft_is_immutable(django_user_model) -> None:
    actor = _actor(django_user_model=django_user_model)
    draft = _confirmed_draft(actor=actor)

    cancel_hahitantsoa_event(
        event_draft=draft,
        actor=actor,
        reason="Cas de force majeure officiel dument constaté par huissier.",
    )

    client = APIClient()
    client.force_login(actor)

    url = f"/api/v1/hahitantsoa/event-drafts/{draft.id}/"
    response = client.patch(
        url,
        {"notes": "Tentative de modification d'un événement annulé."},
        format="json",
    )
    assert response.status_code == 400
    assert response.json()["code"] == "cancelled_draft_is_immutable"


def test_confirm_auto_archives_competing_drafts(django_user_model) -> None:
    actor = _actor(django_user_model=django_user_model)
    start_at, end_at = _period(offset_days=5)

    # Draft A: will be confirmed
    draft_a = _create_confirmable_draft(
        actor=actor,
        customer=_customer("Client A"),
        venue_name="Grand Pavillon",
        offset_days=5,
    )

    # Draft B: competing draft on the exact same venue and overlapping period
    draft_b = HahitantsoaEventDraft.objects.create(
        customer=_customer("Client B"),
        event_name="Séminaire B",
        rental_type="bare",
        venue_name="Grand Pavillon",
        start_at=start_at,
        end_at=end_at,
        created_by=actor,
    )
    assert draft_b.status == HahitantsoaEventDraftStatus.DRAFT

    # Confirm draft A
    confirm_hahitantsoa_event_draft(event_draft=draft_a, actor=actor)

    draft_b.refresh_from_db()
    assert draft_b.status == HahitantsoaEventDraftStatus.ARCHIVED
    assert "archivé automatiquement" in draft_b.notes

    # Audit event emitted for auto-archiving
    auto_archive_audit = AuditEvent.objects.filter(
        action="hahitantsoa.event_draft.auto_archived",
        target_id=str(draft_b.id),
    ).first()
    assert auto_archive_audit is not None
    assert auto_archive_audit.metadata["confirmed_event_draft_id"] == str(draft_a.id)


def test_resume_archived_draft_when_slot_freed(django_user_model) -> None:
    actor = _actor(django_user_model=django_user_model)
    start_at, end_at = _period(offset_days=7)

    draft_a = _create_confirmable_draft(
        actor=actor,
        customer=_customer("Client A"),
        venue_name="Salle Royale",
        offset_days=7,
    )
    draft_b = HahitantsoaEventDraft.objects.create(
        customer=_customer("Client B"),
        event_name="Gala B",
        rental_type="bare",
        venue_name="Salle Royale",
        start_at=start_at,
        end_at=end_at,
        created_by=actor,
    )

    confirm_hahitantsoa_event_draft(event_draft=draft_a, actor=actor)
    draft_b.refresh_from_db()
    assert draft_b.status == HahitantsoaEventDraftStatus.ARCHIVED

    # Attempt to resume draft B while draft A is still active -> blocked!
    client = APIClient()
    client.force_login(actor)
    resume_url = f"/api/v1/hahitantsoa/event-drafts/{draft_b.id}/resume/"

    blocked_response = client.post(resume_url, {}, format="json")
    assert blocked_response.status_code == 400
    assert blocked_response.json()["code"] == "venue_has_confirmed_overlap"

    # Now cancel draft A under force majeure
    cancel_hahitantsoa_event(
        event_draft=draft_a,
        actor=actor,
        reason="Annulation pour cas de force majeure : effondrement de toiture dû aux intempéries.",
    )

    # Now resuming draft B must succeed!
    resume_response = client.post(resume_url, {}, format="json")
    assert resume_response.status_code == 200
    assert resume_response.json()["status"] == "draft"

    draft_b.refresh_from_db()
    assert draft_b.status == HahitantsoaEventDraftStatus.DRAFT

    # Audit event recorded for resume
    resume_audit = AuditEvent.objects.filter(
        action="hahitantsoa.event_draft.resumed",
        target_id=str(draft_b.id),
    ).first()
    assert resume_audit is not None


def test_resume_archived_draft_after_date_change(django_user_model) -> None:
    actor = _actor(django_user_model=django_user_model)

    draft_a = _create_confirmable_draft(
        actor=actor,
        customer=_customer("Client A"),
        venue_name="Espace Salohy",
        offset_days=10,
    )
    start_at_b, end_at_b = _period(offset_days=10)
    draft_b = HahitantsoaEventDraft.objects.create(
        customer=_customer("Client B"),
        event_name="Mariage Reporté",
        rental_type="bare",
        venue_name="Espace Salohy",
        start_at=start_at_b,
        end_at=end_at_b,
        created_by=actor,
    )

    confirm_hahitantsoa_event_draft(event_draft=draft_a, actor=actor)
    draft_b.refresh_from_db()
    assert draft_b.status == HahitantsoaEventDraftStatus.ARCHIVED

    # Operator changes draft B dates to next month (offset 30 days)
    new_start, new_end = _period(offset_days=30)
    draft_b.start_at = new_start
    draft_b.end_at = new_end
    draft_b.save(update_fields=["start_at", "end_at"])

    # Resume draft B directly via service
    resumed = resume_hahitantsoa_event_draft(event_draft=draft_b, actor=actor)
    assert resumed.status == HahitantsoaEventDraftStatus.DRAFT


def test_venue_occupancy_excludes_cancelled_and_archived_drafts(django_user_model) -> None:
    actor = _actor(django_user_model=django_user_model)
    start_at, end_at = _period(offset_days=15)

    confirmed_draft = _confirmed_draft(
        actor=actor,
        venue_name="Jardin Fleuri",
        offset_days=15,
    )
    archived_draft = HahitantsoaEventDraft.objects.create(
        customer=_customer("Client Arch"),
        event_name="Evenement Archivé",
        rental_type="bare",
        venue_name="Jardin Fleuri",
        status=HahitantsoaEventDraftStatus.ARCHIVED,
        start_at=start_at,
        end_at=end_at,
        created_by=actor,
    )
    cancelled_draft = HahitantsoaEventDraft.objects.create(
        customer=_customer("Client Canc"),
        event_name="Evenement Annulé",
        rental_type="bare",
        venue_name="Jardin Fleuri",
        status=HahitantsoaEventDraftStatus.CANCELLED,
        start_at=start_at,
        end_at=end_at,
        created_by=actor,
    )

    occupancies = list_hahitantsoa_venue_occupancies_for_period(
        start_at=start_at - timedelta(hours=1),
        end_at=end_at + timedelta(hours=1),
        venue_key=confirmed_draft.venue_key,
    )
    occupancy_ids = [str(o.id) for o in occupancies]

    assert str(confirmed_draft.id) in occupancy_ids
    assert str(archived_draft.id) not in occupancy_ids
    assert str(cancelled_draft.id) not in occupancy_ids
