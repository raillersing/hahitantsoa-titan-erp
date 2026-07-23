from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Case, DecimalField, F, Sum, Value, When
from django.utils import timezone

from apps.audit.services import record_audit_event_on_commit
from apps.finance.models import FinanceAccountKind, FinanceCurrency
from apps.identity.authorization import require_cashbox_supervisor_actor
from apps.payments.models import CONFIRMED_PAYMENT_STATUS_VALUES, PaymentMethod

from .models import (
    CashboxClosureAttempt,
    CashboxClosureValidation,
    CashboxMovement,
    CashboxMovementDirection,
    CashboxReopenEvent,
    CashboxSession,
    is_legacy_cashbox_session,
)

CASHBOX_SESSION_ALREADY_OPEN = "cashbox_session_already_open"
CASHBOX_SESSION_ALREADY_CLOSED = "cashbox_session_already_closed"
CASHBOX_SESSION_IS_CLOSED = "cashbox_session_is_closed"
CASHBOX_MOVEMENT_PAYMENT_AMOUNT_MISMATCH = "cashbox_movement_payment_amount_mismatch"
CASHBOX_MOVEMENT_INVOICE_AMOUNT_MISMATCH = "cashbox_movement_invoice_amount_mismatch"
CASHBOX_MOVEMENT_REFUND_AMOUNT_MISMATCH = "cashbox_movement_refund_amount_mismatch"
CASHBOX_MOVEMENT_PAYMENT_NOT_CONFIRMED_CASH = "cashbox_movement_payment_not_confirmed_cash"
CASHBOX_SESSION_NOT_OPEN = "cashbox_session_not_open"
CASHBOX_REOPEN_REASON_REQUIRED = "cashbox_reopen_reason_required"
CASHBOX_SESSION_NOT_VALIDATED_CLOSED = "cashbox_session_not_validated_closed"
CASHBOX_SESSION_LEGACY_ACCOUNT_UNASSIGNED = "cashbox_session_legacy_account_unassigned"


class CashboxLifecycleError(ValueError):
    def __init__(self, message: str, *, code: str) -> None:
        super().__init__(message)
        self.code = code


def _require_current_cashbox_session(session: CashboxSession) -> None:
    if is_legacy_cashbox_session(session):
        raise CashboxLifecycleError(
            "Legacy cashbox sessions without a physical cash account are read-only.",
            code=CASHBOX_SESSION_LEGACY_ACCOUNT_UNASSIGNED,
        )


@dataclass(frozen=True)
class CashboxSessionCloseResult:
    session: CashboxSession
    net_amount: Decimal


def active_cashbox_sessions():
    return (
        CashboxSession.objects.select_related("operator", "opened_by", "closed_by", "cash_account")
        .prefetch_related("movements", "closure_attempts", "reopen_events")
        .order_by("-opened_at", "-created_at", "id")
    )


def active_cashbox_movements():
    return CashboxMovement.objects.select_related(
        "session",
        "session__operator",
        "payment",
        "billing_invoice",
        "billing_refund_obligation",
        "moved_by",
    ).order_by("-moved_at", "-created_at", "id")


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


def compute_cashbox_session_theoretical_amount(session: CashboxSession) -> Decimal:
    return session.opening_amount + compute_cashbox_session_net_amount(session)


@transaction.atomic
def open_cashbox_session(
    *,
    operator,
    cash_account,
    opening_amount: Decimal,
    actor: object | None = None,
    opening_note: str = "",
) -> CashboxSession:
    user_model = get_user_model()
    locked_operator = user_model.objects.select_for_update().get(pk=operator.pk)
    locked_cash_account = cash_account.__class__.objects.select_for_update().get(pk=cash_account.pk)
    if (
        locked_cash_account.kind != FinanceAccountKind.CASH
        or locked_cash_account.currency != FinanceCurrency.MGA
    ):
        raise CashboxLifecycleError(
            "Cashbox sessions require an MGA cash finance account.",
            code="cashbox_session_requires_cash_account",
        )
    existing_open_session = (
        CashboxSession.objects.select_for_update()
        .filter(
            operator=locked_operator,
            cash_account=locked_cash_account,
            closed_at__isnull=True,
        )
        .first()
    )
    if existing_open_session is not None:
        raise CashboxLifecycleError(
            "This operator already has an open cashbox session.",
            code=CASHBOX_SESSION_ALREADY_OPEN,
        )

    actor_id = getattr(actor, "pk", None)
    session = CashboxSession(
        cash_account=locked_cash_account,
        operator=locked_operator,
        opening_amount=opening_amount,
        status="open",
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
        metadata={
            "operator_id": str(locked_operator.pk),
            "cash_account_id": str(locked_cash_account.pk),
            "opening_amount": str(session.opening_amount),
        },
    )
    return session


@transaction.atomic
def close_cashbox_session(
    *,
    session: CashboxSession,
    actor: object | None = None,
    closing_note: str = "",
) -> CashboxSessionCloseResult:
    raise CashboxLifecycleError(
        "Direct cashbox closure is forbidden; submit a count and validate it with a supervisor.",
        code=CASHBOX_SESSION_NOT_OPEN,
    )


@transaction.atomic
def submit_cashbox_count(
    *,
    session: CashboxSession,
    actor,
    actual_amount: Decimal,
    variance_justification: str = "",
    idempotency_key: str,
) -> CashboxClosureAttempt:
    locked_session = CashboxSession.objects.select_for_update().get(pk=session.pk)
    _require_current_cashbox_session(locked_session)
    if not (idempotency_key or "").strip():
        raise CashboxLifecycleError(
            "Cashbox count submission requires an idempotency key.",
            code="cashbox_submission_idempotency_key_required",
        )
    existing = CashboxClosureAttempt.objects.filter(
        session=locked_session,
        submission_idempotency_key=idempotency_key,
    ).first()
    if existing is not None:
        return existing
    if locked_session.status != "open":
        raise CashboxLifecycleError(
            "Cashbox sessions must be open before a count can be submitted.",
            code=CASHBOX_SESSION_NOT_OPEN,
        )
    theoretical_amount = compute_cashbox_session_theoretical_amount(locked_session)
    variance_amount = actual_amount - theoretical_amount
    closure = CashboxClosureAttempt(
        session=locked_session,
        theoretical_amount=theoretical_amount,
        actual_amount=actual_amount,
        variance_amount=variance_amount,
        variance_justification=variance_justification,
        submitted_at=timezone.now(),
        submitted_by=actor,
        submission_idempotency_key=idempotency_key,
    )
    closure.full_clean()
    closure.save()
    locked_session.status = "count_submitted"
    locked_session.updated_by = actor
    locked_session.save(update_fields=["status", "updated_by", "updated_at"])
    record_audit_event_on_commit(
        actor=actor,
        action="cashbox.count_submitted",
        target_type="cashbox_closure_attempt",
        target_id=str(closure.id),
        metadata={
            "session_id": str(locked_session.id),
            "theoretical_amount": str(theoretical_amount),
            "actual_amount": str(actual_amount),
            "variance_amount": str(variance_amount),
        },
    )
    return closure


@transaction.atomic
def validate_cashbox_count(
    *,
    closure: CashboxClosureAttempt,
    actor,
    idempotency_key: str,
) -> CashboxClosureAttempt:
    require_cashbox_supervisor_actor(actor=actor)
    if not (idempotency_key or "").strip():
        raise CashboxLifecycleError(
            "Cashbox count validation requires an idempotency key.",
            code="cashbox_validation_idempotency_key_required",
        )
    locked_closure = CashboxClosureAttempt.objects.select_for_update().get(pk=closure.pk)
    locked_session = CashboxSession.objects.select_for_update().get(pk=locked_closure.session_id)
    _require_current_cashbox_session(locked_session)
    existing_validation = (
        CashboxClosureValidation.objects.select_for_update()
        .filter(closure_attempt=locked_closure)
        .first()
    )
    if existing_validation is not None:
        if existing_validation.idempotency_key == idempotency_key:
            return locked_closure
        raise CashboxLifecycleError(
            "This cashbox count has already been validated.",
            code=CASHBOX_SESSION_ALREADY_CLOSED,
        )
    if locked_session.status != "count_submitted":
        raise CashboxLifecycleError(
            "Only a submitted cashbox count can be validated.",
            code=CASHBOX_SESSION_NOT_OPEN,
        )
    now = timezone.now()
    validation = CashboxClosureValidation(
        closure_attempt=locked_closure,
        validated_at=now,
        validated_by=actor,
        idempotency_key=idempotency_key,
    )
    validation.full_clean()
    validation.save()
    locked_session.status = "validated_closed"
    locked_session.closed_at = now
    locked_session.closed_by = actor
    locked_session.updated_by = actor
    locked_session.save(
        update_fields=["status", "closed_at", "closed_by", "updated_by", "updated_at"]
    )
    record_audit_event_on_commit(
        actor=actor,
        action="cashbox.count_validated_closed",
        target_type="cashbox_closure_validation",
        target_id=str(validation.id),
        metadata={"session_id": str(locked_session.id)},
    )
    return locked_closure


@transaction.atomic
def reopen_cashbox_session(
    *,
    session: CashboxSession,
    actor,
    reason: str,
    idempotency_key: str,
) -> CashboxSession:
    """Reopen only a supervisor-validated close, retaining immutable proof."""

    require_cashbox_supervisor_actor(actor=actor)
    if not (reason or "").strip():
        raise CashboxLifecycleError(
            "Cashbox reopening requires a reason.",
            code=CASHBOX_REOPEN_REASON_REQUIRED,
        )
    if not (idempotency_key or "").strip():
        raise CashboxLifecycleError(
            "Cashbox reopening requires an idempotency key.",
            code="cashbox_reopen_idempotency_key_required",
        )

    locked_session = CashboxSession.objects.select_for_update().get(pk=session.pk)
    _require_current_cashbox_session(locked_session)
    existing = (
        CashboxReopenEvent.objects.select_for_update()
        .filter(session=locked_session, idempotency_key=idempotency_key)
        .first()
    )
    if existing is not None:
        return locked_session
    if locked_session.status != "validated_closed":
        raise CashboxLifecycleError(
            "Only a supervisor-validated closed cashbox session can be reopened.",
            code=CASHBOX_SESSION_NOT_VALIDATED_CLOSED,
        )

    closure = (
        CashboxClosureAttempt.objects.select_for_update()
        .filter(session=locked_session, validation__isnull=False)
        .order_by("-validation__validated_at", "-submitted_at", "-created_at", "id")
        .first()
    )
    if closure is None:
        raise CashboxLifecycleError(
            "A cashbox reopen requires a validated closure attempt.",
            code=CASHBOX_SESSION_NOT_VALIDATED_CLOSED,
        )

    now = timezone.now()
    event = CashboxReopenEvent(
        session=locked_session,
        closure_attempt=closure,
        reason=reason.strip(),
        reopened_at=now,
        reopened_by=actor,
        idempotency_key=idempotency_key,
    )
    event.full_clean()
    event.save()
    locked_session.status = "open"
    locked_session.closed_at = None
    locked_session.closed_by = None
    locked_session.updated_by = actor
    locked_session.save(
        update_fields=["status", "closed_at", "closed_by", "updated_by", "updated_at"]
    )
    record_audit_event_on_commit(
        actor=actor,
        action="cashbox.session_reopened",
        target_type="cashbox_reopen_event",
        target_id=str(event.id),
        metadata={
            "session_id": str(locked_session.id),
            "closure_attempt_id": str(closure.id),
            "reason": event.reason,
        },
    )
    return locked_session


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
    _require_current_cashbox_session(locked_session)
    if locked_session.status != "open":
        raise CashboxLifecycleError(
            "Cashbox movements require an open session.",
            code=CASHBOX_SESSION_IS_CLOSED,
        )

    if payment is not None and amount != payment.amount:
        raise CashboxLifecycleError(
            "Cashbox movement amount must match the referenced payment amount.",
            code=CASHBOX_MOVEMENT_PAYMENT_AMOUNT_MISMATCH,
        )
    if payment is not None and (
        payment.payment_method != PaymentMethod.CASH
        or payment.payment_status not in CONFIRMED_PAYMENT_STATUS_VALUES
    ):
        raise CashboxLifecycleError(
            "Cashbox payment movements require a confirmed cash payment.",
            code=CASHBOX_MOVEMENT_PAYMENT_NOT_CONFIRMED_CASH,
        )
    if billing_invoice is not None and amount != billing_invoice.amount:
        raise CashboxLifecycleError(
            "Cashbox movement amount must match the referenced invoice amount.",
            code=CASHBOX_MOVEMENT_INVOICE_AMOUNT_MISMATCH,
        )
    if billing_refund_obligation is not None and amount != billing_refund_obligation.refund_amount:
        raise CashboxLifecycleError(
            "Cashbox movement amount must match the referenced refund obligation amount.",
            code=CASHBOX_MOVEMENT_REFUND_AMOUNT_MISMATCH,
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
