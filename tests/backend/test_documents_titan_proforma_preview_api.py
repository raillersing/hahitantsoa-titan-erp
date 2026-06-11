from datetime import UTC, datetime, timedelta
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

import pytest
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.documents import views as document_views
from apps.documents.views import TitanProformaDraftPreviewAPIView

EXPECTED_TEMPLATE_KEY = "titan.proforma.v1"
PREVIEW_PATH_TEMPLATE = "/api/v1/documents/titan/proforma-drafts/{draft_id}/preview/"
EXPECTED_SCOPE_FLAGS = {
    "pdf_runtime_generated": False,
    "reservation_confirmed": False,
    "inventory_blocked": False,
    "payment_created": False,
    "invoice_created": False,
    "contract_created": False,
}
WRITE_METHODS = ("post", "put", "patch", "delete")


class FakeReservationDraftQuerySet:
    def __init__(self, draft):
        self.draft = draft
        self.filters = []

    def filter(self, **kwargs):
        self.filters.append(kwargs)
        expected_id = kwargs.get("id")

        if self.draft is not None and self.draft.id == expected_id:
            return FakeReservationDraftQuerySet(self.draft)

        return FakeReservationDraftQuerySet(None)

    def first(self):
        return self.draft


@pytest.fixture
def api_factory():
    return APIRequestFactory()


@pytest.fixture
def authenticated_user():
    return SimpleNamespace(is_authenticated=True)


def _preview_url(draft_id) -> str:
    return PREVIEW_PATH_TEMPLATE.format(draft_id=draft_id)


def _fake_draft():
    start_at = datetime(2026, 6, 12, 8, 0, tzinfo=UTC)
    end_at = start_at + timedelta(hours=4)
    created_at = datetime(2026, 6, 11, 9, 0, tzinfo=UTC)
    updated_at = datetime(2026, 6, 11, 9, 5, tzinfo=UTC)

    customer = SimpleNamespace(
        id=uuid4(),
        pk=None,
        display_name="Client Titan Demo",
    )
    customer.pk = customer.id

    inventory_item = SimpleNamespace(
        id=uuid4(),
        pk=None,
        name="Projecteur Titan",
        kind="material",
    )
    inventory_item.pk = inventory_item.id

    line = SimpleNamespace(
        id=uuid4(),
        pk=None,
        inventory_item=inventory_item,
        quantity=2,
        notes="Line preview notes.",
    )
    line.pk = line.id

    draft = SimpleNamespace(
        id=uuid4(),
        pk=None,
        public_reference="RD-TEST-TITAN-001",
        status="draft",
        customer=customer,
        start_at=start_at,
        end_at=end_at,
        notes="Preview payload test.",
        lines=[line],
        created_at=created_at,
        updated_at=updated_at,
    )
    draft.pk = draft.id

    return draft, line


def _request(api_factory, method: str, path: str, authenticated_user=None):
    request_method = getattr(api_factory, method)

    if method in {"post", "put", "patch"}:
        request = request_method(path, data={}, format="json")
    else:
        request = request_method(path)

    if authenticated_user is not None:
        force_authenticate(request, user=authenticated_user)

    return request


def test_titan_proforma_preview_requires_authentication(api_factory) -> None:
    draft, _ = _fake_draft()
    view = TitanProformaDraftPreviewAPIView.as_view()
    request = _request(api_factory, "get", _preview_url(draft.id))

    response = view(request, reservation_draft_id=draft.id)

    assert response.status_code in {401, 403}


def test_authenticated_user_can_preview_titan_proforma_payload(
    api_factory,
    authenticated_user,
    monkeypatch,
) -> None:
    draft, line = _fake_draft()
    fake_queryset = FakeReservationDraftQuerySet(draft)
    monkeypatch.setattr(
        document_views,
        "active_reservation_drafts_for_document_preview",
        lambda: fake_queryset,
    )

    view = TitanProformaDraftPreviewAPIView.as_view()
    request = _request(
        api_factory,
        "get",
        _preview_url(draft.id),
        authenticated_user,
    )

    response = view(request, reservation_draft_id=draft.id)

    assert response.status_code == 200

    payload = response.data
    assert set(payload) == {
        "document_type",
        "business_scope",
        "template_key",
        "template",
        "reservation_draft",
        "scope_flags",
    }

    assert payload["document_type"] == "proforma"
    assert payload["business_scope"] == "titan"
    assert payload["template_key"] == EXPECTED_TEMPLATE_KEY

    template = payload["template"]
    assert template["key"] == EXPECTED_TEMPLATE_KEY
    assert template["business_scope"] == "titan"
    assert template["document_type"] == "proforma"
    assert template["validated_by_client"] is True

    reservation_draft = payload["reservation_draft"]
    assert reservation_draft["id"] == str(draft.id)
    assert reservation_draft["public_reference"] == draft.public_reference
    assert reservation_draft["status"] == "draft"
    assert str(reservation_draft["customer_id"]) == str(draft.customer.id)
    assert reservation_draft["customer_display_name"] == draft.customer.display_name
    assert reservation_draft["notes"] == draft.notes
    assert len(reservation_draft["lines"]) == 1

    line_payload = reservation_draft["lines"][0]
    assert line_payload["id"] == str(line.id)
    assert str(line_payload["inventory_item_id"]) == str(line.inventory_item.id)
    assert line_payload["inventory_item_name"] == line.inventory_item.name
    assert line_payload["inventory_item_kind"] == line.inventory_item.kind
    assert line_payload["quantity"] == 2
    assert line_payload["notes"] == line.notes

    assert payload["scope_flags"] == EXPECTED_SCOPE_FLAGS


def test_titan_proforma_preview_returns_404_for_unknown_draft(
    api_factory,
    authenticated_user,
    monkeypatch,
) -> None:
    draft, _ = _fake_draft()
    monkeypatch.setattr(
        document_views,
        "active_reservation_drafts_for_document_preview",
        lambda: FakeReservationDraftQuerySet(draft),
    )

    unknown_draft_id = uuid4()
    view = TitanProformaDraftPreviewAPIView.as_view()
    request = _request(
        api_factory,
        "get",
        _preview_url(unknown_draft_id),
        authenticated_user,
    )

    response = view(request, reservation_draft_id=unknown_draft_id)

    assert response.status_code == 404


def test_titan_proforma_preview_returns_404_when_active_queryset_has_no_draft(
    api_factory,
    authenticated_user,
    monkeypatch,
) -> None:
    draft, _ = _fake_draft()
    monkeypatch.setattr(
        document_views,
        "active_reservation_drafts_for_document_preview",
        lambda: FakeReservationDraftQuerySet(None),
    )

    view = TitanProformaDraftPreviewAPIView.as_view()
    request = _request(
        api_factory,
        "get",
        _preview_url(draft.id),
        authenticated_user,
    )

    response = view(request, reservation_draft_id=draft.id)

    assert response.status_code == 404


@pytest.mark.parametrize("method", WRITE_METHODS)
def test_titan_proforma_preview_is_get_only(
    api_factory,
    authenticated_user,
    method: str,
) -> None:
    draft, _ = _fake_draft()
    view = TitanProformaDraftPreviewAPIView.as_view()
    request = _request(
        api_factory,
        method,
        _preview_url(draft.id),
        authenticated_user,
    )

    response = view(request, reservation_draft_id=draft.id)

    assert response.status_code == 405


def test_titan_proforma_preview_does_not_generate_pdf_file(
    api_factory,
    authenticated_user,
    monkeypatch,
) -> None:
    draft, _ = _fake_draft()
    monkeypatch.setattr(
        document_views,
        "active_reservation_drafts_for_document_preview",
        lambda: FakeReservationDraftQuerySet(draft),
    )

    pdf_files_before = set(Path("backend/apps/documents").glob("**/*.pdf"))
    view = TitanProformaDraftPreviewAPIView.as_view()
    request = _request(
        api_factory,
        "get",
        _preview_url(draft.id),
        authenticated_user,
    )

    response = view(request, reservation_draft_id=draft.id)

    assert response.status_code == 200
    assert set(Path("backend/apps/documents").glob("**/*.pdf")) == pdf_files_before
    assert response.data["scope_flags"] == EXPECTED_SCOPE_FLAGS
