from decimal import Decimal

import pytest
from tests.backend.test_inventory_damage_loss_settlement_model import (
    _inventory_item,
    _reservation_draft,
)

from apps.documents.models import DocumentInstance, DocumentInstanceStatus
from apps.inventory.models import (
    InventoryDamageLossSettlementExecution,
    InventoryStockMovement,
)
from apps.inventory.services import (
    create_inventory_damage_loss_settlement,
    create_inventory_return_operation,
    validate_inventory_damage_loss_settlement,
    validate_inventory_return_operation,
)
from apps.payments.models import Payment

pytestmark = pytest.mark.django_db

DAMAGE_LOSS_SETTLEMENT_EXECUTION_LIST_URL = "/api/v1/inventory/damage-loss-settlement-executions/"


@pytest.fixture
def authenticated_client(client, django_user_model):
    user = django_user_model.objects.create_user(
        username="execution-api-user",
        password="test-pass",
    )
    client.force_login(user)
    return client


def _confirmed_caution_payment(actor, reservation_draft, paid_at, amount: Decimal) -> Payment:
    receipt = DocumentInstance.objects.create(
        reservation_draft=reservation_draft,
        customer=reservation_draft.customer,
        template_key="shared.payment_receipt.v1",
        template_version="v1",
        template_label="Recu de caution",
        business_scope="shared",
        document_type="payment_receipt",
        template_status="generated_draft_template",
        template_source_kind="generated_from_brand_style",
        template_source_reference="docs/references/source/Document_B_Presentation_Metier_Evenementiel_v3.4.pdf",
        template_path="backend/apps/documents/templates_documents/shared/payment_receipt/v1/template.html",
        template_preview_path="backend/apps/documents/templates_documents/shared/payment_receipt/v1/preview.pdf",
        template_validated_by_client=False,
        template_notes="Receipt",
        reservation_public_reference=reservation_draft.public_reference,
        reservation_status=reservation_draft.status,
        customer_display_name=reservation_draft.customer.display_name,
        customer_email=reservation_draft.customer.email,
        customer_phone=reservation_draft.customer.phone,
        customer_address=reservation_draft.customer.address,
        status=DocumentInstanceStatus.GENERATED,
    )
    return Payment.objects.create(
        reservation_draft=reservation_draft,
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


def _validated_settlement(django_user_model, *, caution_amount: Decimal, line_amount: Decimal):
    actor = django_user_model.objects.create_user(
        username=f"execution-api-helper-{caution_amount}-{line_amount}",
        password="test-pass",
    )
    reservation_draft = _reservation_draft()
    return_operation = create_inventory_return_operation(
        actor=actor,
        reservation_draft=reservation_draft,
        lines=[
            {
                "inventory_item": _inventory_item("Execution API item"),
                "expected_quantity": 1,
                "returned_quantity": 0,
                "damaged_quantity": 0,
                "missing_quantity": 1,
                "condition_status": "missing",
                "notes": "",
            }
        ],
    )
    validated_return = validate_inventory_return_operation(
        return_operation=return_operation,
        actor=actor,
    ).return_operation
    if caution_amount > Decimal("0.00"):
        _confirmed_caution_payment(
            actor,
            reservation_draft,
            validated_return.validated_at,
            caution_amount,
        )
    settlement = create_inventory_damage_loss_settlement(
        actor=actor,
        return_operation=validated_return,
        lines=[
            {
                "return_operation_line": validated_return.lines.get(),
                "settlement_line_kind": "loss",
                "quantity": 1,
                "unit_amount": line_amount,
                "notes": "",
            }
        ],
    )
    validated_settlement = validate_inventory_damage_loss_settlement(
        settlement=settlement,
        actor=actor,
    ).settlement
    return reservation_draft, validated_settlement


def test_execution_list_requires_authentication(client) -> None:
    response = client.get(DAMAGE_LOSS_SETTLEMENT_EXECUTION_LIST_URL)

    assert response.status_code in {401, 403}


def test_authenticated_user_can_create_read_and_execute_execution(
    authenticated_client,
    django_user_model,
) -> None:
    _, settlement = _validated_settlement(
        django_user_model,
        caution_amount=Decimal("60000.00"),
        line_amount=Decimal("25000.00"),
    )
    before_payment_count = Payment.objects.count()
    before_document_count = DocumentInstance.objects.count()
    before_stock_movement_count = InventoryStockMovement.objects.count()

    create_response = authenticated_client.post(
        DAMAGE_LOSS_SETTLEMENT_EXECUTION_LIST_URL,
        data={"settlement": str(settlement.id), "notes": "Prepare execution"},
        content_type="application/json",
    )

    assert create_response.status_code == 201
    payload = create_response.json()
    assert payload["status"] == "draft"
    assert payload["refund_obligation"] is None
    assert payload["excess_receivable"] is None

    list_response = authenticated_client.get(DAMAGE_LOSS_SETTLEMENT_EXECUTION_LIST_URL)
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1

    detail_response = authenticated_client.get(
        f"{DAMAGE_LOSS_SETTLEMENT_EXECUTION_LIST_URL}{payload['id']}/"
    )
    assert detail_response.status_code == 200
    assert detail_response.json()["id"] == payload["id"]

    execute_response = authenticated_client.post(
        f"{DAMAGE_LOSS_SETTLEMENT_EXECUTION_LIST_URL}{payload['id']}/execute/",
        content_type="application/json",
    )
    assert execute_response.status_code == 200
    executed_payload = execute_response.json()
    assert executed_payload["status"] == "executed"
    assert Decimal(executed_payload["refund_due_snapshot"]) == Decimal("35000.00")
    assert executed_payload["refund_obligation"]["status"] == "pending"
    assert executed_payload["excess_receivable"] is None
    assert Payment.objects.count() == before_payment_count
    assert DocumentInstance.objects.count() == before_document_count
    assert InventoryStockMovement.objects.count() == before_stock_movement_count


def test_execution_create_rejects_non_validated_settlement(
    authenticated_client,
    django_user_model,
) -> None:
    actor = django_user_model.objects.create_user(
        username="execution-api-invalid",
        password="test-pass",
    )
    return_operation = create_inventory_return_operation(
        actor=actor,
        reservation_draft=_reservation_draft(),
        lines=[
            {
                "inventory_item": _inventory_item("Execution invalid settlement"),
                "expected_quantity": 1,
                "returned_quantity": 0,
                "damaged_quantity": 0,
                "missing_quantity": 1,
                "condition_status": "missing",
                "notes": "",
            }
        ],
    )
    validated_return = validate_inventory_return_operation(
        return_operation=return_operation,
        actor=actor,
    ).return_operation
    draft_settlement = create_inventory_damage_loss_settlement(
        actor=actor,
        return_operation=validated_return,
        lines=[
            {
                "return_operation_line": validated_return.lines.get(),
                "settlement_line_kind": "loss",
                "quantity": 1,
                "unit_amount": Decimal("1000.00"),
                "notes": "",
            }
        ],
    )

    response = authenticated_client.post(
        DAMAGE_LOSS_SETTLEMENT_EXECUTION_LIST_URL,
        data={"settlement": str(draft_settlement.id)},
        content_type="application/json",
    )

    assert response.status_code == 400
    assert response.json()["code"] == "invalid_damage_loss_settlement_execution_settlement_state"


def test_execution_execute_rejects_duplicate_execution(
    authenticated_client,
    django_user_model,
) -> None:
    _, settlement = _validated_settlement(
        django_user_model,
        caution_amount=Decimal("0.00"),
        line_amount=Decimal("10000.00"),
    )
    create_response = authenticated_client.post(
        DAMAGE_LOSS_SETTLEMENT_EXECUTION_LIST_URL,
        data={"settlement": str(settlement.id)},
        content_type="application/json",
    )
    execution_id = create_response.json()["id"]

    first_response = authenticated_client.post(
        f"{DAMAGE_LOSS_SETTLEMENT_EXECUTION_LIST_URL}{execution_id}/execute/",
        content_type="application/json",
    )
    second_response = authenticated_client.post(
        f"{DAMAGE_LOSS_SETTLEMENT_EXECUTION_LIST_URL}{execution_id}/execute/",
        content_type="application/json",
    )

    assert first_response.status_code == 200
    assert second_response.status_code == 400
    assert second_response.json()["code"] == "invalid_damage_loss_settlement_execution_state"


@pytest.mark.parametrize("method", ["put", "patch", "delete"])
def test_execution_detail_rejects_write_methods(
    authenticated_client,
    django_user_model,
    method: str,
) -> None:
    _, settlement = _validated_settlement(
        django_user_model,
        caution_amount=Decimal("0.00"),
        line_amount=Decimal("10000.00"),
    )
    create_response = authenticated_client.post(
        DAMAGE_LOSS_SETTLEMENT_EXECUTION_LIST_URL,
        data={"settlement": str(settlement.id)},
        content_type="application/json",
    )
    execution_id = create_response.json()["id"]
    request_method = getattr(authenticated_client, method)

    response = request_method(
        f"{DAMAGE_LOSS_SETTLEMENT_EXECUTION_LIST_URL}{execution_id}/",
        data={"notes": "changed"},
        content_type="application/json",
    )

    assert response.status_code == 405


def test_execution_list_filter_by_status(authenticated_client, django_user_model):
    _, settlement_a = _validated_settlement(
        django_user_model,
        caution_amount=Decimal("0.00"),
        line_amount=Decimal("10000.00"),
    )
    _, settlement_b = _validated_settlement(
        django_user_model,
        caution_amount=Decimal("0.00"),
        line_amount=Decimal("20000.00"),
    )
    matching = InventoryDamageLossSettlementExecution.objects.create(
        settlement=settlement_a,
        status="draft",
    )
    user = django_user_model.objects.create_user(username="exec-filter", password="pass")
    InventoryDamageLossSettlementExecution.objects.create(
        settlement=settlement_b,
        status="executed",
        executed_at=__import__("django.utils.timezone", fromlist=["timezone"]).now(),
        executed_by=user,
    )
    response = authenticated_client.get(f"{DAMAGE_LOSS_SETTLEMENT_EXECUTION_LIST_URL}?status=draft")
    assert response.status_code == 200
    results = response.json()
    assert len(results) == 1
    assert results[0]["id"] == str(matching.id)


def test_execution_list_filter_by_settlement(authenticated_client, django_user_model):
    _, settlement_a = _validated_settlement(
        django_user_model,
        caution_amount=Decimal("0.00"),
        line_amount=Decimal("10000.00"),
    )
    _, settlement_b = _validated_settlement(
        django_user_model,
        caution_amount=Decimal("0.00"),
        line_amount=Decimal("20000.00"),
    )
    matching = InventoryDamageLossSettlementExecution.objects.create(
        settlement=settlement_a,
        status="draft",
    )
    InventoryDamageLossSettlementExecution.objects.create(
        settlement=settlement_b,
        status="draft",
    )
    response = authenticated_client.get(
        f"{DAMAGE_LOSS_SETTLEMENT_EXECUTION_LIST_URL}?settlement={str(settlement_a.id)}"
    )
    assert response.status_code == 200
    results = response.json()
    assert len(results) == 1
    assert results[0]["id"] == str(matching.id)
