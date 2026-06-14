from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import uuid4

import pytest
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.documents import views as document_views
from apps.documents.commercial import (
    CommercialDocumentContext,
    CommercialDocumentCustomerContext,
    CommercialDocumentLineContext,
    CommercialDocumentReservationContext,
    CommercialDocumentReservationMarkerFlags,
    CommercialDocumentRuntimeScopeFlags,
    CommercialDocumentTemplateContext,
)
from apps.documents.views import TitanProformaDraftPreviewAPIView
from apps.reservations.models import ReservationDraft

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


@pytest.fixture
def api_factory():
    return APIRequestFactory()


@pytest.fixture
def authenticated_user():
    class User:
        is_authenticated = True

    return User()


def _preview_url(draft_id) -> str:
    return PREVIEW_PATH_TEMPLATE.format(draft_id=draft_id)


def _fake_context():
    draft_id = uuid4()
    customer_id = uuid4()
    line_id = uuid4()
    inventory_item_id = uuid4()
    start_at = datetime(2026, 6, 12, 8, 0, tzinfo=UTC)
    end_at = start_at + timedelta(hours=4)
    created_at = datetime(2026, 6, 11, 9, 0, tzinfo=UTC)
    updated_at = datetime(2026, 6, 11, 9, 5, tzinfo=UTC)

    return CommercialDocumentContext(
        template=CommercialDocumentTemplateContext(
            key=EXPECTED_TEMPLATE_KEY,
            business_scope="titan",
            document_type="proforma",
            label="Proforma Titan",
            version="v1",
            status="validated_source_template",
            source_kind="source_pdf",
            source_reference="docs/references/source/Document_A_CDC_Technique_Evenementiel_v3.4.pdf",
            template_path="backend/apps/documents/templates_documents/titan/proforma/v1/template.html",
            preview_path="backend/apps/documents/templates_documents/titan/proforma/v1/preview.pdf",
            validated_by_client=True,
            notes="Template notes",
        ),
        reservation_draft=CommercialDocumentReservationContext(
            reservation_draft_id=draft_id,
            public_reference="RD-TEST-TITAN-001",
            status="draft",
            customer=CommercialDocumentCustomerContext(
                customer_id=customer_id,
                display_name="Client Titan Demo",
                email="",
                phone="",
                address="",
            ),
            start_at=start_at,
            end_at=end_at,
            notes="Preview payload test.",
            lines=(
                CommercialDocumentLineContext(
                    reservation_draft_line_id=line_id,
                    inventory_item_id=inventory_item_id,
                    inventory_item_name="Projecteur Titan",
                    inventory_item_kind="material",
                    inventory_item_description="",
                    quantity=2,
                    notes="Line preview notes.",
                ),
            ),
            created_at=created_at,
            updated_at=updated_at,
        ),
        runtime_scope_flags=CommercialDocumentRuntimeScopeFlags(
            pdf_runtime_generated=False,
            inventory_blocked=False,
            payment_created=False,
            invoice_created=False,
            contract_created=False,
        ),
        reservation_marker_flags=CommercialDocumentReservationMarkerFlags(
            contract_signed_marker_present=False,
            required_deposit_received_marker_present=False,
            reservation_confirmed=True,
            reservation_cancelled=False,
        ),
    )


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
    context = _fake_context()
    view = TitanProformaDraftPreviewAPIView.as_view()
    request = _request(
        api_factory,
        "get",
        _preview_url(context.reservation_draft.reservation_draft_id),
    )

    response = view(request, reservation_draft_id=context.reservation_draft.reservation_draft_id)

    assert response.status_code in {401, 403}


def test_authenticated_user_can_preview_titan_proforma_payload(
    api_factory,
    authenticated_user,
    monkeypatch,
) -> None:
    context = _fake_context()
    monkeypatch.setattr(
        document_views,
        "get_reservation_draft_commercial_document_context_service",
        lambda **_: context,
    )

    view = TitanProformaDraftPreviewAPIView.as_view()
    request = _request(
        api_factory,
        "get",
        _preview_url(context.reservation_draft.reservation_draft_id),
        authenticated_user,
    )

    response = view(request, reservation_draft_id=context.reservation_draft.reservation_draft_id)

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
    assert reservation_draft["id"] == str(context.reservation_draft.reservation_draft_id)
    assert reservation_draft["public_reference"] == context.reservation_draft.public_reference
    assert reservation_draft["status"] == "draft"
    assert str(reservation_draft["customer_id"]) == str(
        context.reservation_draft.customer.customer_id
    )
    assert (
        reservation_draft["customer_display_name"]
        == context.reservation_draft.customer.display_name
    )
    assert reservation_draft["notes"] == context.reservation_draft.notes
    assert len(reservation_draft["lines"]) == 1

    line_payload = reservation_draft["lines"][0]
    line_context = context.reservation_draft.lines[0]
    assert line_payload["id"] == str(line_context.reservation_draft_line_id)
    assert str(line_payload["inventory_item_id"]) == str(line_context.inventory_item_id)
    assert line_payload["inventory_item_name"] == line_context.inventory_item_name
    assert line_payload["inventory_item_kind"] == line_context.inventory_item_kind
    assert line_payload["quantity"] == 2
    assert line_payload["notes"] == line_context.notes

    assert payload["scope_flags"] == EXPECTED_SCOPE_FLAGS


def test_titan_proforma_preview_returns_404_for_unknown_draft(
    api_factory,
    authenticated_user,
    monkeypatch,
) -> None:
    missing_id = uuid4()

    def _raise_missing(**_kwargs):
        raise ReservationDraft.DoesNotExist

    monkeypatch.setattr(
        document_views,
        "get_reservation_draft_commercial_document_context_service",
        _raise_missing,
    )

    view = TitanProformaDraftPreviewAPIView.as_view()
    request = _request(
        api_factory,
        "get",
        _preview_url(missing_id),
        authenticated_user,
    )

    response = view(request, reservation_draft_id=missing_id)

    assert response.status_code == 404


@pytest.mark.parametrize("method", WRITE_METHODS)
def test_titan_proforma_preview_is_get_only(
    api_factory,
    authenticated_user,
    method: str,
) -> None:
    context = _fake_context()
    view = TitanProformaDraftPreviewAPIView.as_view()
    request = _request(
        api_factory,
        method,
        _preview_url(context.reservation_draft.reservation_draft_id),
        authenticated_user,
    )

    response = view(request, reservation_draft_id=context.reservation_draft.reservation_draft_id)

    assert response.status_code == 405


def test_titan_proforma_preview_does_not_generate_pdf_file(
    api_factory,
    authenticated_user,
    monkeypatch,
) -> None:
    context = _fake_context()
    monkeypatch.setattr(
        document_views,
        "get_reservation_draft_commercial_document_context_service",
        lambda **_: context,
    )

    pdf_files_before = set(Path("backend/apps/documents").glob("**/*.pdf"))
    view = TitanProformaDraftPreviewAPIView.as_view()
    request = _request(
        api_factory,
        "get",
        _preview_url(context.reservation_draft.reservation_draft_id),
        authenticated_user,
    )

    response = view(request, reservation_draft_id=context.reservation_draft.reservation_draft_id)

    assert response.status_code == 200
    assert set(Path("backend/apps/documents").glob("**/*.pdf")) == pdf_files_before
    assert response.data["scope_flags"] == EXPECTED_SCOPE_FLAGS
