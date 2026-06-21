from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from tests.backend.test_billing_refund_obligation import _partially_paid_invoice

from apps.audit.models import AuditEvent
from apps.billing.services import create_billing_invoice_refund_obligation
from apps.cashbox.models import CashboxMovementDirection
from apps.cashbox.services import (
    CASHBOX_SESSION_ALREADY_CLOSED,
    CASHBOX_SESSION_ALREADY_OPEN,
    CASHBOX_SESSION_IS_CLOSED,
    CashboxLifecycleError,
    close_cashbox_session,
    compute_cashbox_session_net_amount,
    open_cashbox_session,
    record_cashbox_movement,
)
from apps.payments.models import PaymentKind, PaymentMethod, PaymentStatus
from apps.payments.services import create_payment

pytestmark = pytest.mark.django_db


def _actor(username: str):
    return get_user_model().objects.create_user(
        username=username,
        password="test-pass",
        is_staff=True,
    )


def test_open_cashbox_session_creates_one_open_session_per_operator(
    django_capture_on_commit_callbacks,
) -> None:
    actor = _actor("cashbox-open-1")

    with django_capture_on_commit_callbacks(execute=True):
        session = open_cashbox_session(operator=actor, actor=actor, opening_note="Morning opening")

    assert session.operator_id == actor.id
    assert session.closed_at is None
    assert AuditEvent.objects.filter(
        action="cashbox.session_opened",
        target_id=str(session.id),
    ).exists()


def test_open_cashbox_session_rejects_second_open_session_for_same_operator() -> None:
    actor = _actor("cashbox-open-2")
    open_cashbox_session(operator=actor, actor=actor)

    with pytest.raises(CashboxLifecycleError) as error_info:
        open_cashbox_session(operator=actor, actor=actor)

    assert error_info.value.code == CASHBOX_SESSION_ALREADY_OPEN


def test_record_cashbox_movement_keeps_positive_directional_movements(
    django_capture_on_commit_callbacks,
) -> None:
    actor = _actor("cashbox-move-1")
    session = open_cashbox_session(operator=actor, actor=actor)
    with django_capture_on_commit_callbacks(execute=True):
        movement_in = record_cashbox_movement(
            session=session,
            direction=CashboxMovementDirection.CASH_IN,
            amount=Decimal("100.00"),
            actor=actor,
            note="Cash received",
        )
        movement_out = record_cashbox_movement(
            session=session,
            direction=CashboxMovementDirection.CASH_OUT,
            amount=Decimal("40.00"),
            actor=actor,
            note="Cash payout",
        )

    assert movement_in.amount == Decimal("100.00")
    assert movement_out.amount == Decimal("40.00")
    assert compute_cashbox_session_net_amount(session) == Decimal("60.00")
    assert AuditEvent.objects.filter(
        action="cashbox.movement_recorded",
        target_id=str(movement_in.id),
    ).exists()


def test_record_cashbox_movement_can_reference_payment_invoice_or_refund_obligation() -> None:
    actor, reservation_draft, invoice, _ = _partially_paid_invoice(get_user_model())
    session = open_cashbox_session(operator=actor, actor=actor)
    payment = create_payment(
        actor=actor,
        reservation_draft=reservation_draft,
        payment_kind=PaymentKind.OTHER,
        payment_method=PaymentMethod.CASH,
        payment_status=PaymentStatus.PENDING,
        amount=Decimal("100.00"),
        source_label="Cashbox reference",
    )
    obligation = create_billing_invoice_refund_obligation(
        invoice=invoice,
        actor=actor,
        notes="Cashbox refund linkage",
    )

    payment_movement = record_cashbox_movement(
        session=session,
        direction=CashboxMovementDirection.CASH_IN,
        amount=Decimal("100.00"),
        actor=actor,
        payment=payment,
    )
    invoice_movement = record_cashbox_movement(
        session=session,
        direction=CashboxMovementDirection.CASH_IN,
        amount=invoice.amount,
        actor=actor,
        billing_invoice=invoice,
    )
    refund_movement = record_cashbox_movement(
        session=session,
        direction=CashboxMovementDirection.CASH_OUT,
        amount=obligation.refund_amount,
        actor=actor,
        billing_refund_obligation=obligation,
    )

    assert payment_movement.payment_id == payment.id
    assert invoice_movement.billing_invoice_id == invoice.id
    assert refund_movement.billing_refund_obligation_id == obligation.id


def test_record_cashbox_movement_rejects_closed_session() -> None:
    actor = _actor("cashbox-move-closed")
    session = open_cashbox_session(operator=actor, actor=actor)
    close_cashbox_session(session=session, actor=actor, closing_note="End of shift")

    with pytest.raises(CashboxLifecycleError) as error_info:
        record_cashbox_movement(
            session=session,
            direction=CashboxMovementDirection.CASH_IN,
            amount=Decimal("50.00"),
            actor=actor,
        )

    assert error_info.value.code == CASHBOX_SESSION_IS_CLOSED


def test_close_cashbox_session_marks_session_immutable_and_audited(
    django_capture_on_commit_callbacks,
) -> None:
    actor = _actor("cashbox-close-1")
    session = open_cashbox_session(operator=actor, actor=actor)
    record_cashbox_movement(
        session=session,
        direction=CashboxMovementDirection.CASH_IN,
        amount=Decimal("100.00"),
        actor=actor,
    )

    with django_capture_on_commit_callbacks(execute=True):
        result = close_cashbox_session(session=session, actor=actor, closing_note="Closing")

    session.refresh_from_db()
    assert session.closed_at is not None
    assert session.closed_by_id == actor.id
    assert result.net_amount == Decimal("100.00")
    assert AuditEvent.objects.filter(
        action="cashbox.session_closed",
        target_id=str(session.id),
    ).exists()


def test_close_cashbox_session_rejects_second_closure() -> None:
    actor = _actor("cashbox-close-2")
    session = open_cashbox_session(operator=actor, actor=actor)
    close_cashbox_session(session=session, actor=actor)

    with pytest.raises(CashboxLifecycleError) as error_info:
        close_cashbox_session(session=session, actor=actor)

    assert error_info.value.code == CASHBOX_SESSION_ALREADY_CLOSED
