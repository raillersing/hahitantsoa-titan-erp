from datetime import timedelta

import pytest
from django.db import transaction
from django.utils import timezone

from apps.customers.models import Customer
from apps.reservations.confirmation import (
    mark_reservation_draft_contract_signed,
    mark_reservation_draft_required_deposit_received,
)
from apps.reservations.models import ReservationDraft

pytestmark = pytest.mark.django_db


def _period():
    start_at = timezone.now().replace(microsecond=0)
    return start_at, start_at + timedelta(hours=2)


def _customer() -> Customer:
    return Customer.objects.create(display_name="Client Demo")


def _draft() -> ReservationDraft:
    start_at, end_at = _period()
    return ReservationDraft.objects.create(
        customer=_customer(),
        start_at=start_at,
        end_at=end_at,
    )


def _actor(*, django_user_model, username: str = "confirmation-staff", is_staff: bool = True):
    return django_user_model.objects.create_user(
        username=username,
        password="test-password",
        is_staff=is_staff,
    )


def test_mark_contract_signed_persists_timestamp_and_actor(django_user_model) -> None:
    draft = _draft()
    actor = _actor(django_user_model=django_user_model)

    updated_draft = mark_reservation_draft_contract_signed(
        reservation_draft=draft,
        actor=actor,
    )

    draft.refresh_from_db()
    assert updated_draft.id == draft.id
    assert draft.contract_signed_at is not None
    assert draft.contract_signed_by_id == actor.pk


def test_mark_required_deposit_received_persists_timestamp_and_actor(
    django_user_model,
) -> None:
    draft = _draft()
    actor = _actor(django_user_model=django_user_model)

    updated_draft = mark_reservation_draft_required_deposit_received(
        reservation_draft=draft,
        actor=actor,
    )

    draft.refresh_from_db()
    assert updated_draft.id == draft.id
    assert draft.required_deposit_received_at is not None
    assert draft.required_deposit_received_by_id == actor.pk


def test_prerequisite_marker_write_denies_unauthorized_actor() -> None:
    draft = _draft()

    with pytest.raises(PermissionError):
        mark_reservation_draft_contract_signed(
            reservation_draft=draft,
            actor=None,
        )


def test_prerequisite_marker_write_denies_actor_without_persistent_identifier() -> None:
    draft = _draft()

    class StaffLikeActor:
        is_authenticated = True
        is_active = True
        is_staff = True

    with pytest.raises(ValueError):
        mark_reservation_draft_required_deposit_received(
            reservation_draft=draft,
            actor=StaffLikeActor(),
        )


def test_prerequisite_marker_write_refuses_soft_deleted_draft(django_user_model) -> None:
    draft = _draft()
    actor = _actor(django_user_model=django_user_model)
    draft.is_deleted = True
    draft.deleted_at = timezone.now()
    draft.save(update_fields=["is_deleted", "deleted_at"])

    with pytest.raises(ValueError):
        mark_reservation_draft_contract_signed(
            reservation_draft=draft,
            actor=actor,
        )


@pytest.mark.django_db(transaction=True)
def test_prerequisite_marker_write_rolls_back_with_outer_transaction(
    django_user_model,
) -> None:
    draft = _draft()
    actor = _actor(django_user_model=django_user_model)

    with pytest.raises(RuntimeError):
        with transaction.atomic():
            mark_reservation_draft_contract_signed(
                reservation_draft=draft,
                actor=actor,
            )
            raise RuntimeError("rollback")

    draft.refresh_from_db()
    assert draft.contract_signed_at is None
    assert draft.contract_signed_by_id is None
