from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Case, DecimalField, F, Sum, Value, When
from django.utils import timezone

from apps.audit.services import record_audit_event_on_commit

from .models import CashboxMovement, CashboxMovementDirection, CashboxSession

CASHBOX_SESSION_ALREADY_OPEN = "cashbox_session_already_open"
CASHBOX_SESSION_ALREADY_CLOSED = "cashbox_session_already_closed"
CASHBOX_SESSION_IS_CLOSED = "cashbox_session_is_closed"


class CashboxLifecycleError(ValueError):
    def __init__(self, message: str, *, code: str) -> None:
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class CashboxSessionCloseResult:
    session: CashboxSession
    net_amount: Decimal


def active_cashbox_sessions():
    return (
        CashboxSession.objects.select_related("operator", "opened_by", "closed_by")
        .prefetch_related("movements")
        .order_by("-opened_at", "-created_at", "id")
    )


def active_cashbox_movements():
    return (
        CashboxMovement.objects.select_related(
            "session",
            "session__operator",
            "payment",
            "billing_invoice",
            "billing_refund_obligation",
            "moved_by",
        ).order_by("-moved_at", "-created_at", "id")
    )


def compute_cashbox_session_net_amount(session: CashboxSession) -> Decimal:
    total = session.movements.aggregate(
        net=Sum(
            Case(
                When(direction=CashboxMovementDirection.CASH_IN, then=F("amount")),
                When(
                    direction=CashboxMovementDirection.CASH_OUT,
                    then=F("amount") * Value(-1),
                ),
                default=Value(0),
                output_field=DecimalField(max_digits=12, decimal_places=2),
            )
        )
    )["net"]
    return total or Decimal("0.00")


@transaction.atomic
def open_cashbox_session(
    *,
    operator,
    actor: object | None = None,
    opening_note: str = "",
) -> CashboxSession:
    user_model = get_user_model()
    locked_operator = user_model.objects.select_for_update().get(pk=operator.pk)
    existing_open_session = (
        CashboxSession.objects.select_for_update()
        .filter(operator=locked_operator, closed_at__isnull=True)
        .first()
    )
    if existing_open_session is not None:
        raise CashboxLifecycleError(
            "This operator already has an open cashbox session.",
            code=CASHBOX_SESSION_ALREADY_OPEN,
        )

    actor_id = getattr(actor, "pk", None)
    session = CashboxSession(
        operator=locked_operator,
        opened_at=timezone.now(),
        opened_by_id=actor_id,
        opening_note=opening_note,
        created_by_id=actor_id,
        updated_by_id=actor_id,
    )
    session.full_clean()
    session.save()
    record_audit_event_on_commit(
        actor=actor,
        action="cashbox.session_opened",
        target_type="cashbox_session",
        target_id=str(session.id),
        metadata={"operator_id": str(locked_operator.pk)},
    )
    return session


@transaction.atomic
def close_cashbox_session(
    *,
    session: CashboxSession,
    actor: object | None = None,
    closing_note: str = "",
) -> CashboxSessionCloseResult:
    locked_session = CashboxSession.objects.select_for_update().get(pk=session.pk)
    if locked_session.closed_at is not None:
        raise CashboxLifecycleError(
            "This cashbox session is already closed.",
            code=CASHBOX_SESSION_ALREADY_CLOSED,
        )

    actor_id = getattr(actor, "pk", None)
    locked_session.closed_at = timezone.now()
    locked_session.closed_by_id = actor_id
    locked_session.closing_note = closing_note
    locked_session.updated_by_id = actor_id
    locked_session.full_clean()
    locked_session.save()
    net_amount = compute_cashbox_session_net_amount(locked_session)

    record_audit_event_on_commit(
        actor=actor,
        action="cashbox.session_closed",
        target_type="cashbox_session",
        target_id=str(locked_session.id),
        metadata={"net_amount": str(net_amount)},
    )
    return CashboxSessionCloseResult(session=locked_session, net_amount=net_amount)


@transaction.atomic
def record_cashbox_movement(
    *,
    session: CashboxSession,
    direction: str,
    amount: Decimal,
    actor: object | None = None,
    payment=None,
    billing_invoice=None,
    billing_refund_obligation=None,
    note: str = "",
) -> CashboxMovement:
    locked_session = CashboxSession.objects.select_for_update().get(pk=session.pk)
    if locked_session.closed_at is not None:
        raise CashboxLifecycleError(
            "Closed cashbox sessions are immutable.",
            code=CASHBOX_SESSION_IS_CLOSED,
        )

    actor_id = getattr(actor, "pk", None)
    movement = CashboxMovement(
        session=locked_session,
        direction=direction,
        amount=amount,
        payment=payment,
        billing_invoice=billing_invoice,
        billing_refund_obligation=billing_refund_obligation,
        moved_at=timezone.now(),
        moved_by_id=actor_id,
        note=note,
        created_by_id=actor_id,
        updated_by_id=actor_id,
    )
    movement.full_clean()
    movement.save()
    record_audit_event_on_commit(
        actor=actor,
        action="cashbox.movement_recorded",
        target_type="cashbox_movement",
        target_id=str(movement.id),
        metadata={
            "session_id": str(locked_session.id),
            "direction": movement.direction,
            "amount": str(movement.amount),
            "payment_id": str(movement.payment_id) if movement.payment_id else None,
            "billing_invoice_id": (
                str(movement.billing_invoice_id) if movement.billing_invoice_id else None
            ),
            "billing_refund_obligation_id": (
                str(movement.billing_refund_obligation_id)
                if movement.billing_refund_obligation_id
                else None
            ),
        },
    )
    return movement
