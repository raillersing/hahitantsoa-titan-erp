import sys
from datetime import timedelta

import pytest
from django.core.files.storage import FileSystemStorage
from django.test import Client
from django.utils import timezone

import apps.documents.runtime as runtime_module
from apps.customers.models import Customer
from apps.documents.models import DocumentInstanceStatus
from apps.hahitantsoa.models import HahitantsoaEventDraft, HahitantsoaEventDraftLine
from apps.inventory.models import InventoryItem

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def isolated_document_storage(tmp_path, monkeypatch):
    storage = FileSystemStorage(location=str(tmp_path))
    monkeypatch.setattr(runtime_module, "default_storage", storage)
    monkeypatch.setattr(sys.modules[__name__], "FileSystemStorage", FileSystemStorage)
    return storage


@pytest.fixture
def authenticated_client(django_user_model):
    client = Client()
    user = django_user_model.objects.create_user(
        username="hahitantsoa-docs-api-user",
        password="test-password",
    )
    client.force_login(user)
    client.test_user = user
    return client


def _customer() -> Customer:
    return Customer.objects.create(display_name="Hahitantsoa docs customer")


def _item() -> InventoryItem:
    return InventoryItem.objects.create(name="Shared speaker", kind="article")


def _event_draft(*, user) -> HahitantsoaEventDraft:
    start_at = timezone.now().replace(microsecond=0) + timedelta(days=1)
    end_at = start_at + timedelta(hours=4)
    draft = HahitantsoaEventDraft.objects.create(
        customer=_customer(),
        event_name="Corporate launch",
        venue_name="Grand hall",
        location_details="Level 2",
        service_notes="Sound and lighting",
        start_at=start_at,
        end_at=end_at,
        created_by=user,
        updated_by=user,
    )
    HahitantsoaEventDraftLine.objects.create(
        event_draft=draft,
        inventory_item=_item(),
        quantity=2,
        notes="Main audio line",
        created_by=user,
        updated_by=user,
    )
    return draft


def _documents_url(event_draft_id) -> str:
    return f"/api/v1/hahitantsoa/event-drafts/{event_draft_id}/documents/"


def _document_detail_url(event_draft_id, document_id) -> str:
    return f"/api/v1/hahitantsoa/event-drafts/{event_draft_id}/documents/{document_id}/"


def _document_generate_url(event_draft_id, document_id) -> str:
    return f"/api/v1/hahitantsoa/event-drafts/{event_draft_id}/documents/{document_id}/generate/"


def _document_generate_pdf_url(event_draft_id, document_id) -> str:
    return f"/api/v1/hahitantsoa/event-drafts/{event_draft_id}/documents/{document_id}/generate-pdf/"


def test_hahitantsoa_event_draft_document_list_create_and_generate(authenticated_client) -> None:
    draft = _event_draft(user=authenticated_client.test_user)

    create_response = authenticated_client.post(
        _documents_url(draft.id),
        data={"template_key": "hahitantsoa.contract.v1", "notes": "Prepared contract"},
        content_type="application/json",
    )

    assert create_response.status_code == 201
    created_payload = create_response.json()
    assert created_payload["hahitantsoa_event_draft"] == str(draft.id)
    assert created_payload["reservation_draft"] is None
    assert created_payload["template_key"] == "hahitantsoa.contract.v1"
    assert created_payload["status"] == DocumentInstanceStatus.PREPARED

    list_response = authenticated_client.get(_documents_url(draft.id))
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1

    detail_response = authenticated_client.get(
        _document_detail_url(draft.id, created_payload["id"])
    )
    assert detail_response.status_code == 200
    assert detail_response.json()["id"] == created_payload["id"]

    generate_response = authenticated_client.post(
        _document_generate_url(draft.id, created_payload["id"])
    )
    assert generate_response.status_code == 200
    generated_payload = generate_response.json()
    assert generated_payload["status"] == DocumentInstanceStatus.GENERATED
    assert generated_payload["storage_path"].endswith(".html")


def test_hahitantsoa_proforma_uses_configured_validity_from_first_pdf_issuance(
    authenticated_client,
) -> None:
    draft = _event_draft(user=authenticated_client.test_user)

    create_response = authenticated_client.post(
        _documents_url(draft.id),
        data={"template_key": "hahitantsoa.proforma.v1", "proforma_validity_days": 30},
        content_type="application/json",
    )

    assert create_response.status_code == 201
    created_payload = create_response.json()
    assert created_payload["template_key"] == "hahitantsoa.proforma.v1"
    assert created_payload["proforma_validity_days"] == 30
    assert created_payload["issued_at"] is None
    assert created_payload["valid_until"] is None

    html_response = authenticated_client.post(
        _document_generate_url(draft.id, created_payload["id"])
    )
    assert html_response.status_code == 200

    pdf_response = authenticated_client.post(
        _document_generate_pdf_url(draft.id, created_payload["id"])
    )
    assert pdf_response.status_code == 200
    assert pdf_response.json()["status"] == DocumentInstanceStatus.ISSUED

    detail_response = authenticated_client.get(
        _document_detail_url(draft.id, created_payload["id"])
    )
    assert detail_response.status_code == 200
    issued_payload = detail_response.json()
    assert issued_payload["proforma_validity_days"] == 30
    assert issued_payload["issued_at"] is not None
    assert issued_payload["valid_until"] is not None


def test_hahitantsoa_proforma_defaults_to_fifteen_days_before_issuance(
    authenticated_client,
) -> None:
    draft = _event_draft(user=authenticated_client.test_user)

    response = authenticated_client.post(
        _documents_url(draft.id),
        data={"template_key": "hahitantsoa.proforma.v1"},
        content_type="application/json",
    )

    assert response.status_code == 201
    assert response.json()["proforma_validity_days"] == 15
    assert response.json()["issued_at"] is None
    assert response.json()["valid_until"] is None


def test_hahitantsoa_event_draft_document_access_is_owner_scoped(
    authenticated_client,
    django_user_model,
) -> None:
    draft = _event_draft(user=authenticated_client.test_user)
    create_response = authenticated_client.post(
        _documents_url(draft.id),
        data={"template_key": "hahitantsoa.contract.v1"},
        content_type="application/json",
    )
    document_id = create_response.json()["id"]

    other_client = Client()
    other_user = django_user_model.objects.create_user(
        username="hahitantsoa-docs-api-other",
        password="test-password",
    )
    other_client.force_login(other_user)

    response = other_client.get(_document_detail_url(draft.id, document_id))
    assert response.status_code == 404
