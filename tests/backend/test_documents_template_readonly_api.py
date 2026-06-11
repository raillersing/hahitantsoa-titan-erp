from types import SimpleNamespace

import pytest
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.documents.views import (
    DocumentTemplateDefinitionAPIView,
    DocumentTemplateRegistryAPIView,
)

DOCUMENT_TEMPLATE_REGISTRY_PATH = "/api/v1/documents/templates/"
BREAKAGE_REPAIR_TEMPLATE_KEY = "shared.breakage_repair_invoice.v1"
BREAKAGE_REPAIR_TEMPLATE_PATH = f"/api/v1/documents/templates/{BREAKAGE_REPAIR_TEMPLATE_KEY}/"
UNKNOWN_TEMPLATE_KEY = "shared.unknown_template.v1"
UNKNOWN_TEMPLATE_PATH = f"/api/v1/documents/templates/{UNKNOWN_TEMPLATE_KEY}/"
EXPECTED_TEMPLATE_COUNT = 17
EXPECTED_BREAKAGE_TEMPLATE_SOURCE = (
    "docs/references/source/templates/Template_Facture_Casse_Remise_Etat_style_fidele_v5.pdf"
)
EXPECTED_TEMPLATE_FIELDS = {
    "key",
    "business_scope",
    "document_type",
    "label",
    "version",
    "status",
    "source_kind",
    "source_reference",
    "template_path",
    "preview_path",
    "validated_by_client",
    "notes",
}
WRITE_METHODS = ("post", "put", "patch", "delete")


@pytest.fixture
def api_factory():
    return APIRequestFactory()


@pytest.fixture
def authenticated_user():
    return SimpleNamespace(is_authenticated=True)


def _authenticated_request(api_factory, method, path, authenticated_user):
    request_method = getattr(api_factory, method)

    if method in {"post", "put", "patch"}:
        request = request_method(path, data={}, format="json")
    else:
        request = request_method(path)

    force_authenticate(request, user=authenticated_user)
    return request


def test_documents_template_registry_requires_authentication(api_factory):
    view = DocumentTemplateRegistryAPIView.as_view()
    request = api_factory.get(DOCUMENT_TEMPLATE_REGISTRY_PATH)

    response = view(request)

    assert response.status_code in {401, 403}


def test_documents_template_registry_lists_known_templates(
    api_factory,
    authenticated_user,
):
    view = DocumentTemplateRegistryAPIView.as_view()
    request = _authenticated_request(
        api_factory,
        "get",
        DOCUMENT_TEMPLATE_REGISTRY_PATH,
        authenticated_user,
    )

    response = view(request)

    assert response.status_code == 200
    assert set(response.data) == {"items", "count"}
    assert response.data["count"] == EXPECTED_TEMPLATE_COUNT
    assert len(response.data["items"]) == EXPECTED_TEMPLATE_COUNT

    template_keys = {item["key"] for item in response.data["items"]}
    assert BREAKAGE_REPAIR_TEMPLATE_KEY in template_keys

    for item in response.data["items"]:
        assert set(item) == EXPECTED_TEMPLATE_FIELDS


def test_documents_template_detail_exposes_breakage_repair_invoice_source(
    api_factory,
    authenticated_user,
):
    view = DocumentTemplateDefinitionAPIView.as_view()
    request = _authenticated_request(
        api_factory,
        "get",
        BREAKAGE_REPAIR_TEMPLATE_PATH,
        authenticated_user,
    )

    response = view(request, template_key=BREAKAGE_REPAIR_TEMPLATE_KEY)

    assert response.status_code == 200
    assert set(response.data) == EXPECTED_TEMPLATE_FIELDS
    assert response.data["key"] == BREAKAGE_REPAIR_TEMPLATE_KEY
    assert response.data["source_reference"] == EXPECTED_BREAKAGE_TEMPLATE_SOURCE
    assert response.data["preview_path"] == EXPECTED_BREAKAGE_TEMPLATE_SOURCE
    assert response.data["validated_by_client"] is True


def test_documents_template_detail_returns_404_for_unknown_key(
    api_factory,
    authenticated_user,
):
    view = DocumentTemplateDefinitionAPIView.as_view()
    request = _authenticated_request(
        api_factory,
        "get",
        UNKNOWN_TEMPLATE_PATH,
        authenticated_user,
    )

    response = view(request, template_key=UNKNOWN_TEMPLATE_KEY)

    assert response.status_code == 404


@pytest.mark.parametrize(
    ("path", "view_class", "view_kwargs"),
    [
        (
            DOCUMENT_TEMPLATE_REGISTRY_PATH,
            DocumentTemplateRegistryAPIView,
            {},
        ),
        (
            BREAKAGE_REPAIR_TEMPLATE_PATH,
            DocumentTemplateDefinitionAPIView,
            {"template_key": BREAKAGE_REPAIR_TEMPLATE_KEY},
        ),
    ],
)
@pytest.mark.parametrize("method", WRITE_METHODS)
def test_documents_template_endpoints_are_get_only(
    api_factory,
    authenticated_user,
    path,
    view_class,
    view_kwargs,
    method,
):
    view = view_class.as_view()
    request = _authenticated_request(
        api_factory,
        method,
        path,
        authenticated_user,
    )

    response = view(request, **view_kwargs)

    assert response.status_code == 405
