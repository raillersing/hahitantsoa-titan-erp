from datetime import timedelta

import pytest
from django.utils import timezone

from apps.customers.models import Customer
from apps.inventory.models import (
    InventoryDamageLossSettlement,
    InventoryDamageLossSettlementStatus,
    InventoryReturnOperation,
)
from apps.logistics.models import LogisticsEvent, LogisticsEventStatus, LogisticsEventType
from apps.reservations.closeout import get_closeout_summary
from apps.reservations.models import ReservationDraft, ReservationDraftStatus

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
