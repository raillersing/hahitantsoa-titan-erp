from datetime import timedelta
from decimal import Decimal

import pytest
from django.test import Client
from django.utils import timezone

from apps.audit.models import AuditEvent
from apps.customers.models import Customer
from apps.documents.models import DocumentInstance, NumberingSequence
from apps.hahitantsoa.models import HahitantsoaEventDraft, HahitantsoaEventDraftLine
from apps.inventory.models import InventoryAvailability, InventoryItem

pytestmark = pytest.mark.django_db
URL = "/api/v1/hahitantsoa/event-drafts/"


@pytest.fixture
def api(django_user_model):
    actor = django_user_model.objects.create_superuser("derived-validation", password="test-only")
    client = Client(raise_request_exception=False)
    client.force_login(actor)
    return client


def payload(customer, item):
    start = timezone.now().replace(microsecond=0) + timedelta(days=2)
    return {
        "customer_id": str(customer.id),
        "event_name": "Service range validation",
        "rental_type": "logistics",
        "start_at": start.isoformat(),
        "end_at": (start + timedelta(hours=4)).isoformat(),
        "lines": [{"inventory_item_id": str(item.id), "quantity": 1}],
    }


def counts():
    return tuple(
        model.objects.count()
        for model in (
            Customer,
            HahitantsoaEventDraft,
            HahitantsoaEventDraftLine,
            DocumentInstance,
            AuditEvent,
            InventoryAvailability,
        )
    ) + (tuple(NumberingSequence.objects.order_by("id").values_list("id", "next_number")),)


@pytest.mark.parametrize(
    "change,expected_field",
    [
        ({"service_notes": "DJ - 1000000000000 Ar"}, "total_amount"),
        ({"service_notes": "DJ - " + "9" * 80 + " Ar"}, "service_notes"),
        ({"guest_count": 2147483647}, "space_rental_amount"),
        ({"quantity": 3}, "logistics_amount"),
    ],
)
@pytest.mark.parametrize("updating", [False, True])
def test_derived_out_of_range_is_400_and_rolls_back(api, change, expected_field, updating):
    customer = Customer.objects.create(display_name="Existing client remains")
    item = InventoryItem.objects.create(
        name="Large-price material",
        kind="material",
        rental_price=Decimal("500000000000.00") if "quantity" in change else Decimal("100.00"),
    )
    request = payload(customer, item)
    if updating:
        created = api.post(URL, data=request, content_type="application/json")
        assert created.status_code == 201
        draft = HahitantsoaEventDraft.objects.get(pk=created.json()["id"])
        before_draft = (
            draft.event_name,
            draft.service_notes,
            draft.guest_count,
            draft.total_amount,
            draft.updated_by_id,
            draft.updated_at,
        )
        before_lines = list(
            draft.lines.values_list("id", "quantity", "unit_rental_price", "is_deleted")
        )
    before = counts()
    if "quantity" in change:
        request["lines"][0]["quantity"] = change["quantity"]
    else:
        request.update(change)
    request["event_name"] = "Must roll back"
    if updating:
        response = api.patch(f"{URL}{draft.id}/", data=request, content_type="application/json")
    else:
        response = api.post(URL, data=request, content_type="application/json")
    assert response.status_code == 400, response.content[:500]
    assert expected_field in response.json()
    assert counts() == before
    if updating:
        draft.refresh_from_db()
        assert (
            draft.event_name,
            draft.service_notes,
            draft.guest_count,
            draft.total_amount,
            draft.updated_by_id,
            draft.updated_at,
        ) == before_draft
        assert (
            list(draft.lines.values_list("id", "quantity", "unit_rental_price", "is_deleted"))
            == before_lines
        )
    retry_payload = payload(customer, item)
    if updating:
        retry = api.patch(f"{URL}{draft.id}/", data=retry_payload, content_type="application/json")
        assert retry.status_code == 200
        assert retry.json()["id"] == str(draft.id)
    else:
        retry = api.post(URL, data=retry_payload, content_type="application/json")
        assert retry.status_code == 201
    assert Customer.objects.count() == before[0]
    assert HahitantsoaEventDraft.objects.count() == before[1] + (0 if updating else 1)


@pytest.mark.parametrize("service_amount", ["1234.56", "999000000000.00"])
def test_valid_service_amounts_keep_existing_calculation(api, service_amount):
    customer = Customer.objects.create(display_name="Valid service customer")
    item = InventoryItem.objects.create(
        name="Normal material", kind="material", rental_price=Decimal("100.00")
    )
    request = payload(customer, item)
    request["service_notes"] = f"DJ - {service_amount} Ar"
    response = api.post(URL, data=request, content_type="application/json")
    assert response.status_code == 201, response.content[:500]
    data = response.json()
    assert Decimal(data["total_amount"]) == Decimal(data["space_rental_amount"]) + Decimal(
        "100.00"
    ) + Decimal(service_amount)


def test_document_configuration_validation_is_not_reported_as_input_error(api, monkeypatch):
    from django.core.exceptions import ValidationError

    def invalid_document_configuration(**kwargs):
        raise ValidationError({"template": "Invalid internal document configuration"})

    monkeypatch.setattr(
        "apps.documents.services.create_document_instance_from_hahitantsoa_event_draft",
        invalid_document_configuration,
    )
    customer = Customer.objects.create(display_name="Client survives internal failure")
    item = InventoryItem.objects.create(
        name="Normal material", kind="material", rental_price=Decimal("100.00")
    )
    before = counts()
    response = api.post(URL, data=payload(customer, item), content_type="application/json")
    assert response.status_code == 500
    assert counts() == before
