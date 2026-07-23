from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from threading import Barrier

import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import DatabaseError, close_old_connections, connection, transaction
from django.db.migrations.executor import MigrationExecutor
from django.utils import timezone
from tests.backend.test_billing_refund_obligation import _partially_paid_invoice

from apps.audit.models import AuditEvent
from apps.billing.services import create_billing_invoice_refund_obligation
from apps.cashbox.models import (
    CashboxClosureAttempt,
    CashboxClosureValidation,
    CashboxMovementDirection,
    CashboxReopenEvent,
    CashboxSession,
)
from apps.cashbox.services import (
    CASHBOX_MOVEMENT_PAYMENT_NOT_CONFIRMED_CASH,
    CASHBOX_SESSION_ALREADY_CLOSED,
    CASHBOX_SESSION_ALREADY_OPEN,
    CASHBOX_SESSION_IS_CLOSED,
    CASHBOX_SESSION_NOT_OPEN,
    CashboxLifecycleError,
    close_cashbox_session,
    compute_cashbox_session_net_amount,
    open_cashbox_session,
    record_cashbox_movement,
    reopen_cashbox_session,
    submit_cashbox_count,
    validate_cashbox_count,
)
from apps.finance.models import FinanceAccountKind, FinanceBusinessScope
from apps.finance.services import create_finance_account
from apps.identity.models import ApplicationRole, UserRoleAssignment
from apps.identity.roles import CompanyRole, IdentityRole
from apps.payments.models import PaymentKind, PaymentMethod, PaymentStatus
from apps.payments.services import confirm_payment, create_payment

pytestmark = pytest.mark.django_db


def _actor(username: str):
    return get_user_model().objects.create_user(
        username=username,
        password="test-pass",
        is_staff=True,
    )


def _open_session(
    *, operator, actor=None, opening_amount=Decimal("0.00"), cash_account=None, **kwargs
):
    cash_account = cash_account or create_finance_account(
        actor=actor or operator,
        business_scope=FinanceBusinessScope.TITAN,
        code=f"{operator.username}-till",
        label=f"{operator.username} till",
        kind=FinanceAccountKind.CASH,
    )
    return open_cashbox_session(
        operator=operator,
        actor=actor or operator,
        cash_account=cash_account,
        opening_amount=opening_amount,
        **kwargs,
    )


def test_open_cashbox_session_creates_one_open_session_per_operator(
    django_capture_on_commit_callbacks,
) -> None:
    actor = _actor("cashbox-open-1")

    with django_capture_on_commit_callbacks(execute=True):
        session = _open_session(operator=actor, actor=actor, opening_note="Morning opening")

    assert session.operator_id == actor.id
    assert session.closed_at is None
    assert AuditEvent.objects.filter(
        action="cashbox.session_opened",
        target_id=str(session.id),
    ).exists()


def test_open_cashbox_session_rejects_second_open_session_for_same_operator() -> None:
    actor = _actor("cashbox-open-2")
    first = _open_session(operator=actor, actor=actor)

    with pytest.raises(CashboxLifecycleError) as error_info:
        _open_session(operator=actor, actor=actor, cash_account=first.cash_account)

    assert error_info.value.code == CASHBOX_SESSION_ALREADY_OPEN


def test_record_cashbox_movement_keeps_positive_directional_movements(
    django_capture_on_commit_callbacks,
) -> None:
    actor = _actor("cashbox-move-1")
    session = _open_session(operator=actor, actor=actor)
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
    cashier = _actor("cashbox-financial-references")
    session = _open_session(operator=cashier, actor=cashier)
    payment = create_payment(
        actor=actor,
        reservation_draft=reservation_draft,
        payment_kind=PaymentKind.OTHER,
        payment_method=PaymentMethod.CASH,
        payment_status=PaymentStatus.PENDING,
        amount=Decimal("100.00"),
        source_label="Cashbox reference",
    )
    payment = confirm_payment(payment=payment, actor=actor).payment
    obligation = create_billing_invoice_refund_obligation(
        invoice=invoice,
        actor=actor,
        notes="Cashbox refund linkage",
    )

    payment_movement = record_cashbox_movement(
        session=session,
        direction=CashboxMovementDirection.CASH_IN,
        amount=Decimal("100.00"),
        actor=cashier,
        payment=payment,
    )
    invoice_movement = record_cashbox_movement(
        session=session,
        direction=CashboxMovementDirection.CASH_IN,
        amount=invoice.amount,
        actor=cashier,
        billing_invoice=invoice,
    )
    refund_movement = record_cashbox_movement(
        session=session,
        direction=CashboxMovementDirection.CASH_OUT,
        amount=obligation.refund_amount,
        actor=cashier,
        billing_refund_obligation=obligation,
    )

    assert payment_movement.payment_id == payment.id
    assert invoice_movement.billing_invoice_id == invoice.id
    assert refund_movement.billing_refund_obligation_id == obligation.id


def test_record_cashbox_movement_rejects_submitted_count_session() -> None:
    actor = _actor("cashbox-move-closed")
    session = _open_session(operator=actor, actor=actor)
    submit_cashbox_count(
        session=session,
        actor=actor,
        actual_amount=Decimal("0.00"),
        idempotency_key="movement-after-count",
    )

    with pytest.raises(CashboxLifecycleError) as error_info:
        record_cashbox_movement(
            session=session,
            direction=CashboxMovementDirection.CASH_IN,
            amount=Decimal("50.00"),
            actor=actor,
        )

    assert error_info.value.code == CASHBOX_SESSION_IS_CLOSED


def test_close_cashbox_session_cannot_bypass_count_submission_and_supervised_validation() -> None:
    actor = _actor("cashbox-close-1")
    session = _open_session(operator=actor, actor=actor)
    with pytest.raises(CashboxLifecycleError) as error_info:
        close_cashbox_session(session=session, actor=actor, closing_note="Closing")
    assert error_info.value.code == CASHBOX_SESSION_NOT_OPEN


def test_validate_cashbox_count_is_idempotent_only_for_its_original_key() -> None:
    operator = _actor("cashbox-validate-idempotency-operator")
    supervisor = _actor("cashbox-validate-idempotency-supervisor")
    role = ApplicationRole.objects.create(
        name="Cashbox supervisor", slug=IdentityRole.CASHBOX_SUPERVISOR
    )
    UserRoleAssignment.objects.create(user=supervisor, role=role)
    closure = submit_cashbox_count(
        session=_open_session(operator=operator, actor=operator),
        actor=operator,
        actual_amount=Decimal("0.00"),
        idempotency_key="validate-idempotency-count",
    )

    validated = validate_cashbox_count(
        closure=closure,
        actor=supervisor,
        idempotency_key="validate-idempotency-1",
    )
    assert (
        validate_cashbox_count(
            closure=closure,
            actor=supervisor,
            idempotency_key="validate-idempotency-1",
        ).id
        == validated.id
    )
    with pytest.raises(CashboxLifecycleError) as error_info:
        validate_cashbox_count(
            closure=closure,
            actor=supervisor,
            idempotency_key="validate-idempotency-2",
        )
    assert error_info.value.code == CASHBOX_SESSION_ALREADY_CLOSED


def test_cashbox_closure_attempt_is_append_only_via_orm_and_database() -> None:
    actor = _actor("cashbox-closure-attempt-append-only")
    closure = submit_cashbox_count(
        session=_open_session(operator=actor, actor=actor),
        actor=actor,
        actual_amount=Decimal("0.00"),
        idempotency_key="append-only-closure",
    )

    closure.actual_amount = Decimal("1.00")
    with pytest.raises(ValidationError, match="append-only"):
        closure.save()
    with pytest.raises(ValidationError, match="append-only"):
        closure.delete()

    with pytest.raises(DatabaseError, match="append-only"):
        with transaction.atomic():
            CashboxClosureAttempt.objects.filter(pk=closure.pk).update(
                actual_amount=Decimal("1.00")
            )
    with pytest.raises(DatabaseError, match="append-only"):
        with transaction.atomic():
            CashboxClosureAttempt.objects.filter(pk=closure.pk).delete()
    with pytest.raises(DatabaseError, match="append-only"):
        with transaction.atomic(), connection.cursor() as cursor:
            cursor.execute(
                "UPDATE cashbox_cashboxclosureattempt SET actual_amount = %s WHERE id = %s",
                [Decimal("1.00"), closure.pk],
            )
    with pytest.raises(DatabaseError, match="append-only"):
        with transaction.atomic(), connection.cursor() as cursor:
            cursor.execute("DELETE FROM cashbox_cashboxclosureattempt WHERE id = %s", [closure.pk])

    assert CashboxClosureAttempt.objects.filter(pk=closure.pk).count() == 1


def test_legacy_cashbox_sessions_without_cash_account_are_terminal_and_read_only() -> None:
    operator = _actor("cashbox-legacy-operator")
    supervisor = _actor("cashbox-legacy-supervisor")
    role = ApplicationRole.objects.create(
        name="Cashbox supervisor", slug=IdentityRole.CASHBOX_SUPERVISOR
    )
    UserRoleAssignment.objects.create(user=supervisor, role=role)
    now = timezone.now()
    legacy_open = CashboxSession.objects.create(
        operator=operator,
        opened_at=now,
        opened_by=operator,
        status="open",
    )

    for action in (
        lambda: submit_cashbox_count(
            session=legacy_open,
            actor=operator,
            actual_amount=Decimal("0.00"),
            idempotency_key="legacy-submit",
        ),
        lambda: record_cashbox_movement(
            session=legacy_open,
            direction=CashboxMovementDirection.CASH_IN,
            amount=Decimal("1.00"),
            actor=operator,
        ),
    ):
        with pytest.raises(CashboxLifecycleError) as error_info:
            action()
        assert error_info.value.code == "cashbox_session_legacy_account_unassigned"

    legacy_submitted = CashboxSession.objects.create(
        operator=operator,
        opened_at=now,
        opened_by=operator,
        status="count_submitted",
    )
    submitted_attempt = CashboxClosureAttempt.objects.create(
        session=legacy_submitted,
        theoretical_amount=Decimal("0.00"),
        actual_amount=Decimal("0.00"),
        variance_amount=Decimal("0.00"),
        submitted_at=now,
        submitted_by=operator,
        submission_idempotency_key="legacy-validation-attempt",
    )
    with pytest.raises(CashboxLifecycleError) as error_info:
        validate_cashbox_count(
            closure=submitted_attempt,
            actor=supervisor,
            idempotency_key="legacy-validate",
        )
    assert error_info.value.code == "cashbox_session_legacy_account_unassigned"

    legacy_closed = CashboxSession.objects.create(
        operator=operator,
        opened_at=now,
        opened_by=operator,
        closed_at=now,
        closed_by=supervisor,
        status="validated_closed",
    )
    closed_attempt = CashboxClosureAttempt.objects.create(
        session=legacy_closed,
        theoretical_amount=Decimal("0.00"),
        actual_amount=Decimal("0.00"),
        variance_amount=Decimal("0.00"),
        submitted_at=now,
        submitted_by=operator,
        submission_idempotency_key="legacy-reopen-attempt",
    )
    CashboxClosureValidation.objects.create(
        closure_attempt=closed_attempt,
        validated_at=now,
        validated_by=supervisor,
        idempotency_key="legacy-reopen-validation",
    )
    with pytest.raises(CashboxLifecycleError) as error_info:
        reopen_cashbox_session(
            session=legacy_closed,
            actor=supervisor,
            reason="Legacy sessions cannot be reopened.",
            idempotency_key="legacy-reopen",
        )
    assert error_info.value.code == "cashbox_session_legacy_account_unassigned"


@pytest.mark.django_db(transaction=True)
def test_cashbox_0004_reverse_restores_legacy_session_statuses() -> None:
    operator = _actor("cashbox-0004-reverse")
    executor = MigrationExecutor(connection)
    previous = [("cashbox", "0003_cashboxsession_status_cashboxclosureattempt")]
    current = [("cashbox", "0005_cashboxclosureattempt_append_only")]
    try:
        executor.migrate(previous)
        old_apps = executor.loader.project_state(previous).apps
        OldCashboxSession = old_apps.get_model("cashbox", "CashboxSession")
        historical_session = OldCashboxSession.objects.create(
            operator_id=operator.id,
            opened_at=timezone.now(),
            opened_by_id=operator.id,
            status="open",
        )

        executor = MigrationExecutor(connection)
        forward_target = [("cashbox", "0004_alter_cashboxsession_status_cashboxreopenevent")]
        executor.migrate(forward_target)
        forward_apps = executor.loader.project_state(forward_target).apps
        ForwardCashboxSession = forward_apps.get_model("cashbox", "CashboxSession")
        assert (
            ForwardCashboxSession.objects.get(pk=historical_session.pk).status == "legacy_terminal"
        )

        executor = MigrationExecutor(connection)
        executor.migrate(previous)
        reverse_apps = executor.loader.project_state(previous).apps
        ReverseCashboxSession = reverse_apps.get_model("cashbox", "CashboxSession")
        assert ReverseCashboxSession.objects.get(pk=historical_session.pk).status == "open"
    finally:
        MigrationExecutor(connection).migrate(current)


@pytest.mark.django_db(transaction=True)
def test_concurrent_cashbox_open_creates_one_session_for_one_operator_and_account() -> None:
    operator = _actor("cashbox-concurrent-open")
    account = create_finance_account(
        actor=operator,
        business_scope=FinanceBusinessScope.TITAN,
        code="CONCURRENT-OPEN-TILL",
        label="Concurrent opening till",
        kind=FinanceAccountKind.CASH,
    )
    barrier = Barrier(2)

    def worker() -> str:
        close_old_connections()
        try:
            worker_operator = get_user_model().objects.get(pk=operator.pk)
            worker_account = account.__class__.objects.get(pk=account.pk)
            barrier.wait()
            try:
                open_cashbox_session(
                    operator=worker_operator,
                    actor=worker_operator,
                    cash_account=worker_account,
                    opening_amount=Decimal("0.00"),
                )
            except CashboxLifecycleError as error:
                return error.code
            return "success"
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(lambda _: worker(), range(2)))

    assert sorted(results) == [CASHBOX_SESSION_ALREADY_OPEN, "success"]
    assert CashboxSession.objects.filter(operator=operator, cash_account=account).count() == 1


@pytest.mark.django_db(transaction=True)
def test_concurrent_movement_and_count_submission_are_serialized_by_the_session_lock() -> None:
    actor = _actor("cashbox-concurrent-movement-submit")
    session = _open_session(operator=actor, actor=actor)
    barrier = Barrier(2)

    def record_worker() -> str:
        close_old_connections()
        try:
            worker_actor = get_user_model().objects.get(pk=actor.pk)
            worker_session = CashboxSession.objects.get(pk=session.pk)
            barrier.wait()
            try:
                record_cashbox_movement(
                    session=worker_session,
                    direction=CashboxMovementDirection.CASH_IN,
                    amount=Decimal("1.00"),
                    actor=worker_actor,
                )
            except CashboxLifecycleError as error:
                return error.code
            return "movement_recorded"
        finally:
            close_old_connections()

    def submit_worker() -> str:
        close_old_connections()
        try:
            worker_actor = get_user_model().objects.get(pk=actor.pk)
            worker_session = CashboxSession.objects.get(pk=session.pk)
            barrier.wait()
            submit_cashbox_count(
                session=worker_session,
                actor=worker_actor,
                actual_amount=Decimal("0.00"),
                variance_justification="Concurrent count snapshot may follow a recorded movement.",
                idempotency_key="concurrent-movement-submit",
            )
            return "count_submitted"
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(lambda worker: worker(), (record_worker, submit_worker)))

    closure = CashboxClosureAttempt.objects.get(session=session)
    assert "count_submitted" in results
    if "movement_recorded" in results:
        assert closure.theoretical_amount == Decimal("1.00")
    else:
        assert results == [CASHBOX_SESSION_IS_CLOSED, "count_submitted"]
        assert closure.theoretical_amount == Decimal("0.00")


@pytest.mark.django_db(transaction=True)
def test_concurrent_count_submission_with_same_idempotency_key_creates_one_attempt() -> None:
    actor = _actor("cashbox-concurrent-idempotency")
    session = _open_session(operator=actor, actor=actor)
    barrier = Barrier(2)

    def worker() -> str:
        close_old_connections()
        try:
            worker_actor = get_user_model().objects.get(pk=actor.pk)
            worker_session = CashboxSession.objects.get(pk=session.pk)
            barrier.wait()
            return str(
                submit_cashbox_count(
                    session=worker_session,
                    actor=worker_actor,
                    actual_amount=Decimal("0.00"),
                    idempotency_key="concurrent-count-key",
                ).id
            )
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as executor:
        attempt_ids = list(executor.map(lambda _: worker(), range(2)))

    assert len(set(attempt_ids)) == 1
    assert (
        CashboxClosureAttempt.objects.filter(
            session=session, submission_idempotency_key="concurrent-count-key"
        ).count()
        == 1
    )


def test_open_cashbox_session_is_scoped_to_operator_and_physical_cash_account() -> None:
    actor = _actor("cashbox-account-scope")
    first_cash_account = create_finance_account(
        actor=actor,
        business_scope=FinanceBusinessScope.TITAN,
        code="TITAN-TILL-1",
        label="Titan till 1",
        kind=FinanceAccountKind.CASH,
    )
    second_cash_account = create_finance_account(
        actor=actor,
        business_scope=FinanceBusinessScope.TITAN,
        code="TITAN-TILL-2",
        label="Titan till 2",
        kind=FinanceAccountKind.CASH,
    )

    first = open_cashbox_session(
        operator=actor,
        actor=actor,
        cash_account=first_cash_account,
        opening_amount=Decimal("100.00"),
    )
    second = open_cashbox_session(
        operator=actor,
        actor=actor,
        cash_account=second_cash_account,
        opening_amount=Decimal("50.00"),
    )

    assert first.cash_account_id == first_cash_account.id
    assert first.opening_amount == Decimal("100.00")
    assert second.cash_account_id == second_cash_account.id


def test_submit_cashbox_count_freezes_theoretical_balance_and_blocks_new_movements() -> None:
    actor = _actor("cashbox-count-snapshot")
    session = _open_session(operator=actor, actor=actor, opening_amount=Decimal("100.00"))
    record_cashbox_movement(
        session=session,
        direction=CashboxMovementDirection.CASH_IN,
        amount=Decimal("50.00"),
        actor=actor,
    )

    closure = submit_cashbox_count(
        session=session,
        actor=actor,
        actual_amount=Decimal("145.00"),
        variance_justification="Five ariary missing after count.",
        idempotency_key="count-snapshot-1",
    )

    assert closure.theoretical_amount == Decimal("150.00")
    assert closure.actual_amount == Decimal("145.00")
    assert closure.variance_amount == Decimal("-5.00")
    with pytest.raises(CashboxLifecycleError) as error_info:
        record_cashbox_movement(
            session=session,
            direction=CashboxMovementDirection.CASH_IN,
            amount=Decimal("1.00"),
            actor=actor,
        )
    assert error_info.value.code == CASHBOX_SESSION_IS_CLOSED


def test_validate_cashbox_count_requires_explicit_supervisor_capability_not_manager_role() -> None:
    operator = _actor("cashbox-validation-operator")
    manager = _actor("cashbox-manager-without-capability")
    manager_role = ApplicationRole.objects.create(name="Manager", slug=CompanyRole.MANAGER)
    UserRoleAssignment.objects.create(user=manager, role=manager_role)
    session = _open_session(operator=operator, actor=operator)
    closure = submit_cashbox_count(
        session=session,
        actor=operator,
        actual_amount=Decimal("0.00"),
        idempotency_key="count-validation-1",
    )

    with pytest.raises(PermissionError, match="cashbox supervisor"):
        validate_cashbox_count(
            closure=closure,
            actor=manager,
            idempotency_key="validate-count-1",
        )

    supervisor_role = ApplicationRole.objects.create(
        name="Cashbox supervisor",
        slug=IdentityRole.CASHBOX_SUPERVISOR,
    )
    UserRoleAssignment.objects.create(user=manager, role=supervisor_role)
    validated = validate_cashbox_count(
        closure=closure,
        actor=manager,
        idempotency_key="validate-count-1",
    )

    session.refresh_from_db()
    assert validated.validation.validated_by_id == manager.id
    assert session.status == "validated_closed"


def test_reopen_cashbox_session_requires_supervisor_reason_and_keeps_append_only_proof() -> None:
    operator = _actor("cashbox-reopen-operator")
    supervisor = _actor("cashbox-reopen-supervisor")
    role = ApplicationRole.objects.create(
        name="Cashbox reopen supervisor",
        slug=IdentityRole.CASHBOX_SUPERVISOR,
    )
    UserRoleAssignment.objects.create(user=supervisor, role=role)
    session = _open_session(operator=operator, actor=operator)
    closure = submit_cashbox_count(
        session=session,
        actor=operator,
        actual_amount=Decimal("0.00"),
        idempotency_key="count-reopen-1",
    )
    validate_cashbox_count(
        closure=closure,
        actor=supervisor,
        idempotency_key="validate-reopen-1",
    )

    reopened = reopen_cashbox_session(
        session=session,
        actor=supervisor,
        reason="Supervisor found a counting mistake.",
        idempotency_key="reopen-1",
    )

    reopened.refresh_from_db()
    assert reopened.status == "open"
    assert reopened.closure_attempts.get().id == closure.id
    assert reopened.reopen_events.get().reason == "Supervisor found a counting mistake."


def test_reopen_cashbox_session_is_idempotent_and_append_only() -> None:
    operator = _actor("cashbox-reopen-idempotency-operator")
    supervisor = _actor("cashbox-reopen-idempotency-supervisor")
    role = ApplicationRole.objects.create(
        name="Cashbox supervisor", slug=IdentityRole.CASHBOX_SUPERVISOR
    )
    UserRoleAssignment.objects.create(user=supervisor, role=role)
    session = _open_session(operator=operator, actor=operator)
    closure = submit_cashbox_count(
        session=session,
        actor=operator,
        actual_amount=Decimal("0.00"),
        idempotency_key="reopen-idempotency-count",
    )
    validate_cashbox_count(
        closure=closure,
        actor=supervisor,
        idempotency_key="reopen-idempotency-validate",
    )

    reopened = reopen_cashbox_session(
        session=session,
        actor=supervisor,
        reason="Correct a verified counting mistake.",
        idempotency_key="reopen-idempotency-1",
    )
    replay = reopen_cashbox_session(
        session=session,
        actor=supervisor,
        reason="Ignored replay payload.",
        idempotency_key="reopen-idempotency-1",
    )

    event = CashboxReopenEvent.objects.get(session=session)
    assert replay.id == reopened.id
    assert CashboxReopenEvent.objects.filter(session=session).count() == 1
    event.reason = "Mutated reopen reason"
    with pytest.raises(ValidationError, match="append-only"):
        event.save()
    with pytest.raises(ValidationError, match="append-only"):
        event.delete()
    with pytest.raises(DatabaseError, match="append-only"):
        with transaction.atomic():
            CashboxReopenEvent.objects.filter(pk=event.pk).update(reason="Mutated reopen reason")
    with pytest.raises(DatabaseError, match="append-only"):
        with transaction.atomic():
            CashboxReopenEvent.objects.filter(pk=event.pk).delete()
    with pytest.raises(DatabaseError, match="append-only"):
        with transaction.atomic(), connection.cursor() as cursor:
            cursor.execute(
                "UPDATE cashbox_cashboxreopenevent SET reason = %s WHERE id = %s",
                ["Mutated reopen reason", event.pk],
            )
    with pytest.raises(DatabaseError, match="append-only"):
        with transaction.atomic(), connection.cursor() as cursor:
            cursor.execute("DELETE FROM cashbox_cashboxreopenevent WHERE id = %s", [event.pk])


def test_reopen_cashbox_session_requires_nonblank_reason() -> None:
    operator = _actor("cashbox-reopen-blank-operator")
    supervisor = _actor("cashbox-reopen-blank-supervisor")
    role = ApplicationRole.objects.create(
        name="Cashbox supervisor", slug=IdentityRole.CASHBOX_SUPERVISOR
    )
    UserRoleAssignment.objects.create(user=supervisor, role=role)
    session = _open_session(operator=operator, actor=operator)
    closure = submit_cashbox_count(
        session=session,
        actor=operator,
        actual_amount=Decimal("0.00"),
        idempotency_key="reopen-blank-count",
    )
    validate_cashbox_count(
        closure=closure,
        actor=supervisor,
        idempotency_key="reopen-blank-validate",
    )

    with pytest.raises(CashboxLifecycleError) as error_info:
        reopen_cashbox_session(
            session=session,
            actor=supervisor,
            reason="  ",
            idempotency_key="reopen-blank-1",
        )
    assert error_info.value.code == "cashbox_reopen_reason_required"


def test_submit_cashbox_count_requires_justification_for_a_variance() -> None:
    actor = _actor("cashbox-variance-justification")
    session = _open_session(operator=actor, actor=actor, opening_amount=Decimal("10.00"))

    with pytest.raises(Exception):
        submit_cashbox_count(
            session=session,
            actor=actor,
            actual_amount=Decimal("9.00"),
            idempotency_key="variance-without-reason",
        )
    session.refresh_from_db()
    assert session.status == "open"


def test_cashbox_movement_rejects_unconfirmed_cash_payment() -> None:
    actor, reservation_draft, _, _ = _partially_paid_invoice(get_user_model())
    cashier = _actor("cashbox-confirmed-cash")
    session = _open_session(operator=cashier, actor=cashier)
    payment = create_payment(
        actor=actor,
        reservation_draft=reservation_draft,
        payment_kind=PaymentKind.OTHER,
        payment_method=PaymentMethod.CASH,
        payment_status=PaymentStatus.PENDING,
        amount=Decimal("100.00"),
        source_label="Pending cash payment",
    )

    with pytest.raises(CashboxLifecycleError) as error_info:
        record_cashbox_movement(
            session=session,
            direction=CashboxMovementDirection.CASH_IN,
            amount=payment.amount,
            actor=cashier,
            payment=payment,
        )
    assert error_info.value.code == CASHBOX_MOVEMENT_PAYMENT_NOT_CONFIRMED_CASH

    confirmed_payment = confirm_payment(payment=payment, actor=actor).payment
    movement = record_cashbox_movement(
        session=session,
        direction=CashboxMovementDirection.CASH_IN,
        amount=confirmed_payment.amount,
        actor=cashier,
        payment=confirmed_payment,
    )
    assert movement.payment_id == confirmed_payment.id
