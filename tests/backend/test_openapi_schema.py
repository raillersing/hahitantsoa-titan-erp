OPENAPI_TITLE = "Hahitantsoa Titan ERP API"
INVENTORY_LIST_PATH = "/api/v1/inventory/items/"
INVENTORY_DETAIL_PATHS = (
    "/api/v1/inventory/items/{id}/",
    "/api/v1/inventory/items/{pk}/",
)
RESERVATION_AVAILABILITY_SUMMARY_PATH = "/api/v1/reservations/availability-summary/"
RESERVATION_AVAILABLE_ITEM_PREVIEWS_PATH = "/api/v1/reservations/available-item-previews/"
RESERVATION_ITEM_AVAILABILITY_PREVIEW_PATHS = (
    "/api/v1/reservations/items/{inventory_item_id}/availability-preview/",
    "/api/v1/reservations/items/{id}/availability-preview/",
)
HAHITANTSOA_DISCOVERY_ITEMS_PATH = "/api/v1/hahitantsoa/discovery-items/"
HAHITANTSOA_SHARED_AVAILABILITY_PATH = "/api/v1/hahitantsoa/shared-availability/"
DOCUMENT_TEMPLATE_REGISTRY_PATH = "/api/v1/documents/templates/"
DOCUMENT_TEMPLATE_DETAIL_PATHS = ("/api/v1/documents/templates/{template_key}/",)
TITAN_PROFORMA_DRAFT_PREVIEW_PATHS = (
    "/api/v1/documents/titan/proforma-drafts/{reservation_draft_id}/preview/",
)
WRITE_METHODS = {"post", "put", "patch", "delete"}


def _get_inventory_detail_path(paths: dict) -> str:
    for detail_path in INVENTORY_DETAIL_PATHS:
        if detail_path in paths:
            return detail_path

    expected_paths = ", ".join(INVENTORY_DETAIL_PATHS)
    raise AssertionError(f"Expected one inventory detail path among: {expected_paths}")


def _get_path(paths: dict, expected_paths: tuple[str, ...]) -> str:
    for expected_path in expected_paths:
        if expected_path in paths:
            return expected_path

    candidates = ", ".join(expected_paths)
    raise AssertionError(f"Expected one path among: {candidates}")


def _assert_get_only(path_operations: dict) -> None:
    assert "get" in path_operations
    assert WRITE_METHODS.isdisjoint(path_operations)


def _resolve_schema(schema: dict, schema_reference: dict) -> dict:
    if "$ref" not in schema_reference:
        return schema_reference

    reference = schema_reference["$ref"]
    component_name = reference.rsplit("/", maxsplit=1)[-1]
    return schema["components"]["schemas"][component_name]


def test_openapi_schema_exposes_confirmed_read_only_mvp_paths(client) -> None:
    response = client.get("/api/schema/?format=json")

    assert response.status_code == 200

    schema = response.json()
    assert "openapi" in schema
    assert "info" in schema
    assert "paths" in schema
    assert schema["info"]["title"] == OPENAPI_TITLE

    paths = schema["paths"]
    assert INVENTORY_LIST_PATH in paths
    detail_path = _get_inventory_detail_path(paths)
    item_availability_preview_path = _get_path(
        paths,
        RESERVATION_ITEM_AVAILABILITY_PREVIEW_PATHS,
    )
    document_template_detail_path = _get_path(
        paths,
        DOCUMENT_TEMPLATE_DETAIL_PATHS,
    )
    titan_proforma_draft_preview_path = _get_path(
        paths,
        TITAN_PROFORMA_DRAFT_PREVIEW_PATHS,
    )

    confirmed_read_only_paths = (
        INVENTORY_LIST_PATH,
        detail_path,
        RESERVATION_AVAILABILITY_SUMMARY_PATH,
        RESERVATION_AVAILABLE_ITEM_PREVIEWS_PATH,
        item_availability_preview_path,
        HAHITANTSOA_DISCOVERY_ITEMS_PATH,
        HAHITANTSOA_SHARED_AVAILABILITY_PATH,
        DOCUMENT_TEMPLATE_REGISTRY_PATH,
        document_template_detail_path,
        titan_proforma_draft_preview_path,
    )

    for path in confirmed_read_only_paths:
        assert path in paths
        _assert_get_only(paths[path])


def test_openapi_schema_exposes_minimal_hahitantsoa_discovery_contract(client) -> None:
    response = client.get("/api/schema/?format=json")

    assert response.status_code == 200

    schema = response.json()
    operation = schema["paths"][HAHITANTSOA_DISCOVERY_ITEMS_PATH]["get"]
    response_schema = operation["responses"]["200"]["content"]["application/json"]["schema"]
    discovery_response = _resolve_schema(schema, response_schema)

    assert set(discovery_response["properties"]) == {"items", "count"}
    assert discovery_response["required"] == ["count", "items"]

    item_reference = discovery_response["properties"]["items"]["items"]
    discovery_item = _resolve_schema(schema, item_reference)

    assert set(discovery_item["properties"]) == {"concept", "label"}
    assert discovery_item["required"] == ["concept", "label"]



def test_openapi_schema_exposes_hahitantsoa_shared_availability_contract(client) -> None:
    response = client.get("/api/schema/?format=json")

    assert response.status_code == 200

    schema = response.json()
    operation = schema["paths"][HAHITANTSOA_SHARED_AVAILABILITY_PATH]["get"]
    response_schema = operation["responses"]["200"]["content"]["application/json"]["schema"]
    availability_response = _resolve_schema(schema, response_schema)

    assert set(availability_response["properties"]) == {"items", "count"}
    assert availability_response["required"] == ["count", "items"]

    item_reference = availability_response["properties"]["items"]["items"]
    availability_item = _resolve_schema(schema, item_reference)

    assert set(availability_item["properties"]) == {
        "inventory_item_id",
        "inventory_item_name",
        "inventory_item_description",
        "inventory_item_kind",
        "start_at",
        "end_at",
        "status",
    }
    assert availability_item["required"] == [
        "end_at",
        "inventory_item_description",
        "inventory_item_id",
        "inventory_item_kind",
        "inventory_item_name",
        "start_at",
        "status",
    ]

def test_openapi_schema_exposes_documents_template_contract(client) -> None:
    response = client.get("/api/schema/?format=json")

    assert response.status_code == 200

    schema = response.json()
    paths = schema["paths"]
    detail_path = _get_path(paths, DOCUMENT_TEMPLATE_DETAIL_PATHS)

    registry_operation = paths[DOCUMENT_TEMPLATE_REGISTRY_PATH]["get"]
    registry_schema_reference = registry_operation["responses"]["200"]["content"][
        "application/json"
    ]["schema"]
    registry_response = _resolve_schema(schema, registry_schema_reference)

    assert {"items", "count"}.issubset(registry_response["properties"])

    item_reference = registry_response["properties"]["items"]["items"]
    template_definition = _resolve_schema(schema, item_reference)

    expected_template_fields = {
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
    assert expected_template_fields.issubset(template_definition["properties"])

    detail_operation = paths[detail_path]["get"]
    detail_schema_reference = detail_operation["responses"]["200"]["content"]["application/json"][
        "schema"
    ]
    detail_response = _resolve_schema(schema, detail_schema_reference)

    assert expected_template_fields.issubset(detail_response["properties"])


def test_openapi_schema_exposes_titan_proforma_preview_contract(client) -> None:
    response = client.get("/api/schema/?format=json")

    assert response.status_code == 200

    schema = response.json()
    paths = schema["paths"]
    preview_path = _get_path(paths, TITAN_PROFORMA_DRAFT_PREVIEW_PATHS)

    operation = paths[preview_path]["get"]
    response_schema_reference = operation["responses"]["200"]["content"]["application/json"][
        "schema"
    ]
    preview_response = _resolve_schema(schema, response_schema_reference)

    expected_preview_fields = {
        "document_type",
        "business_scope",
        "template_key",
        "template",
        "reservation_draft",
        "scope_flags",
    }
    assert expected_preview_fields.issubset(preview_response["properties"])

    scope_reference = preview_response["properties"]["scope_flags"]
    scope_flags = _resolve_schema(schema, scope_reference)
    assert {
        "pdf_runtime_generated",
        "reservation_confirmed",
        "inventory_blocked",
        "payment_created",
        "invoice_created",
        "contract_created",
    }.issubset(scope_flags["properties"])


def test_openapi_documentation_views_are_available(client) -> None:
    swagger_response = client.get("/api/docs/swagger/")
    redoc_response = client.get("/api/docs/redoc/")

    assert swagger_response.status_code == 200
    assert redoc_response.status_code == 200


def test_openapi_schema_exposes_reservation_draft_update_contract(client) -> None:
    response = client.get("/api/schema/?format=json")

    assert response.status_code == 200

    schema = response.json()
    paths = schema["paths"]
    draft_detail_path = _get_path(
        paths,
        (
            "/api/v1/reservations/drafts/{id}/",
            "/api/v1/reservations/drafts/{pk}/",
        ),
    )

    draft_detail_operations = paths[draft_detail_path]

    assert "get" in draft_detail_operations
    assert "put" in draft_detail_operations
    assert "patch" in draft_detail_operations
    assert "delete" not in draft_detail_operations
    assert "post" not in draft_detail_operations
