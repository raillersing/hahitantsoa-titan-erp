from datetime import timedelta

import pytest
from django.contrib.auth.models import Group
from django.urls import reverse
from django.utils import timezone

from apps.audit.models import AuditEvent
from apps.customers.models import Customer
from apps.identity.roles import IdentityRole
from apps.inventory.models import InventoryAvailability, InventoryItem
from apps.reservations.confirmation import (
    RESERVATION_CONFIRMATION_BLOCKER_MISSING_REQUIRED_DEPOSIT,
    RESERVATION_CONFIRMATION_BLOCKER_MISSING_SIGNED_CONTRACT,
    mark_reservation_draft_contract_signed,
    mark_reservation_draft_required_deposit_received,
)
from apps.reservations.models import ReservationDraft, ReservationDraftLine, ReservationDraftStatus

pytestmark = pytest.mark.django_db


def _period():
    start_at = timezone.now().replace(microsecond=0)
    return start_at, start_at + timedelta(hours=2)


def _customer() -> Customer:
    return Customer.objects.create(display_name="Client Demo")


def _item(name: str = "Projecteur LED", kind: str = "article") -> InventoryItem:
    return InventoryItem.objects.create(name=name, kind=kind)


def _draft() -> ReservationDraft:
    start_at, end_at = _period()
    return ReservationDraft.objects.create(
        customer=_customer(),
        start_at=start_at,
        end_at=end_at,
    )


def _line(
    *,
    reservation_draft: ReservationDraft,
    inventory_item: InventoryItem,
) -> ReservationDraftLine:
    return ReservationDraftLine.objects.create(
        reservation_draft=reservation_draft,
        inventory_item=inventory_item,
        quantity=1,
    )


def _actor(*, django_user_model, username: str = "confirmation-staff", is_staff: bool = True):
    return django_user_model.objects.create_user(
        username=username,
        password="test-password",
        is_staff=is_staff,
    )


def _prepare_confirmable_draft(*, django_user_model, staff_user):
    draft = _draft()
    item = _item()
    _line(reservation_draft=draft, inventory_item=item)
    mark_reservation_draft_contract_signed(reservation_draft=draft, actor=staff_user)
    mark_reservation_draft_required_deposit_received(
        reservation_draft=draft,
        actor=staff_user,
    )
    draft.refresh_from_db()
    return draft


def _confirm_url(*, draft: ReservationDraft) -> str:
    return reverse("reservation-draft-confirm", kwargs={"pk": draft.id})


def test_confirm_draft_success_by_staff(client, django_user_model) -> None:
    staff = _actor(django_user_model=django_user_model, is_staff=True)
    draft = _prepare_confirmable_draft(django_user_model=django_user_model, staff_user=staff)

    client.force_login(staff)
    response = client.post(_confirm_url(draft=draft))

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "confirmed"
    assert payload["public_reference"] == draft.public_reference
    assert payload["blocked_item_count"] == 1
    assert payload["reservation_draft"]["status"] == "confirmed"
    assert payload["reservation_draft"]["id"] == str(draft.id)
    assert payload["reservation_draft"]["public_reference"] == draft.public_reference

    draft.refresh_from_db()
    assert draft.status == ReservationDraftStatus.CONFIRMED
    assert draft.confirmed_by_id == staff.id
    assert InventoryAvailability.objects.filter(reservation_draft=draft).count() == 1


def test_confirm_draft_success_by_group_mapped_non_staff_user(client, django_user_model) -> None:
    staff = _actor(django_user_model=django_user_model, username="prep-staff", is_staff=True)
    operator = _actor(
        django_user_model=django_user_model,
        username="group-operator",
        is_staff=False,
    )
    operator.groups.add(
        Group.objects.create(name=IdentityRole.RESERVATION_SENSITIVE_OPERATOR.value)
    )
    draft = _prepare_confirmable_draft(django_user_model=django_user_model, staff_user=staff)

    client.force_login(operator)
    response = client.post(_confirm_url(draft=draft))

    assert response.status_code == 200
    draft.refresh_from_db()
    assert draft.status == ReservationDraftStatus.CONFIRMED
    assert draft.confirmed_by_id == operator.id


def test_confirm_draft_rejects_non_staff_authenticated_user(client, django_user_model) -> None:
    staff = _actor(django_user_model=django_user_model, username="staff-u", is_staff=True)
    non_staff = _actor(django_user_model=django_user_model, username="normal-u", is_staff=False)
    draft = _prepare_confirmable_draft(django_user_model=django_user_model, staff_user=staff)

    client.force_login(non_staff)
    response = client.post(_confirm_url(draft=draft))

    assert response.status_code == 403
    assert response.json()["detail"] == (
        "Actor is not allowed to perform a reservation-sensitive write."
    )
    draft.refresh_from_db()
    assert draft.status == ReservationDraftStatus.DRAFT


def test_confirm_draft_rejects_unauthenticated_user(client, django_user_model) -> None:
    staff = _actor(django_user_model=django_user_model, is_staff=True)
    draft = _prepare_confirmable_draft(django_user_model=django_user_model, staff_user=staff)

    response = client.post(_confirm_url(draft=draft))

    assert response.status_code in {401, 403}
    draft.refresh_from_db()
    assert draft.status == ReservationDraftStatus.DRAFT


def test_confirm_draft_returns_404_for_missing_or_soft_deleted_draft(
    client,
    django_user_model,
) -> None:
    import uuid

    staff = _actor(django_user_model=django_user_model, is_staff=True)
    client.force_login(staff)

    response = client.post(reverse("reservation-draft-confirm", kwargs={"pk": uuid.uuid4()}))
    assert response.status_code == 404

    draft = _prepare_confirmable_draft(django_user_model=django_user_model, staff_user=staff)
    draft.is_deleted = True
    draft.deleted_at = timezone.now()
    draft.save()

    response = client.post(_confirm_url(draft=draft))
    assert response.status_code == 404


def test_confirm_draft_returns_400_with_blockers_on_preflight_failure(
    client,
    django_user_model,
) -> None:
    staff = _actor(django_user_model=django_user_model, is_staff=True)
    client.force_login(staff)

    draft = _draft()
    item = _item()
    _line(reservation_draft=draft, inventory_item=item)

    response = client.post(_confirm_url(draft=draft))

    assert response.status_code == 400
    payload = response.json()
    assert payload["code"] == "confirmation_preflight_failed"
    assert "blockers" in payload
    assert RESERVATION_CONFIRMATION_BLOCKER_MISSING_SIGNED_CONTRACT in payload["blockers"]
    assert RESERVATION_CONFIRMATION_BLOCKER_MISSING_REQUIRED_DEPOSIT in payload["blockers"]

    draft.refresh_from_db()
    assert draft.status == ReservationDraftStatus.DRAFT


def test_confirm_draft_rollback_on_failure(client, django_user_model) -> None:
    staff = _actor(django_user_model=django_user_model, is_staff=True)
    client.force_login(staff)

    draft = _draft()
    item = _item()
    _line(reservation_draft=draft, inventory_item=item)

    initial_availabilities_count = InventoryAvailability.objects.count()
    initial_audit_count = AuditEvent.objects.count()

    response = client.post(_confirm_url(draft=draft))

    assert response.status_code == 400
    assert InventoryAvailability.objects.count() == initial_availabilities_count
    assert AuditEvent.objects.count() == initial_audit_count

    draft.refresh_from_db()
    assert draft.status == ReservationDraftStatus.DRAFT
