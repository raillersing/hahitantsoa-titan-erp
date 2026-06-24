"""Titan end-to-end operational acceptance test.

Covers the full Document A Titan happy path:
draft → contract → deposit → confirmation → logistics handover →
return → damage/loss settlement → excess invoice → closeout.
"""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from apps.audit.models import AuditEvent
from apps.billing.models import BillingInvoiceStatus
from apps.billing.services import (
    issue_billing_invoice_for_excess_receivable,
    settle_billing_invoice,
)
from apps.customers.models import Customer
from apps.documents.models import DocumentInstance, DocumentInstanceStatus
from apps.inventory.models import (
    InventoryDamageLossSettlementStatus,
    InventoryItem,
    InventoryReturnOperationStatus,
)
from apps.inventory.services import (
    create_inventory_damage_loss_settlement,
    create_inventory_damage_loss_settlement_execution,
    create_inventory_return_operation,
    execute_inventory_damage_loss_settlement_execution,
    validate_inventory_damage_loss_settlement,
    validate_inventory_return_operation,
)
from apps.logistics.models import LogisticsEventStatus, LogisticsEventType
from apps.logistics.services import (
    add_item_line_to_logistics_event,
    complete_handover_passation,
    create_logistics_event,
    transition_logistics_event_status,
)
from apps.payments.models import PaymentKind, PaymentMethod, PaymentStatus
from apps.payments.services import confirm_payment, create_payment
from apps.reservations.closeout import closeout_reservation_draft, get_closeout_summary
from apps.reservations.confirmation import (
    confirm_reservation_draft,
    mark_reservation_draft_contract_signed,
    mark_reservation_draft_required_deposit_received,
)
from apps.reservations.models import ReservationDraft, ReservationDraftLine, ReservationDraftStatus

pytestmark = pytest.mark.django_db


class _ActorFactory:
    counter = 0

    @classmethod
    def create(cls, django_user_model):
        cls.counter += 1
        return django_user_model.objects.create_user(
            username=f"e2e-actor-{cls.counter}",
            password="test-pass",
            is_staff=True,
        )


class _ItemFactory:
    counter = 0

    @classmethod
    def create(cls):
        cls.counter += 1
        return InventoryItem.objects.create(
            name=f"E2E Item {cls.counter}",
            kind="material",
        )


def _customer():
    return Customer.objects.create(display_name="E2E Client")


def _draft_with_line():
    start = timezone.now().replace(microsecond=0)
    draft = ReservationDraft.objects.create(
        customer=_customer(),
        start_at=start,
        end_at=start + timedelta(hours=4),
    )
    ReservationDraftLine.objects.create(
        reservation_draft=draft,
        inventory_item=_ItemFactory.create(),
        quantity=2,
    )
    return draft


def _contract_document(*, draft):
    return DocumentInstance.objects.create(
        reservation_draft=draft,
        customer=draft.customer,
        template_key="titan.material_contract.v1",
        template_version="v1",
        template_label="Contrat",
        business_scope="titan",
        document_type="material_contract",
        template_status="generated_draft_template",
        template_source_kind="generated_from_brand_style",
        template_source_reference="docs/references/source/Document_A.pdf",
        template_path="backend/apps/documents/templates_documents/titan/contrat_materiel/v1/template.html",
        template_preview_path="backend/apps/documents/templates_documents/titan/contrat_materiel/v1/preview.pdf",
        template_validated_by_client=False,
        template_notes="",
        reservation_public_reference=draft.public_reference,
        reservation_status=draft.status,
        customer_display_name=draft.customer.display_name,
        customer_email=draft.customer.email,
        customer_phone=draft.customer.phone,
        customer_address=draft.customer.address,
        status=DocumentInstanceStatus.GENERATED,
        content_checksum="a" * 64,
        storage_path="documents/contract-truth.html",
        generated_content_size_bytes=128,
    )


def _confirmed_deposit(*, draft, actor):
    payment = create_payment(
        actor=actor,
        reservation_draft=draft,
        payment_kind=PaymentKind.DEPOSIT,
        payment_method=PaymentMethod.CASH,
        payment_status=PaymentStatus.PENDING,
        amount=Decimal("100000.00"),
        source_label="Deposit",
    )
    confirm_payment(payment=payment, actor=actor)


def _payment_for_invoice(*, draft, actor, amount):
    payment = create_payment(
        actor=actor,
        reservation_draft=draft,
        payment_kind=PaymentKind.BALANCE,
        payment_method=PaymentMethod.CASH,
        payment_status=PaymentStatus.PENDING,
        amount=amount,
        source_label="Balance payment",
    )
    confirm_payment(payment=payment, actor=actor)
    return payment


def test_titan_full_happy_path_operational_acceptance(
    django_user_model,
    django_capture_on_commit_callbacks,
) -> None:
    actor = _ActorFactory.create(django_user_model)
    draft = _draft_with_line()
    item = draft.lines.first().inventory_item
    _contract_document(draft=draft)

    # 1. Contract signed + deposit received
    mark_reservation_draft_contract_signed(reservation_draft=draft, actor=actor)
    _confirmed_deposit(draft=draft, actor=actor)
    mark_reservation_draft_required_deposit_received(reservation_draft=draft, actor=actor)

    # 2. Confirmation
    with django_capture_on_commit_callbacks(execute=True):
        result = confirm_reservation_draft(reservation_draft=draft, actor=actor)
    draft.refresh_from_db()
    assert draft.status == ReservationDraftStatus.CONFIRMED
    assert result.blocked_item_count == 1

    # 3. Logistics handover event
    event = create_logistics_event(
        actor=actor,
        reservation_draft=draft,
        event_type=LogisticsEventType.HANDOVER,
        scheduled_at=timezone.now(),
        address="123 Test St",
        contact_name="Test Contact",
        contact_phone="+261330000000",
        notes="Handover notes",
        signature_required=True,
    )
    add_item_line_to_logistics_event(
        actor=actor,
        event=event,
        inventory_item=item,
        quantity=2,
    )
    transition_logistics_event_status(
        actor=actor,
        event=event,
        new_status=LogisticsEventStatus.DISPATCHED,
    )
    transition_logistics_event_status(
        actor=actor,
        event=event,
        new_status=LogisticsEventStatus.COMPLETED,
    )
    event.refresh_from_db()
    with django_capture_on_commit_callbacks(execute=True):
        complete_handover_passation(
            actor=actor,
            event=event,
            notes="Passation complete",
        )
    event.refresh_from_db()
    assert event.status == LogisticsEventStatus.COMPLETED
    assert event.signature_received is True

    # 4. Return operation
    return_op = create_inventory_return_operation(
        actor=actor,
        reservation_draft=draft,
        lines=[
            {
                "inventory_item_id": item.id,
                "expected_quantity": 2,
                "returned_quantity": 2,
                "damaged_quantity": 0,
                "missing_quantity": 0,
                "condition_status": "intact",
                "notes": "",
            }
        ],
        notes="Return notes",
    )
    validate_inventory_return_operation(return_operation=return_op, actor=actor)
    return_op.refresh_from_db()
    assert return_op.status == InventoryReturnOperationStatus.VALIDATED

    # 5. Damage/loss settlement
    return_line = return_op.lines.get()
    settlement = create_inventory_damage_loss_settlement(
        actor=actor,
        return_operation=return_op,
        lines=[
            {
                "return_operation_line": return_line,
                "settlement_line_kind": "loss",
                "quantity": 2,
                "unit_amount": Decimal("2500.00"),
                "notes": "Damage settlement",
            }
        ],
        notes="Damage settlement",
    )
    validate_inventory_damage_loss_settlement(settlement=settlement, actor=actor)
    settlement.refresh_from_db()
    assert settlement.settlement_status == InventoryDamageLossSettlementStatus.VALIDATED

    # 6. Settlement execution + excess invoice
    execution = create_inventory_damage_loss_settlement_execution(
        actor=actor,
        settlement=settlement,
    )
    exec_result = execute_inventory_damage_loss_settlement_execution(
        execution=execution,
        actor=actor,
    )
    assert exec_result.excess_receivable is not None

    invoice = issue_billing_invoice_for_excess_receivable(
        excess_receivable=exec_result.excess_receivable,
        actor=actor,
    )
    invoice.refresh_from_db()
    assert invoice.invoice_status == BillingInvoiceStatus.OPEN

    # 7. Closeout summary before settling
    summary = get_closeout_summary(reservation_draft_id=str(draft.id))
    assert summary is not None
    assert summary.confirmed is True
    assert summary.contract_signed is True
    assert summary.deposit_received is True
    assert summary.logistics.completed_count == 1
    assert summary.returns.return_count == 1
    assert summary.returns.settlement_validated_count == 1
    assert summary.billing.invoice_count == 1

    # 8. Closeout blocked until invoice is settled
    from apps.reservations.closeout import CloseoutValidationError

    with pytest.raises(CloseoutValidationError) as exc_info:
        closeout_reservation_draft(reservation_draft=draft, actor=actor)
    assert "billing_invoices_open" in str(exc_info.value)

    # Settle invoice and closeout
    payment = _payment_for_invoice(draft=draft, actor=actor, amount=invoice.amount)
    settle_billing_invoice(invoice=invoice, payment=payment, actor=actor)
    invoice.refresh_from_db()
    assert invoice.invoice_status == BillingInvoiceStatus.SETTLED

    with django_capture_on_commit_callbacks(execute=True):
        closeout_result = closeout_reservation_draft(reservation_draft=draft, actor=actor)
    assert closeout_result.confirmed is True
    assert closeout_result.billing.invoice_count == 1
    assert closeout_result.billing.settled_amount == invoice.amount

    # Audit events recorded
    assert AuditEvent.objects.filter(action="reservation.confirmed").exists()
    assert AuditEvent.objects.filter(action="logistics.handover_passation_completed").exists()
    assert AuditEvent.objects.filter(action="reservation.closeout_executed").exists()
