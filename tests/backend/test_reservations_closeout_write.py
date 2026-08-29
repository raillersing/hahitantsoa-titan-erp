from __future__ import annotations

from decimal import Decimal

import pytest
from django.db import DatabaseError
from django.utils import timezone

from apps.reservations.closeout import (
    CloseoutValidationError,
    closeout_reservation_draft,
    validate_reservation_closeable,
)
from apps.reservations.models import ReservationCloseout, ReservationDraft


@pytest.fixture
def sensitive_user(django_user_model):
    return django_user_model.objects.create_user(
        username="closeout-sensitive-user", password="test-pass", is_staff=True
    )


@pytest.fixture
def sensitive_client(sensitive_user):
    from django.test import Client

    client = Client()
    client.force_login(sensitive_user)
    return client


class TestValidateReservationCloseable:
    @staticmethod
    def _validated_damage_loss_return(*, draft, actor):
        from apps.inventory.models import (
            InventoryDamageLossSettlement,
            InventoryDamageLossSettlementStatus,
            InventoryReturnOperation,
        )

        returned_at = timezone.now()
        return_operation = InventoryReturnOperation.objects.create(
            reservation_draft=draft,
            status="validated",
            validated_at=returned_at,
            validated_by=actor,
        )
        settlement = InventoryDamageLossSettlement.objects.create(
            return_operation=return_operation,
            settlement_status=InventoryDamageLossSettlementStatus.VALIDATED,
            validated_at=returned_at,
            validated_by=actor,
        )
        return return_operation, settlement

    @pytest.mark.django_db
    def test_returns_empty_when_confirmed_no_events_no_invoices(self) -> None:
        from apps.customers.models import Customer

        customer = Customer.objects.create(display_name="Closeout Customer")
        draft = ReservationDraft.objects.create(
            public_reference="T-CO-001",
            customer=customer,
            start_at=timezone.now(),
            end_at=timezone.now(),
            confirmed_at=timezone.now(),
        )
        blockers = validate_reservation_closeable(reservation_draft=draft)
        assert blockers == []

    @pytest.mark.django_db
    def test_blocks_unconfirmed_draft(self) -> None:
        from apps.customers.models import Customer

        customer = Customer.objects.create(display_name="Closeout Customer")
        draft = ReservationDraft.objects.create(
            public_reference="T-CO-002",
            customer=customer,
            start_at=timezone.now(),
            end_at=timezone.now(),
        )
        blockers = validate_reservation_closeable(reservation_draft=draft)
        assert "reservation_not_confirmed" in blockers

    @pytest.mark.django_db
    def test_blocks_open_billing_invoice(self) -> None:
        from apps.customers.models import Customer

        customer = Customer.objects.create(display_name="Closeout Customer")
        draft = ReservationDraft.objects.create(
            public_reference="T-CO-003",
            customer=customer,
            start_at=timezone.now(),
            end_at=timezone.now(),
            confirmed_at=timezone.now(),
        )
        from apps.billing.models import BillingInvoice

        BillingInvoice.objects.create(
            reservation_draft=draft,
            amount=Decimal("500.00"),
            invoice_status="open",
            issued_at=timezone.now(),
            source_kind="manual",
        )
        blockers = validate_reservation_closeable(reservation_draft=draft)
        assert any("billing_invoices_open" in b for b in blockers)

    @pytest.mark.django_db
    def test_blocks_unvalidated_return_operation(self) -> None:
        from apps.customers.models import Customer
        from apps.inventory.models import InventoryReturnOperation

        customer = Customer.objects.create(display_name="Closeout Customer")
        draft = ReservationDraft.objects.create(
            public_reference="T-CO-007",
            customer=customer,
            start_at=timezone.now(),
            end_at=timezone.now(),
            confirmed_at=timezone.now(),
        )
        return_operation = InventoryReturnOperation.objects.create(
            reservation_draft=draft,
            status="draft",
        )

        blockers = validate_reservation_closeable(reservation_draft=draft)
        assert f"return_operation_not_validated:{return_operation.id}" in blockers

    @pytest.mark.django_db
    def test_blocks_validated_settlement_without_execution(self, django_user_model) -> None:
        from apps.customers.models import Customer

        actor = django_user_model.objects.create_user(username="closeout-execution", password="p")
        draft = ReservationDraft.objects.create(
            public_reference="T-CO-EXEC-001",
            customer=Customer.objects.create(display_name="Closeout Customer"),
            start_at=timezone.now(),
            end_at=timezone.now(),
            confirmed_at=timezone.now(),
        )
        return_operation, _ = self._validated_damage_loss_return(draft=draft, actor=actor)

        blockers = validate_reservation_closeable(reservation_draft=draft)

        assert f"return_settlement_execution_missing:{return_operation.id}" in blockers

    @pytest.mark.django_db
    def test_blocks_draft_settlement_execution(self, django_user_model) -> None:
        from apps.customers.models import Customer
        from apps.inventory.models import InventoryDamageLossSettlementExecution

        actor = django_user_model.objects.create_user(
            username="closeout-execution-draft", password="p"
        )
        draft = ReservationDraft.objects.create(
            public_reference="T-CO-EXEC-002",
            customer=Customer.objects.create(display_name="Closeout Customer"),
            start_at=timezone.now(),
            end_at=timezone.now(),
            confirmed_at=timezone.now(),
        )
        return_operation, settlement = self._validated_damage_loss_return(draft=draft, actor=actor)
        InventoryDamageLossSettlementExecution.objects.create(settlement=settlement)

        blockers = validate_reservation_closeable(reservation_draft=draft)

        assert f"return_settlement_execution_not_executed:{return_operation.id}" in blockers

    @pytest.mark.django_db
    def test_blocks_pending_refund_obligation_after_executed_settlement(
        self, django_user_model
    ) -> None:
        from apps.customers.models import Customer
        from apps.inventory.models import (
            InventoryCautionRefundObligation,
            InventoryDamageLossSettlementExecution,
            InventoryDamageLossSettlementExecutionStatus,
        )

        actor = django_user_model.objects.create_user(
            username="closeout-refund-pending", password="p"
        )
        draft = ReservationDraft.objects.create(
            public_reference="T-CO-REFUND-001",
            customer=Customer.objects.create(display_name="Closeout Customer"),
            start_at=timezone.now(),
            end_at=timezone.now(),
            confirmed_at=timezone.now(),
        )
        return_operation, settlement = self._validated_damage_loss_return(draft=draft, actor=actor)
        execution = InventoryDamageLossSettlementExecution.objects.create(
            settlement=settlement,
            status=InventoryDamageLossSettlementExecutionStatus.EXECUTED,
            executed_at=timezone.now(),
            executed_by=actor,
        )
        InventoryCautionRefundObligation.objects.create(settlement_execution=execution, amount=100)

        blockers = validate_reservation_closeable(reservation_draft=draft)

        assert f"caution_refund_obligation_unresolved:{return_operation.id}" in blockers

    @pytest.mark.django_db
    def test_blocks_unsettled_excess_receivable_after_executed_settlement(
        self, django_user_model
    ) -> None:
        from apps.customers.models import Customer
        from apps.inventory.models import (
            InventoryDamageLossExcessReceivable,
            InventoryDamageLossSettlementExecution,
            InventoryDamageLossSettlementExecutionStatus,
        )

        actor = django_user_model.objects.create_user(
            username="closeout-excess-pending", password="p"
        )
        draft = ReservationDraft.objects.create(
            public_reference="T-CO-EXCESS-001",
            customer=Customer.objects.create(display_name="Closeout Customer"),
            start_at=timezone.now(),
            end_at=timezone.now(),
            confirmed_at=timezone.now(),
        )
        return_operation, settlement = self._validated_damage_loss_return(draft=draft, actor=actor)
        execution = InventoryDamageLossSettlementExecution.objects.create(
            settlement=settlement,
            status=InventoryDamageLossSettlementExecutionStatus.EXECUTED,
            executed_at=timezone.now(),
            executed_by=actor,
        )
        InventoryDamageLossExcessReceivable.objects.create(
            settlement_execution=execution,
            amount=100,
        )

        blockers = validate_reservation_closeable(reservation_draft=draft)

        assert f"damage_loss_excess_receivable_not_invoiced:{return_operation.id}" in blockers

    @pytest.mark.django_db
    def test_blocks_confirmed_external_payment_pending_reconciliation(
        self, django_user_model
    ) -> None:
        from apps.customers.models import Customer
        from apps.documents.models import DocumentInstance, DocumentInstanceStatus
        from apps.payments.models import Payment, PaymentMethod, PaymentStatus

        actor = django_user_model.objects.create_user(
            username="closeout-external-payment", password="p"
        )
        draft = ReservationDraft.objects.create(
            public_reference="T-CO-PAYMENT-001",
            customer=Customer.objects.create(display_name="Closeout Customer"),
            start_at=timezone.now(),
            end_at=timezone.now(),
            confirmed_at=timezone.now(),
        )
        receipt = DocumentInstance.objects.create(
            reservation_draft=draft,
            customer=draft.customer,
            template_key="shared.payment_receipt.v1",
            template_version="v1",
            template_label="Receipt",
            business_scope="shared",
            document_type="payment_receipt",
            template_status="generated_draft_template",
            template_source_kind="generated_from_brand_style",
            template_source_reference="test",
            template_path="test.html",
            template_preview_path="test.pdf",
            template_validated_by_client=False,
            status=DocumentInstanceStatus.GENERATED,
        )
        Payment.objects.create(
            reservation_draft=draft,
            receipt_document=receipt,
            payment_kind="balance",
            payment_method=PaymentMethod.BANK_TRANSFER,
            payment_status=PaymentStatus.CONFIRMED,
            amount=100,
            paid_at=timezone.now(),
            confirmed_at=timezone.now(),
            confirmed_by=actor,
        )

        blockers = validate_reservation_closeable(reservation_draft=draft)

        assert "external_payments_unreconciled:1" in blockers

    @pytest.mark.django_db
    def test_blocks_titan_reservation_without_outbound_logistics(self) -> None:
        from apps.customers.models import Customer
        from apps.inventory.models import InventoryItem
        from apps.reservations.models import ReservationDraftLine

        customer = Customer.objects.create(display_name="Closeout Customer")
        draft = ReservationDraft.objects.create(
            public_reference="T-CO-008",
            customer=customer,
            start_at=timezone.now(),
            end_at=timezone.now(),
            confirmed_at=timezone.now(),
        )
        ReservationDraftLine.objects.create(
            reservation_draft=draft,
            inventory_item=InventoryItem.objects.create(name="Closeout item", kind="material"),
            quantity=1,
        )

        blockers = validate_reservation_closeable(reservation_draft=draft)
        assert "logistics_outbound_operation_missing" in blockers
        assert "return_operation_missing" in blockers


class TestCloseoutReservationDraft:
    @pytest.mark.django_db
    def test_rejects_oversized_idempotency_key(self) -> None:
        from apps.customers.models import Customer

        customer = Customer.objects.create(display_name="Closeout Customer")
        draft = ReservationDraft.objects.create(
            public_reference="T-CO-009",
            customer=customer,
            start_at=timezone.now(),
            end_at=timezone.now(),
            confirmed_at=timezone.now(),
        )

        with pytest.raises(CloseoutValidationError) as exc_info:
            closeout_reservation_draft(
                reservation_draft=draft,
                idempotency_key="x" * 129,
            )
        assert exc_info.value.code == "closeout_idempotency_key_too_long"

    @pytest.mark.django_db
    def test_raises_for_unconfirmed(self, django_user_model) -> None:
        from apps.customers.models import Customer

        customer = Customer.objects.create(display_name="Closeout Customer")
        draft = ReservationDraft.objects.create(
            public_reference="T-CO-004",
            customer=customer,
            start_at=timezone.now(),
            end_at=timezone.now(),
        )
        user = django_user_model.objects.create_user(
            username="closeout_actor", password="p", is_staff=True
        )
        with pytest.raises(CloseoutValidationError) as exc_info:
            closeout_reservation_draft(reservation_draft=draft, actor=user)
        assert exc_info.value.code == "reservation_not_closeable"

    @pytest.mark.django_db
    def test_returns_summary_for_confirmed(self, django_user_model) -> None:
        from apps.customers.models import Customer

        customer = Customer.objects.create(display_name="Closeout Customer")
        draft = ReservationDraft.objects.create(
            public_reference="T-CO-005",
            customer=customer,
            start_at=timezone.now(),
            end_at=timezone.now(),
            confirmed_at=timezone.now(),
        )
        user = django_user_model.objects.create_user(
            username="closeout_actor2", password="p", is_staff=True
        )
        result = closeout_reservation_draft(reservation_draft=draft, actor=user)
        assert result.reservation_draft_id == str(draft.id)
        assert result.confirmed is True

    @pytest.mark.django_db
    def test_replay_preserves_existing_closeout_after_new_blocker(self, django_user_model) -> None:
        from apps.customers.models import Customer
        from apps.inventory.models import InventoryReturnOperation

        customer = Customer.objects.create(display_name="Closeout Customer")
        draft = ReservationDraft.objects.create(
            public_reference="T-CO-REPLAY-001",
            customer=customer,
            start_at=timezone.now(),
            end_at=timezone.now(),
            confirmed_at=timezone.now(),
        )
        user = django_user_model.objects.create_user(
            username="closeout-replay-historic", password="p", is_staff=True
        )
        first = closeout_reservation_draft(
            reservation_draft=draft,
            actor=user,
            idempotency_key="historic-closeout",
        )
        InventoryReturnOperation.objects.create(reservation_draft=draft, status="draft")

        replay = closeout_reservation_draft(
            reservation_draft=draft,
            actor=user,
            idempotency_key="historic-closeout",
        )

        assert replay.replayed is True
        assert replay.closeout_id == first.closeout_id

    @pytest.mark.django_db
    def test_closeout_evidence_is_append_only(self, django_user_model) -> None:
        from apps.customers.models import Customer

        customer = Customer.objects.create(display_name="Closeout Evidence Customer")
        draft = ReservationDraft.objects.create(
            public_reference="T-CO-006",
            customer=customer,
            start_at=timezone.now(),
            end_at=timezone.now(),
            confirmed_at=timezone.now(),
        )
        user = django_user_model.objects.create_user(
            username="closeout_evidence_actor", password="p", is_staff=True
        )
        closeout_reservation_draft(reservation_draft=draft, actor=user)
        evidence = ReservationCloseout.objects.get(reservation_draft=draft)

        with pytest.raises(DatabaseError, match="append-only"):
            ReservationCloseout.objects.filter(pk=evidence.pk).update(summary_snapshot={})


class TestCloseoutExecuteAPI:
    @pytest.mark.django_db
    def test_execute_requires_auth(self, client, django_user_model) -> None:
        django_user_model.objects.create_user(username="co_auth", password="p", is_staff=True)
        response = client.post(
            "/api/v1/reservations/drafts/11111111-1111-1111-1111-111111111111/closeout/execute/"
        )
        assert response.status_code in {401, 403}

    @pytest.mark.django_db
    def test_execute_success(self, sensitive_client, django_user_model) -> None:
        from apps.customers.models import Customer

        django_user_model.objects.create_user(username="co_exec", password="p", is_staff=True)
        customer = Customer.objects.create(display_name="Closeout Exec")
        draft = ReservationDraft.objects.create(
            public_reference="T-CO-API",
            customer=customer,
            start_at=timezone.now(),
            end_at=timezone.now(),
            confirmed_at=timezone.now(),
        )
        response = sensitive_client.post(
            f"/api/v1/reservations/drafts/{draft.id}/closeout/execute/",
            HTTP_IDEMPOTENCY_KEY="closeout-api-1",
        )
        assert response.status_code == 200
        data = response.json()
        assert data["confirmed"] is True
        assert data["reservation_draft_id"] == str(draft.id)

        replay = sensitive_client.post(
            f"/api/v1/reservations/drafts/{draft.id}/closeout/execute/",
            HTTP_IDEMPOTENCY_KEY="closeout-api-1",
        )
        assert replay.status_code == 200
        assert replay.json()["replayed"] is True

        mismatch = sensitive_client.post(
            f"/api/v1/reservations/drafts/{draft.id}/closeout/execute/",
            HTTP_IDEMPOTENCY_KEY="closeout-api-2",
        )
        assert mismatch.status_code == 409

    @pytest.mark.django_db
    def test_execute_fails_for_unconfirmed(self, sensitive_client, django_user_model) -> None:
        from apps.customers.models import Customer

        django_user_model.objects.create_user(username="co_fail", password="p", is_staff=True)
        customer = Customer.objects.create(display_name="Closeout Fail")
        draft = ReservationDraft.objects.create(
            public_reference="T-CO-FAIL",
            customer=customer,
            start_at=timezone.now(),
            end_at=timezone.now(),
        )
        response = sensitive_client.post(
            f"/api/v1/reservations/drafts/{draft.id}/closeout/execute/"
        )
        assert response.status_code == 400
        data = response.json()
        assert "code" in data
