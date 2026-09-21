from datetime import timedelta

import pytest
from django.utils import timezone

from apps.audit.models import AuditEvent
from apps.customers.models import Customer
from apps.inventory.models import (
    InventoryDamageLossSettlement,
    InventoryDamageLossSettlementStatus,
    InventoryReturnOperation,
)
from apps.logistics.models import LogisticsEvent, LogisticsEventStatus, LogisticsEventType
from apps.reservations.closeout import (
    closeout_reservation_draft,
    get_closeout_summary,
    validate_reservation_closeable,
)
from apps.reservations.models import ReservationCloseout, ReservationDraft, ReservationDraftStatus

pytestmark = pytest.mark.django_db


def _customer():
    return Customer.objects.create(display_name="Closeout Client")


def _reservation_draft():
    start = timezone.now().replace(microsecond=0)
    return ReservationDraft.objects.create(
        customer=_customer(),
        start_at=start,
        end_at=start + timedelta(hours=4),
    )


def test_get_closeout_summary_missing_draft():
    result = get_closeout_summary(reservation_draft_id="11111111-1111-1111-1111-111111111111")
    assert result is None


def test_get_closeout_summary_empty_draft():
    draft = _reservation_draft()
    result = get_closeout_summary(reservation_draft_id=str(draft.id))
    assert result is not None
    assert result.reservation_draft_id == str(draft.id)
    assert result.status == ReservationDraftStatus.DRAFT
    assert result.contract_signed is False
    assert result.deposit_received is False
    assert result.confirmed is False
    assert result.cancelled is False
    assert result.billing.invoice_count == 0
    assert result.payments.payment_count == 0
    assert result.logistics.event_count == 0
    assert result.returns.return_count == 0
    assert result.financial is not None
    assert result.financial.coherence_status == "coherent"


def test_closeout_execution_is_durable_and_idempotent(
    django_capture_on_commit_callbacks,
    django_user_model,
):
    draft = _reservation_draft()
    actor = django_user_model.objects.create_user(username="closeout-idempotent", password="p")
    draft.confirmed_at = timezone.now()
    draft.confirmed_by = actor
    draft.save(update_fields=["confirmed_at", "confirmed_by", "updated_at"])

    with django_capture_on_commit_callbacks(execute=True):
        first_result = closeout_reservation_draft(
            reservation_draft=draft,
            actor=actor,
            idempotency_key="closeout-test-1",
        )
    second_result = closeout_reservation_draft(
        reservation_draft=draft,
        actor=actor,
        idempotency_key="closeout-test-1",
    )

    assert first_result.reservation_draft_id == second_result.reservation_draft_id
    assert second_result.replayed is True
    assert second_result.closeout_id == first_result.closeout_id
    assert ReservationCloseout.objects.filter(reservation_draft=draft).count() == 1
    assert (
        AuditEvent.objects.filter(
            action="reservation.closeout_executed",
            target_id=str(draft.id),
        ).count()
        == 1
    )


def test_closeout_returns_immutable_snapshot_after_source_changes(django_user_model):
    from apps.billing.models import BillingInvoice

    draft = _reservation_draft()
    actor = django_user_model.objects.create_user(username="closeout-snapshot", password="p")
    draft.confirmed_at = timezone.now()
    draft.confirmed_by = actor
    draft.save(update_fields=["confirmed_at", "confirmed_by", "updated_at"])

    first_result = closeout_reservation_draft(reservation_draft=draft, actor=actor)
    BillingInvoice.objects.create(
        reservation_draft=draft,
        amount=100,
        invoice_status="open",
        issued_at=timezone.now(),
        source_kind="manual",
    )
    draft.notes = "Changed after closeout"
    draft.save(update_fields=["notes", "updated_at"])

    snapshot_result = get_closeout_summary(reservation_draft_id=str(draft.id))
    assert snapshot_result is not None
    assert snapshot_result.closeout_id == first_result.closeout_id
    assert snapshot_result.closeout_status == "closed"
    assert snapshot_result.closed_at == first_result.closed_at
    assert snapshot_result.billing.invoice_count == 0


def test_get_closeout_summary_with_contract_and_deposit():
    draft = _reservation_draft()
    from django.contrib.auth import get_user_model

    User = get_user_model()
    actor = User.objects.create_user(username="closeout_actor", password="p", is_staff=True)
    draft.contract_signed_at = timezone.now()
    draft.contract_signed_by = actor
    draft.required_deposit_received_at = timezone.now()
    draft.required_deposit_received_by = actor
    draft.confirmed_at = timezone.now()
    draft.confirmed_by = actor
    draft.save()
    result = get_closeout_summary(reservation_draft_id=str(draft.id))
    assert result.contract_signed is True
    assert result.deposit_received is True
    assert result.confirmed is True


def test_get_closeout_summary_with_billing():
    draft = _reservation_draft()
    from django.contrib.auth import get_user_model

    from apps.billing.models import BillingInvoice, BillingInvoiceStatus

    User = get_user_model()
    actor = User.objects.create_user(username="billing_actor", password="p", is_staff=True)
    BillingInvoice.objects.create(
        reservation_draft=draft,
        amount=1000,
        invoice_status=BillingInvoiceStatus.OPEN,
        issued_at=timezone.now(),
        source_kind="manual",
    )
    BillingInvoice.objects.create(
        reservation_draft=draft,
        amount=500,
        invoice_status=BillingInvoiceStatus.SETTLED,
        issued_at=timezone.now(),
        source_kind="manual",
        settled_at=timezone.now(),
        settled_by=actor,
    )
    result = get_closeout_summary(reservation_draft_id=str(draft.id))
    assert result.billing.invoice_count == 2
    assert result.billing.total_amount == 1500
    assert result.billing.open_amount == 1000
    assert result.billing.settled_amount == 500


def test_get_closeout_summary_with_payments():
    draft = _reservation_draft()
    from apps.payments.models import Payment, PaymentMethod, PaymentStatus

    Payment.objects.create(
        reservation_draft=draft,
        amount=300,
        payment_method=PaymentMethod.CASH,
        payment_status=PaymentStatus.PENDING,
        paid_at=timezone.now(),
    )
    Payment.objects.create(
        reservation_draft=draft,
        amount=200,
        payment_method=PaymentMethod.CASH,
        payment_status=PaymentStatus.PENDING,
    )
    result = get_closeout_summary(reservation_draft_id=str(draft.id))
    assert result.payments.payment_count == 2
    assert result.payments.total_received == 300


def test_get_closeout_summary_with_logistics():
    draft = _reservation_draft()
    LogisticsEvent.objects.create(
        reservation_draft=draft,
        event_type=LogisticsEventType.DELIVERY,
        status=LogisticsEventStatus.PLANNED,
    )
    LogisticsEvent.objects.create(
        reservation_draft=draft,
        event_type=LogisticsEventType.HANDOVER,
        status=LogisticsEventStatus.COMPLETED,
    )
    result = get_closeout_summary(reservation_draft_id=str(draft.id))
    assert result.logistics.event_count == 2
    assert result.logistics.delivery_count == 1
    assert result.logistics.handover_count == 1
    assert result.logistics.planned_count == 1
    assert result.logistics.completed_count == 1


def test_get_closeout_summary_with_returns_and_settlement():
    draft = _reservation_draft()
    return_op = InventoryReturnOperation.objects.create(
        reservation_draft=draft,
        status="draft",
    )
    InventoryDamageLossSettlement.objects.create(
        return_operation=return_op,
        damage_loss_total=100,
        excess_due=50,
        refund_due=25,
        settlement_status=InventoryDamageLossSettlementStatus.DRAFT,
    )
    result = get_closeout_summary(reservation_draft_id=str(draft.id))
    assert result.returns.return_count == 1
    assert result.returns.settlement_count == 1
    assert result.returns.settlement_draft_count == 1
    assert result.returns.total_damage_loss == 100
    assert result.returns.total_excess_due == 50
    assert result.returns.total_refund_due == 25


def test_closeout_blocked_by_casse_without_settlement(django_user_model):
    draft = _reservation_draft()
    actor = django_user_model.objects.create_user(username="casse-closeout-actor", password="p")
    draft.confirmed_at = timezone.now()
    draft.confirmed_by = actor
    draft.save()

    return_op = InventoryReturnOperation.objects.create(
        reservation_draft=draft,
        status="validated",
        validated_at=timezone.now(),
        validated_by=actor,
    )
    from apps.inventory.models import InventoryItem, InventoryReturnOperationLine

    item = InventoryItem.objects.create(name="Broken cup", kind="material")
    InventoryReturnOperationLine.objects.create(
        return_operation=return_op,
        inventory_item=item,
        expected_quantity=2,
        conforming_quantity=1,
        breakage_quantity=1,
        returned_quantity=2,
        damaged_quantity=1,
        missing_quantity=0,
        condition_status="mixed",
    )

    blockers = validate_reservation_closeable(reservation_draft=draft)
    assert any(
        b.startswith(f"return_settlement_missing_for_casse:{return_op.id}") for b in blockers
    )

    from apps.reservations.closeout import ReservationCloseoutError

    with pytest.raises(ReservationCloseoutError) as error:
        closeout_reservation_draft(reservation_draft=draft, actor=actor)
    assert error.value.code == "reservation_not_closeable"


def test_closeout_blocked_by_incomplete_commercial_invoicing_and_settlement(django_user_model):
    from decimal import Decimal

    from apps.billing.models import BillingInvoice, BillingInvoiceStatus
    from apps.reservations.closeout import ReservationCloseoutError

    draft = _reservation_draft()
    actor = django_user_model.objects.create_user(
        username="commercial-closeout-actor", password="p"
    )
    draft.confirmed_at = timezone.now()
    draft.confirmed_by = actor
    draft.total_amount = Decimal("50000.00")
    draft.save()

    # 1. Blocked when total_invoiced < total_amount
    blockers = validate_reservation_closeable(reservation_draft=draft)
    assert any(b.startswith("commercial_invoicing_incomplete") for b in blockers)
    with pytest.raises(ReservationCloseoutError):
        closeout_reservation_draft(reservation_draft=draft, actor=actor)

    BillingInvoice.objects.create(
        reservation_draft=draft,
        amount=Decimal("50000.00"),
        invoice_status=BillingInvoiceStatus.OPEN,
        issued_at=timezone.now(),
        source_kind="manual",
    )
    blockers = validate_reservation_closeable(reservation_draft=draft)
    assert not any(b.startswith("commercial_invoicing_incomplete") for b in blockers)
    assert any(b.startswith("commercial_settlement_incomplete") for b in blockers)
    with pytest.raises(ReservationCloseoutError):
        closeout_reservation_draft(reservation_draft=draft, actor=actor)


def test_closeout_blocked_by_pending_payments(django_user_model):
    from decimal import Decimal

    from apps.payments.models import Payment, PaymentMethod, PaymentStatus
    from apps.reservations.closeout import ReservationCloseoutError

    draft = _reservation_draft()
    actor = django_user_model.objects.create_user(username="pending-closeout-actor", password="p")
    draft.confirmed_at = timezone.now()
    draft.confirmed_by = actor
    draft.save()

    Payment.objects.create(
        reservation_draft=draft,
        amount=Decimal("10000.00"),
        payment_method=PaymentMethod.CASH,
        payment_status=PaymentStatus.PENDING,
        created_by=actor,
    )

    blockers = validate_reservation_closeable(reservation_draft=draft)
    assert "payments_pending_resolution:1" in blockers
    with pytest.raises(ReservationCloseoutError):
        closeout_reservation_draft(reservation_draft=draft, actor=actor)


def test_post_closeout_mutations_blocked(django_user_model):
    from decimal import Decimal

    from apps.billing.services import (
        BillingServiceError,
        issue_billing_invoice_for_commercial_closeout,
    )
    from apps.inventory.services import (
        InventoryStockMovementError,
        create_inventory_return_operation,
    )
    from apps.payments.services import PaymentServiceError, create_payment

    draft = _reservation_draft()
    actor = django_user_model.objects.create_user(username="post-closeout-actor", password="p")
    draft.confirmed_at = timezone.now()
    draft.confirmed_by = actor
    draft.save()

    closeout_reservation_draft(reservation_draft=draft, actor=actor)

    # 1. Payment creation blocked
    with pytest.raises(PaymentServiceError) as p_err:
        create_payment(
            actor=actor,
            reservation_draft=draft,
            payment_kind="deposit",
            payment_method="cash",
            amount=Decimal("1000.00"),
        )
    assert p_err.value.code == "dossier_already_closed"

    # 2. Billing invoice issuance blocked
    with pytest.raises(BillingServiceError) as b_err:
        issue_billing_invoice_for_commercial_closeout(
            actor=actor,
            reservation_draft=draft,
            amount=Decimal("1000.00"),
        )
    assert b_err.value.code == "dossier_already_closed"

    # 3. Inventory return creation blocked
    with pytest.raises(InventoryStockMovementError) as i_err:
        create_inventory_return_operation(
            actor=actor,
            reservation_draft=draft,
            lines=[],
        )
    assert i_err.value.code == "dossier_already_closed"
