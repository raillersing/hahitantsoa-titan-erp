from datetime import timedelta
from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError
from django.utils import timezone
from rest_framework.test import APIClient
from tests.backend.test_inventory_damage_loss_settlement_execution_services import (
    _confirmed_caution_payment,
)
from tests.backend.test_inventory_damage_loss_settlement_model import (
    _inventory_item,
)

from apps.audit.models import AuditEvent
from apps.customers.models import Customer
from apps.documents.models import DocumentInstance, DocumentInstanceStatus
from apps.documents.payment_receipts import build_payment_receipt_context
from apps.hahitantsoa.closeout import validate_hahitantsoa_event_closeable
from apps.hahitantsoa.models import HahitantsoaEventDraft
from apps.inventory.models import (
    InventoryCautionRefundObligationStatus,
)
from apps.inventory.serializers import InventoryCautionRefundObligationSerializer
from apps.inventory.services import (
    create_inventory_damage_loss_settlement,
    create_inventory_damage_loss_settlement_execution,
    create_inventory_return_operation,
    execute_inventory_damage_loss_settlement_execution,
    validate_inventory_damage_loss_settlement,
    validate_inventory_return_operation,
)
from apps.payments.models import Payment, PaymentKind, PaymentMethod, PaymentStatus
from apps.payments.services import (
    INVALID_PAYMENT_REFUND_STATE,
    REFUND_OBLIGATION_NOT_PENDING,
    PaymentLifecycleError,
    confirm_refund_payment,
    create_refund_payment,
)
from apps.reservations.closeout import validate_reservation_closeable
from apps.reservations.models import ReservationDraft

pytestmark = pytest.mark.django_db


def _customer() -> Customer:
    return Customer.objects.create(
        display_name="Refund customer",
        email="refund@example.test",
        phone="+261340000333",
        address="Antananarivo",
    )


def _reservation_draft_refund() -> ReservationDraft:
    customer = _customer()
    start_at = timezone.now().replace(microsecond=0) + timedelta(days=2)
    end_at = start_at + timedelta(hours=5)
    return ReservationDraft.objects.create(
        customer=customer,
        start_at=start_at,
        end_at=end_at,
        notes="Refund reservation draft",
    )


def _event_draft_refund(actor=None) -> HahitantsoaEventDraft:
    start_at = timezone.now().replace(microsecond=0) + timedelta(days=2)
    return HahitantsoaEventDraft.objects.create(
        customer=_customer(),
        event_name="Hahitantsoa refund event",
        start_at=start_at,
        end_at=start_at + timedelta(hours=5),
        status="confirmed",
        confirmed_at=start_at,
        confirmed_by=actor,
    )


def _confirmed_hahitantsoa_caution_payment(
    actor,
    event_draft,
    paid_at,
    amount,
):
    receipt = DocumentInstance.objects.create(
        hahitantsoa_event_draft=event_draft,
        customer=event_draft.customer,
        template_key="hahitantsoa.payment_receipt.v1",
        template_version="v1",
        template_label="Recu de caution",
        business_scope="hahitantsoa",
        document_type="payment_receipt",
        template_status="generated_draft_template",
        template_source_kind="generated_from_brand_style",
        template_source_reference="docs/references/source/Document_B_Presentation_Metier_Evenementiel_v3.4.pdf",
        template_path="backend/apps/documents/templates_documents/hahitantsoa/payment_receipt/v1/template.html",
        template_preview_path="backend/apps/documents/templates_documents/hahitantsoa/payment_receipt/v1/preview.pdf",
        template_validated_by_client=False,
        template_notes="Receipt",
        reservation_public_reference=event_draft.public_reference,
        reservation_status=event_draft.status,
        customer_display_name=event_draft.customer.display_name,
        customer_email=event_draft.customer.email,
        customer_phone=event_draft.customer.phone,
        customer_address=event_draft.customer.address,
        status=DocumentInstanceStatus.GENERATED,
    )
    return Payment.objects.create(
        hahitantsoa_event_draft=event_draft,
        receipt_document=receipt,
        payment_kind="caution",
        payment_method="cash",
        payment_status="confirmed",
        amount=amount,
        paid_at=paid_at,
        source_label="Confirmed caution",
        confirmed_at=paid_at,
        confirmed_by=actor,
    )


def _pending_hahitantsoa_refund_obligation(
    django_user_model,
    *,
    caution_amount: Decimal = Decimal("60000.00"),
    unit_amount: Decimal = Decimal("25000.00"),
):
    actor = django_user_model.objects.create_user(
        username=f"refund-hah-{caution_amount}-{unit_amount}", password="test-pass", is_staff=True
    )
    event_draft = _event_draft_refund(actor=actor)
    return_operation = create_inventory_return_operation(
        actor=actor,
        hahitantsoa_event_draft=event_draft,
        lines=[
            {
                "inventory_item": _inventory_item(f"Refund hah item {caution_amount}"),
                "expected_quantity": 2,
                "returned_quantity": 0,
                "damaged_quantity": 0,
                "missing_quantity": 2,
                "condition_status": "missing",
                "notes": "",
            },
        ],
    )
    return_result = validate_inventory_return_operation(
        return_operation=return_operation, actor=actor
    )

    if caution_amount > Decimal("0.00"):
        _confirmed_hahitantsoa_caution_payment(
            actor,
            event_draft,
            return_result.return_operation.validated_at,
            caution_amount,
        )

    settlement = create_inventory_damage_loss_settlement(
        actor=actor,
        return_operation=return_result.return_operation,
        lines=[
            {
                "return_operation_line": return_result.return_operation.lines.get(),
                "settlement_line_kind": "loss",
                "quantity": 2,
                "unit_amount": unit_amount,
                "notes": "",
            }
        ],
    )
    settlement_result = validate_inventory_damage_loss_settlement(
        settlement=settlement, actor=actor
    )
    execution = create_inventory_damage_loss_settlement_execution(
        actor=actor, settlement=settlement_result.settlement
    )
    result = execute_inventory_damage_loss_settlement_execution(execution=execution, actor=actor)
    obligation = result.refund_obligation
    assert obligation is not None
    assert obligation.status == InventoryCautionRefundObligationStatus.PENDING
    assert obligation.amount > 0
    return actor, obligation, execution, event_draft


def _pending_refund_obligation(
    django_user_model,
    *,
    caution_amount: Decimal = Decimal("60000.00"),
    unit_amount: Decimal = Decimal("25000.00"),
):
    actor = django_user_model.objects.create_user(
        username=f"refund-test-{caution_amount}-{unit_amount}", password="test-pass", is_staff=True
    )
    reservation_draft = _reservation_draft_refund()
    return_operation = create_inventory_return_operation(
        actor=actor,
        reservation_draft=reservation_draft,
        lines=[
            {
                "inventory_item": _inventory_item(f"Refund test item {caution_amount}"),
                "expected_quantity": 2,
                "returned_quantity": 0,
                "damaged_quantity": 0,
                "missing_quantity": 2,
                "condition_status": "missing",
                "notes": "",
            },
        ],
    )
    return_result = validate_inventory_return_operation(
        return_operation=return_operation, actor=actor
    )

    if caution_amount > Decimal("0.00"):
        _confirmed_caution_payment(
            actor,
            reservation_draft,
            return_result.return_operation.validated_at,
            caution_amount,
        )

    settlement = create_inventory_damage_loss_settlement(
        actor=actor,
        return_operation=return_result.return_operation,
        lines=[
            {
                "return_operation_line": return_result.return_operation.lines.get(),
                "settlement_line_kind": "loss",
                "quantity": 2,
                "unit_amount": unit_amount,
                "notes": "",
            }
        ],
    )
    settlement_result = validate_inventory_damage_loss_settlement(
        settlement=settlement, actor=actor
    )
    execution = create_inventory_damage_loss_settlement_execution(
        actor=actor, settlement=settlement_result.settlement
    )
    result = execute_inventory_damage_loss_settlement_execution(execution=execution, actor=actor)
    obligation = result.refund_obligation
    assert obligation is not None
    assert obligation.status == InventoryCautionRefundObligationStatus.PENDING
    assert obligation.amount > 0
    return actor, obligation, execution


def test_create_refund_payment_from_pending_obligation(django_user_model) -> None:
    actor, obligation, execution = _pending_refund_obligation(django_user_model)
    reservation_draft = execution.settlement.return_operation.reservation_draft
    payment = create_refund_payment(
        refund_obligation=obligation,
        actor=actor,
        notes="Test refund",
    )
    assert payment.payment_kind == PaymentKind.REFUND
    assert payment.payment_status == PaymentStatus.PENDING
    assert payment.amount == obligation.amount
    assert payment.refund_obligation_id == obligation.id
    assert payment.reservation_draft_id == reservation_draft.id
    assert payment.hahitantsoa_event_draft_id is None
    assert payment.source_label == "Caution refund"


def test_create_refund_payment_rejects_non_pending_obligation(django_user_model) -> None:
    actor, obligation, _ = _pending_refund_obligation(django_user_model)
    obligation.status = InventoryCautionRefundObligationStatus.SETTLED
    obligation.save(update_fields=["status"])

    with pytest.raises(PaymentLifecycleError) as error_info:
        create_refund_payment(refund_obligation=obligation, actor=actor)

    assert error_info.value.code == REFUND_OBLIGATION_NOT_PENDING


def test_confirm_refund_payment_confirms_and_settles(django_user_model) -> None:
    actor, obligation, execution = _pending_refund_obligation(django_user_model)
    reservation_draft = execution.settlement.return_operation.reservation_draft
    payment = create_refund_payment(
        refund_obligation=obligation,
        actor=actor,
        notes="Test refund",
    )

    result = confirm_refund_payment(payment=payment, actor=actor)

    payment.refresh_from_db()
    obligation.refresh_from_db()
    assert payment.payment_status == PaymentStatus.CONFIRMED
    assert payment.receipt_document is not None
    assert payment.receipt_document.template_key == "shared.payment_refund_receipt.v1"
    assert payment.receipt_document.reservation_draft_id == reservation_draft.id
    assert payment.receipt_document.customer_id == reservation_draft.customer_id
    assert (
        payment.receipt_document.reservation_public_reference == reservation_draft.public_reference
    )
    assert obligation.status == InventoryCautionRefundObligationStatus.SETTLED
    assert result.payment.id == payment.id
    assert result.receipt_document.id == payment.receipt_document.id

    receipt_context = build_payment_receipt_context(
        payment=payment,
        template_key="shared.payment_refund_receipt.v1",
    )
    assert receipt_context.payment.amount_in_words == "Dix mille Ariary"


def test_confirm_refund_payment_rejects_non_refund_kind(django_user_model) -> None:
    actor = django_user_model.objects.create_user(
        username="refund-non-refund", password="test-pass"
    )
    reservation_draft = _reservation_draft_refund()
    payment = Payment.objects.create(
        reservation_draft=reservation_draft,
        payment_kind=PaymentKind.BALANCE,
        payment_method=PaymentMethod.BANK_TRANSFER,
        payment_status=PaymentStatus.PENDING,
        amount=Decimal("10000.00"),
        source_label="Balance payment",
    )

    with pytest.raises(PaymentLifecycleError) as error_info:
        confirm_refund_payment(payment=payment, actor=actor)

    assert error_info.value.code == INVALID_PAYMENT_REFUND_STATE


def test_confirm_refund_payment_rejects_non_pending_payment(django_user_model) -> None:
    actor, obligation, _ = _pending_refund_obligation(django_user_model)
    payment = create_refund_payment(refund_obligation=obligation, actor=actor)
    payment.payment_status = PaymentStatus.CANCELLED
    payment.save(update_fields=["payment_status"])

    with pytest.raises(PaymentLifecycleError) as error_info:
        confirm_refund_payment(payment=payment, actor=actor)

    assert error_info.value.code == INVALID_PAYMENT_REFUND_STATE


def test_confirm_refund_payment_rejects_missing_obligation(django_user_model) -> None:
    from django.db import IntegrityError

    django_user_model.objects.create_user(
        username="refund-missing-obligation", password="test-pass"
    )
    reservation_draft = _reservation_draft_refund()

    with pytest.raises(IntegrityError):
        Payment.objects.create(
            reservation_draft=reservation_draft,
            payment_kind=PaymentKind.REFUND,
            payment_method=PaymentMethod.BANK_TRANSFER,
            payment_status=PaymentStatus.PENDING,
            amount=Decimal("10000.00"),
            source_label="Caution refund",
        )


def test_payment_model_clean_rejects_refund_without_obligation(django_user_model) -> None:
    django_user_model.objects.create_user(username="refund-clean-test", password="test-pass")
    reservation_draft = _reservation_draft_refund()
    payment = Payment(
        reservation_draft=reservation_draft,
        payment_kind=PaymentKind.REFUND,
        payment_method=PaymentMethod.BANK_TRANSFER,
        payment_status=PaymentStatus.PENDING,
        amount=Decimal("10000.00"),
        source_label="Caution refund",
    )

    with pytest.raises(ValidationError) as error_info:
        payment.full_clean()

    assert "refund_obligation" in error_info.value.message_dict


def test_payment_model_clean_rejects_refund_with_settled_obligation(django_user_model) -> None:
    actor, obligation, _ = _pending_refund_obligation(django_user_model)
    obligation.status = InventoryCautionRefundObligationStatus.SETTLED
    obligation.save(update_fields=["status"])

    payment = Payment(
        reservation_draft=_reservation_draft_refund(),
        payment_kind=PaymentKind.REFUND,
        payment_method=PaymentMethod.BANK_TRANSFER,
        payment_status=PaymentStatus.PENDING,
        amount=Decimal("10000.00"),
        source_label="Caution refund",
        refund_obligation=obligation,
    )

    with pytest.raises(ValidationError) as error_info:
        payment.full_clean()

    assert "refund_obligation" in error_info.value.message_dict


def test_refund_amount_must_be_positive(django_user_model) -> None:
    actor, obligation, _ = _pending_refund_obligation(django_user_model)
    obligation.amount = Decimal("0.00")

    with pytest.raises(ValidationError):
        obligation.full_clean()


def test_refund_payment_audit_events(django_user_model, django_capture_on_commit_callbacks) -> None:
    actor, obligation, _ = _pending_refund_obligation(django_user_model)

    with django_capture_on_commit_callbacks(execute=True):
        payment = create_refund_payment(refund_obligation=obligation, actor=actor)

    assert AuditEvent.objects.filter(
        action="payment.refund.created",
        target_id=str(payment.id),
    ).exists()

    with django_capture_on_commit_callbacks(execute=True):
        confirm_refund_payment(payment=payment, actor=actor)

    assert AuditEvent.objects.filter(
        action="payment.refund.confirmed",
        target_id=str(payment.id),
    ).exists()
    assert AuditEvent.objects.filter(
        action="document.instance_generated",
        target_type="document_instance",
    ).exists()


def test_create_and_confirm_refund_payment_hahitantsoa(django_user_model) -> None:
    actor, obligation, _, event_draft = _pending_hahitantsoa_refund_obligation(django_user_model)

    # Before refund, closeout check must report caution refund unresolved
    blockers = validate_hahitantsoa_event_closeable(event_draft=event_draft)
    assert any("caution_refund_obligation_unresolved" in b for b in blockers)

    payment = create_refund_payment(
        refund_obligation=obligation,
        actor=actor,
        notes="Hahitantsoa refund",
    )
    assert payment.payment_kind == PaymentKind.REFUND
    assert payment.payment_status == PaymentStatus.PENDING
    assert payment.amount == obligation.amount
    assert payment.refund_obligation_id == obligation.id
    assert payment.hahitantsoa_event_draft_id == event_draft.id
    assert payment.reservation_draft_id is None

    result = confirm_refund_payment(payment=payment, actor=actor)
    payment.refresh_from_db()
    obligation.refresh_from_db()

    assert payment.payment_status == PaymentStatus.CONFIRMED
    assert payment.receipt_document is not None
    assert payment.receipt_document.template_key == "shared.payment_refund_receipt.v1"
    assert payment.receipt_document.hahitantsoa_event_draft_id == event_draft.id
    assert payment.receipt_document.customer_id == event_draft.customer_id
    assert payment.receipt_document.reservation_public_reference == event_draft.public_reference
    assert obligation.status == InventoryCautionRefundObligationStatus.SETTLED
    assert result.payment.id == payment.id
    assert result.receipt_document.id == payment.receipt_document.id

    # After refund settlement, caution refund blocker is cleared
    blockers_after = validate_hahitantsoa_event_closeable(event_draft=event_draft)
    assert not any("caution_refund_obligation_unresolved" in b for b in blockers_after)


def test_refund_payment_api_create_and_confirm(django_user_model) -> None:
    actor, obligation, _ = _pending_refund_obligation(django_user_model)
    client = APIClient()
    client.force_authenticate(user=actor)

    # 1. Create refund payment via API
    create_response = client.post(
        "/api/v1/payments/refund/",
        {"refund_obligation_id": str(obligation.id), "notes": "API refund"},
        format="json",
    )
    assert create_response.status_code == 201
    payment_data = create_response.data
    assert payment_data["payment_status"] == "pending"
    assert payment_data["payment_kind"] == "refund"
    assert payment_data["amount"] == "10000.00"
    payment_id = payment_data["id"]

    # 2. Confirm refund payment via API
    confirm_response = client.post(
        f"/api/v1/payments/{payment_id}/refund-confirm/",
        {"notes": "Confirmed via API"},
        format="json",
    )
    assert confirm_response.status_code == 200
    assert confirm_response.data["payment_status"] == "confirmed"
    assert confirm_response.data["receipt_document"] is not None

    obligation.refresh_from_db()
    assert obligation.status == InventoryCautionRefundObligationStatus.SETTLED


def test_refund_payment_api_auto_confirm(django_user_model) -> None:
    actor, obligation, _ = _pending_refund_obligation(django_user_model)
    client = APIClient()
    client.force_authenticate(user=actor)

    response = client.post(
        "/api/v1/payments/refund/",
        {
            "refund_obligation_id": str(obligation.id),
            "notes": "Auto confirmed refund",
            "auto_confirm": True,
        },
        format="json",
    )
    assert response.status_code == 201
    assert response.data["payment_status"] == "confirmed"
    assert response.data["receipt_document"] is not None

    obligation.refresh_from_db()
    assert obligation.status == InventoryCautionRefundObligationStatus.SETTLED


def test_inventory_caution_refund_obligation_serializer_exposes_payment_and_receipt(
    django_user_model,
) -> None:
    actor, obligation, _ = _pending_refund_obligation(django_user_model)
    # Before payment, fields are None
    data_before = InventoryCautionRefundObligationSerializer(obligation).data
    assert data_before["payment_id"] is None
    assert data_before["receipt_document_id"] is None

    # Create and confirm refund payment
    payment = create_refund_payment(refund_obligation=obligation, actor=actor)
    confirm_refund_payment(payment=payment, actor=actor)
    payment.refresh_from_db()
    obligation.refresh_from_db()

    data_after = InventoryCautionRefundObligationSerializer(obligation).data
    assert data_after["status"] == "settled"
    assert data_after["payment_id"] == str(payment.id)
    assert data_after["receipt_document_id"] == str(payment.receipt_document_id)


def test_closeout_readiness_unblocked_by_titan_caution_refund(django_user_model) -> None:
    actor, obligation, execution = _pending_refund_obligation(django_user_model)
    reservation_draft = execution.settlement.return_operation.reservation_draft

    blockers_before = validate_reservation_closeable(reservation_draft=reservation_draft)
    assert any("caution_refund_obligation_unresolved" in b for b in blockers_before)

    payment = create_refund_payment(refund_obligation=obligation, actor=actor)
    confirm_refund_payment(payment=payment, actor=actor)

    blockers_after = validate_reservation_closeable(reservation_draft=reservation_draft)
    assert not any("caution_refund_obligation_unresolved" in b for b in blockers_after)
