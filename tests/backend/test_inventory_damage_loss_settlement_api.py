from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from apps.customers.models import Customer
from apps.documents.models import DocumentInstance
from apps.inventory.models import InventoryItem, InventoryStockMovement
from apps.inventory.services import (
    create_inventory_return_operation,
    validate_inventory_return_operation,
)
from apps.payments.models import Payment, PaymentKind, PaymentMethod, PaymentStatus
from apps.reservations.models import ReservationDraft

pytestmark = pytest.mark.django_db

DAMAGE_LOSS_SETTLEMENT_LIST_URL = "/api/v1/inventory/damage-loss-settlements/"


@pytest.fixture
def authenticated_client(client, django_user_model):
    user = django_user_model.objects.create_user(
        username="settlement-api-user",
        password="test-pass",
    )
    client.force_login(user)
    return client


def _inventory_item(name: str) -> InventoryItem:
    return InventoryItem.objects.create(
        name=name,
        kind="material",
        description=f"{name} description",
    )


def _reservation_draft() -> ReservationDraft:
    customer = Customer.objects.create(
        display_name="Settlement API customer",
        email="settlement-api@example.test",
        phone="+261340001003",
        address="Antananarivo",
    )
    start_at = timezone.now().replace(microsecond=0)
    end_at = start_at + timedelta(hours=4)
    return ReservationDraft.objects.create(
        customer=customer,
        start_at=start_at,
        end_at=end_at,
        notes="Settlement API reservation",
    )


def _validated_return_operation(django_user_model):
    actor = django_user_model.objects.create_user(
        username="settlement-api-helper",
        password="test-pass",
    )
    reservation_draft = _reservation_draft()
    return_operation = create_inventory_return_operation(
        actor=actor,
        reservation_draft=reservation_draft,
        lines=[
            {
                "inventory_item": _inventory_item("Settlement API item"),
                "expected_quantity": 2,
                "returned_quantity": 1,
                "damaged_quantity": 1,
                "missing_quantity": 1,
                "condition_status": "mixed",
                "notes": "API return line",
            }
        ],
    )
    result = validate_inventory_return_operation(return_operation=return_operation, actor=actor)
    return reservation_draft, result.return_operation


def _confirmed_caution_payment(django_user_model, reservation_draft, paid_at):
    actor = django_user_model.objects.create_user(
        username="settlement-api-payment",
        password="test-pass",
    )
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
        status="generated",
    )
    return Payment.objects.create(
        reservation_draft=reservation_draft,
        receipt_document=receipt,
        payment_kind=PaymentKind.CAUTION,
        payment_method=PaymentMethod.CASH,
        payment_status=PaymentStatus.CONFIRMED,
        amount=Decimal("60000.00"),
        paid_at=paid_at,
        source_label="Confirmed caution",
        confirmed_at=paid_at,
        confirmed_by=actor,
    )


def test_damage_loss_settlement_list_requires_authentication(client) -> None:
    response = client.get(DAMAGE_LOSS_SETTLEMENT_LIST_URL)

    assert response.status_code in {401, 403}


def test_authenticated_user_can_create_read_and_validate_damage_loss_settlement(
    authenticated_client,
    django_user_model,
) -> None:
    reservation_draft, return_operation = _validated_return_operation(django_user_model)
    _confirmed_caution_payment(
        django_user_model,
        reservation_draft,
        return_operation.validated_at,
    )
    before_payment_count = Payment.objects.count()
    before_document_count = DocumentInstance.objects.count()
    before_stock_movement_count = InventoryStockMovement.objects.count()
    return_operation_line = return_operation.lines.get()

    create_response = authenticated_client.post(
        DAMAGE_LOSS_SETTLEMENT_LIST_URL,
        data={
            "return_operation": str(return_operation.id),
            "notes": "Draft settlement",
            "lines": [
                {
                    "return_operation_line": str(return_operation_line.id),
                    "settlement_line_kind": "damage",
                    "quantity": 1,
                    "unit_amount": "20000.00",
                    "notes": "Broken element",
                },
                {
                    "manual_label": "Nettoyage",
                    "settlement_line_kind": "non_inventory_damage",
                    "quantity": 1,
                    "unit_amount": "5000.00",
                    "notes": "Manual fee",
                },
            ],
        },
        content_type="application/json",
    )

    assert create_response.status_code == 201
    payload = create_response.json()
    assert payload["settlement_status"] == "draft"
    assert len(payload["lines"]) == 2
    assert Payment.objects.count() == before_payment_count
    assert DocumentInstance.objects.count() == before_document_count
    assert InventoryStockMovement.objects.count() == before_stock_movement_count

    list_response = authenticated_client.get(DAMAGE_LOSS_SETTLEMENT_LIST_URL)
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1

    detail_response = authenticated_client.get(f"{DAMAGE_LOSS_SETTLEMENT_LIST_URL}{payload['id']}/")
    assert detail_response.status_code == 200
    assert detail_response.json()["id"] == payload["id"]

    validate_response = authenticated_client.post(
        f"{DAMAGE_LOSS_SETTLEMENT_LIST_URL}{payload['id']}/validate/",
        content_type="application/json",
    )
    assert validate_response.status_code == 200
    validated_payload = validate_response.json()
    assert validated_payload["settlement_status"] == "validated"
    assert Decimal(validated_payload["damage_loss_total"]) == Decimal("25000.00")
    assert Decimal(validated_payload["caution_available"]) == Decimal("60000.00")
    assert Decimal(validated_payload["refund_due"]) == Decimal("35000.00")
    assert Payment.objects.count() == before_payment_count
    assert DocumentInstance.objects.count() == before_document_count
    assert InventoryStockMovement.objects.count() == before_stock_movement_count


def test_damage_loss_settlement_create_rejects_draft_return_operation(
    authenticated_client,
    django_user_model,
) -> None:
    actor = django_user_model.objects.create_user(username="draft-return-api", password="test-pass")
    return_operation = create_inventory_return_operation(
        actor=actor,
        lines=[
            {
                "inventory_item": _inventory_item("Draft return settlement API"),
                "expected_quantity": 1,
                "returned_quantity": 1,
                "damaged_quantity": 0,
                "missing_quantity": 0,
                "condition_status": "intact",
                "notes": "",
            }
        ],
    )

    response = authenticated_client.post(
        DAMAGE_LOSS_SETTLEMENT_LIST_URL,
        data={
            "return_operation": str(return_operation.id),
            "lines": [
                {
                    "manual_label": "Manual fee",
                    "settlement_line_kind": "other",
                    "quantity": 1,
                    "unit_amount": "1000.00",
                    "notes": "",
                }
            ],
        },
        content_type="application/json",
    )

    assert response.status_code == 400
    assert response.json()["code"] == "invalid_damage_loss_settlement_return_operation_state"


def test_damage_loss_settlement_validate_rejects_second_validation(
    authenticated_client,
    django_user_model,
) -> None:
    _, return_operation = _validated_return_operation(django_user_model)
    create_response = authenticated_client.post(
        DAMAGE_LOSS_SETTLEMENT_LIST_URL,
        data={
            "return_operation": str(return_operation.id),
            "lines": [
                {
                    "return_operation_line": str(return_operation.lines.get().id),
                    "settlement_line_kind": "loss",
                    "quantity": 1,
                    "unit_amount": "20000.00",
                    "notes": "",
                }
            ],
        },
        content_type="application/json",
    )
    settlement_id = create_response.json()["id"]

    first_response = authenticated_client.post(
        f"{DAMAGE_LOSS_SETTLEMENT_LIST_URL}{settlement_id}/validate/",
        content_type="application/json",
    )
    second_response = authenticated_client.post(
        f"{DAMAGE_LOSS_SETTLEMENT_LIST_URL}{settlement_id}/validate/",
        content_type="application/json",
    )

    assert first_response.status_code == 200
    assert second_response.status_code == 400
    assert second_response.json()["code"] == "invalid_damage_loss_settlement_state"


@pytest.mark.parametrize("method", ["put", "patch", "delete"])
def test_damage_loss_settlement_detail_rejects_write_methods(
    authenticated_client,
    django_user_model,
    method: str,
) -> None:
    _, return_operation = _validated_return_operation(django_user_model)
    create_response = authenticated_client.post(
        DAMAGE_LOSS_SETTLEMENT_LIST_URL,
        data={
            "return_operation": str(return_operation.id),
            "lines": [
                {
                    "return_operation_line": str(return_operation.lines.get().id),
                    "settlement_line_kind": "damage",
                    "quantity": 1,
                    "unit_amount": "15000.00",
                    "notes": "",
                }
            ],
        },
        content_type="application/json",
    )
    settlement_id = create_response.json()["id"]
    request_method = getattr(authenticated_client, method)

    response = request_method(
        f"{DAMAGE_LOSS_SETTLEMENT_LIST_URL}{settlement_id}/",
        data={"notes": "changed"},
        content_type="application/json",
    )

    assert response.status_code == 405
