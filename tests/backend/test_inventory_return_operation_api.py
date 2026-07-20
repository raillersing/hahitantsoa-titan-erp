from datetime import timedelta

import pytest
from django.utils import timezone

from apps.customers.models import Customer
from apps.documents.models import DocumentInstance, DocumentInstanceStatus
from apps.inventory.models import (
    InventoryItem,
    InventoryReturnOperation,
    InventoryReturnOperationLine,
    InventoryReturnOperationStatus,
    InventoryStockMovement,
)
from apps.logistics.models import LogisticsEvent, LogisticsEventType
from apps.reservations.models import ReservationDraft

pytestmark = pytest.mark.django_db

RETURN_OPERATION_LIST_URL = "/api/v1/inventory/return-operations/"


@pytest.fixture
def authenticated_client(client, django_user_model):
    user = django_user_model.objects.create_user(
        username="return-api-user",
        password="test-pass",
    )
    client.force_login(user)
    return client


@pytest.fixture
def sensitive_user(django_user_model):
    return django_user_model.objects.create_user(
        username="return-sensitive-user",
        password="test-pass",
        is_staff=True,
    )


@pytest.fixture
def sensitive_client(sensitive_user):
    from django.test import Client

    client = Client()
    client.force_login(sensitive_user)
    return client


def _inventory_item(name: str) -> InventoryItem:
    return InventoryItem.objects.create(
        name=name,
        kind="material",
        description=f"{name} description",
    )


def _reservation_draft() -> ReservationDraft:
    customer = Customer.objects.create(
        display_name="Return API customer",
        email="return-api@example.test",
        phone="+261340000999",
        address="Antananarivo",
    )
    start_at = timezone.now().replace(microsecond=0) + timedelta(days=2)
    end_at = start_at + timedelta(hours=4)
    return ReservationDraft.objects.create(
        customer=customer,
        start_at=start_at,
        end_at=end_at,
        notes="Return API draft",
    )


def _document_instance(reservation_draft: ReservationDraft) -> DocumentInstance:
    return DocumentInstance.objects.create(
        reservation_draft=reservation_draft,
        customer=reservation_draft.customer,
        template_key="shared.return_note.v1",
        template_version="v1",
        template_label="Bon de retour",
        business_scope="shared",
        document_type="return_note",
        template_status="generated_draft_template",
        template_source_kind="generated_from_brand_style",
        template_source_reference="docs/references/source/Document_B_Presentation_Metier_Evenementiel_v3.4.pdf",
        template_path="backend/apps/documents/templates_documents/shared/return_note/v1/template.html",
        template_preview_path="backend/apps/documents/templates_documents/shared/return_note/v1/preview.pdf",
        template_validated_by_client=False,
        template_notes="Return note draft placeholder",
        reservation_public_reference=reservation_draft.public_reference,
        reservation_status=reservation_draft.status,
        customer_display_name=reservation_draft.customer.display_name,
        customer_email=reservation_draft.customer.email,
        customer_phone=reservation_draft.customer.phone,
        customer_address=reservation_draft.customer.address,
        status=DocumentInstanceStatus.PREPARED,
    )


def test_return_operation_list_requires_authentication(client) -> None:
    response = client.get(RETURN_OPERATION_LIST_URL)

    assert response.status_code in {401, 403}


def test_sensitive_user_can_create_validate_and_authenticated_user_can_read_return_operation(
    sensitive_client,
    authenticated_client,
) -> None:
    reservation_draft = _reservation_draft()
    document_instance = _document_instance(reservation_draft)
    intact_item = _inventory_item("Return API intact")
    mixed_item = _inventory_item("Return API mixed")

    create_response = sensitive_client.post(
        RETURN_OPERATION_LIST_URL,
        data={
            "reservation_draft": str(reservation_draft.id),
            "document_instance": str(document_instance.id),
            "notes": "Client return inspection",
            "lines": [
                {
                    "inventory_item": str(intact_item.id),
                    "expected_quantity": 1,
                    "returned_quantity": 1,
                    "damaged_quantity": 0,
                    "missing_quantity": 0,
                    "condition_status": "intact",
                    "notes": "One intact",
                },
                {
                    "inventory_item": str(mixed_item.id),
                    "expected_quantity": 3,
                    "returned_quantity": 2,
                    "damaged_quantity": 1,
                    "missing_quantity": 1,
                    "condition_status": "mixed",
                    "notes": "One intact, one damaged, one missing",
                },
            ],
        },
        content_type="application/json",
    )

    assert create_response.status_code == 201
    payload = create_response.json()
    assert payload["status"] == InventoryReturnOperationStatus.DRAFT
    assert len(payload["lines"]) == 2
    assert InventoryStockMovement.objects.count() == 0

    list_response = authenticated_client.get(RETURN_OPERATION_LIST_URL)
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1

    detail_response = authenticated_client.get(f"{RETURN_OPERATION_LIST_URL}{payload['id']}/")
    assert detail_response.status_code == 200
    assert detail_response.json()["id"] == payload["id"]

    validate_response = sensitive_client.post(
        f"{RETURN_OPERATION_LIST_URL}{payload['id']}/validate/",
        content_type="application/json",
    )
    assert validate_response.status_code == 200
    validated_payload = validate_response.json()
    assert validated_payload["status"] == InventoryReturnOperationStatus.VALIDATED
    assert InventoryStockMovement.objects.filter(return_operation_id=payload["id"]).count() == 4


def test_sensitive_user_can_create_return_with_logistics_event_link(sensitive_client) -> None:
    draft = _reservation_draft()
    event = LogisticsEvent.objects.create(
        reservation_draft=draft,
        event_type=LogisticsEventType.HANDOVER,
    )
    item = _inventory_item("Return event item")

    response = sensitive_client.post(
        RETURN_OPERATION_LIST_URL,
        data={
            "reservation_draft": str(draft.id),
            "logistics_event": str(event.id),
            "notes": "Return from logistics event",
            "lines": [
                {
                    "inventory_item": str(item.id),
                    "expected_quantity": 1,
                    "returned_quantity": 1,
                    "damaged_quantity": 0,
                    "missing_quantity": 0,
                    "condition_status": "intact",
                    "notes": "",
                },
            ],
        },
        content_type="application/json",
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["reservation_draft"] == str(draft.id)

    # Verify through the reverse relation
    return_op = InventoryReturnOperation.objects.get(id=payload["id"])
    assert list(event.return_operations.all()) == [return_op]


def test_return_operation_create_requires_authentication(client) -> None:
    response = client.post(
        RETURN_OPERATION_LIST_URL,
        data={"notes": "Anon attempt"},
        content_type="application/json",
    )

    assert response.status_code in {401, 403}


def test_return_operation_create_requires_sensitive_access(authenticated_client) -> None:
    response = authenticated_client.post(
        RETURN_OPERATION_LIST_URL,
        data={"notes": "Non-sensitive attempt"},
        content_type="application/json",
    )

    assert response.status_code == 403


def test_return_operation_validate_requires_sensitive_access(
    sensitive_client,
    authenticated_client,
) -> None:
    intact_item = _inventory_item("Return API validate split")

    create_response = sensitive_client.post(
        RETURN_OPERATION_LIST_URL,
        data={
            "lines": [
                {
                    "inventory_item": str(intact_item.id),
                    "expected_quantity": 1,
                    "returned_quantity": 1,
                    "damaged_quantity": 0,
                    "missing_quantity": 0,
                    "condition_status": "intact",
                    "notes": "",
                }
            ]
        },
        content_type="application/json",
    )
    return_operation_id = create_response.json()["id"]

    response = authenticated_client.post(
        f"{RETURN_OPERATION_LIST_URL}{return_operation_id}/validate/",
        content_type="application/json",
    )

    assert response.status_code == 403


def test_return_operation_validate_rejects_second_validation(sensitive_client) -> None:
    item = _inventory_item("Return API revalidate")
    create_response = sensitive_client.post(
        RETURN_OPERATION_LIST_URL,
        data={
            "lines": [
                {
                    "inventory_item": str(item.id),
                    "expected_quantity": 1,
                    "returned_quantity": 1,
                    "damaged_quantity": 0,
                    "missing_quantity": 0,
                    "condition_status": "intact",
                    "notes": "",
                }
            ]
        },
        content_type="application/json",
    )
    return_operation_id = create_response.json()["id"]

    first_response = sensitive_client.post(
        f"{RETURN_OPERATION_LIST_URL}{return_operation_id}/validate/",
        content_type="application/json",
    )
    second_response = sensitive_client.post(
        f"{RETURN_OPERATION_LIST_URL}{return_operation_id}/validate/",
        content_type="application/json",
    )

    assert first_response.status_code == 200
    assert second_response.status_code == 400
    assert second_response.json()["code"] == "invalid_return_operation_state"


@pytest.mark.parametrize("method", ["put", "patch", "delete"])
def test_return_operation_detail_rejects_write_methods(sensitive_client, method: str) -> None:
    item = _inventory_item("Return API immutable")
    create_response = sensitive_client.post(
        RETURN_OPERATION_LIST_URL,
        data={
            "lines": [
                {
                    "inventory_item": str(item.id),
                    "expected_quantity": 1,
                    "returned_quantity": 1,
                    "damaged_quantity": 0,
                    "missing_quantity": 0,
                    "condition_status": "intact",
                    "notes": "",
                }
            ]
        },
        content_type="application/json",
    )
    return_operation_id = create_response.json()["id"]
    request_method = getattr(sensitive_client, method)

    response = request_method(
        f"{RETURN_OPERATION_LIST_URL}{return_operation_id}/",
        data={"notes": "changed"},
        content_type="application/json",
    )

    assert response.status_code == 405


def test_return_operation_list_filter_by_status(authenticated_client, django_user_model):
    item = _inventory_item("Filter status")
    user = django_user_model.objects.create_user(username="validator", password="pass")
    matching = InventoryReturnOperation.objects.create(
        status=InventoryReturnOperationStatus.VALIDATED,
        validated_at=timezone.now(),
        validated_by=user,
    )
    InventoryReturnOperationLine.objects.create(
        return_operation=matching,
        inventory_item=item,
        expected_quantity=1,
        returned_quantity=1,
        damaged_quantity=0,
        missing_quantity=0,
        condition_status="intact",
    )
    other = InventoryReturnOperation.objects.create(
        status=InventoryReturnOperationStatus.DRAFT,
    )
    InventoryReturnOperationLine.objects.create(
        return_operation=other,
        inventory_item=item,
        expected_quantity=1,
        returned_quantity=1,
        damaged_quantity=0,
        missing_quantity=0,
        condition_status="intact",
    )
    response = authenticated_client.get(f"{RETURN_OPERATION_LIST_URL}?status=validated")
    assert response.status_code == 200
    results = response.json()
    assert len(results) == 1
    assert results[0]["id"] == str(matching.id)


def test_return_operation_list_filter_by_reservation_draft(authenticated_client):
    item = _inventory_item("Filter draft")
    draft = _reservation_draft()
    matching = InventoryReturnOperation.objects.create(
        reservation_draft=draft,
        status=InventoryReturnOperationStatus.DRAFT,
    )
    InventoryReturnOperationLine.objects.create(
        return_operation=matching,
        inventory_item=item,
        expected_quantity=1,
        returned_quantity=1,
        damaged_quantity=0,
        missing_quantity=0,
        condition_status="intact",
    )
    other = InventoryReturnOperation.objects.create(
        status=InventoryReturnOperationStatus.DRAFT,
    )
    InventoryReturnOperationLine.objects.create(
        return_operation=other,
        inventory_item=item,
        expected_quantity=1,
        returned_quantity=1,
        damaged_quantity=0,
        missing_quantity=0,
        condition_status="intact",
    )
    response = authenticated_client.get(
        f"{RETURN_OPERATION_LIST_URL}?reservation_draft={str(draft.id)}"
    )
    assert response.status_code == 200
    results = response.json()
    assert len(results) == 1
    assert results[0]["id"] == str(matching.id)
