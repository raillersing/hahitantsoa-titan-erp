OPENAPI_TITLE = "Hahitantsoa Titan ERP API"
INVENTORY_LIST_PATH = "/api/v1/inventory/items/"
INVENTORY_DETAIL_PATHS = (
    "/api/v1/inventory/items/{id}/",
    "/api/v1/inventory/items/{pk}/",
)
INVENTORY_STOCK_MOVEMENT_LIST_PATH = "/api/v1/inventory/stock-movements/"
INVENTORY_STOCK_MOVEMENT_DETAIL_PATH = "/api/v1/inventory/stock-movements/{id}/"
INVENTORY_RETURN_OPERATION_LIST_PATH = "/api/v1/inventory/return-operations/"
INVENTORY_RETURN_OPERATION_DETAIL_PATH = "/api/v1/inventory/return-operations/{id}/"
INVENTORY_RETURN_OPERATION_VALIDATE_PATH = "/api/v1/inventory/return-operations/{id}/validate/"
INVENTORY_DAMAGE_LOSS_SETTLEMENT_LIST_PATH = "/api/v1/inventory/damage-loss-settlements/"
INVENTORY_DAMAGE_LOSS_SETTLEMENT_DETAIL_PATH = "/api/v1/inventory/damage-loss-settlements/{id}/"
INVENTORY_DAMAGE_LOSS_SETTLEMENT_VALIDATE_PATH = (
    "/api/v1/inventory/damage-loss-settlements/{id}/validate/"
)
INVENTORY_DAMAGE_LOSS_SETTLEMENT_EXECUTION_LIST_PATH = (
    "/api/v1/inventory/damage-loss-settlement-executions/"
)
INVENTORY_DAMAGE_LOSS_SETTLEMENT_EXECUTION_DETAIL_PATH = (
    "/api/v1/inventory/damage-loss-settlement-executions/{id}/"
)
INVENTORY_DAMAGE_LOSS_SETTLEMENT_EXECUTION_EXECUTE_PATH = (
    "/api/v1/inventory/damage-loss-settlement-executions/{id}/execute/"
)
RESERVATION_AVAILABILITY_SUMMARY_PATH = "/api/v1/reservations/availability-summary/"
RESERVATION_AVAILABLE_ITEM_PREVIEWS_PATH = "/api/v1/reservations/available-item-previews/"
RESERVATION_ITEM_AVAILABILITY_PREVIEW_PATHS = (
    "/api/v1/reservations/items/{inventory_item_id}/availability-preview/",
    "/api/v1/reservations/items/{id}/availability-preview/",
)
HAHITANTSOA_DISCOVERY_ITEMS_PATH = "/api/v1/hahitantsoa/discovery-items/"
HAHITANTSOA_SHARED_AVAILABILITY_PATH = "/api/v1/hahitantsoa/shared-availability/"
HAHITANTSOA_EVENT_DRAFT_LIST_PATH = "/api/v1/hahitantsoa/event-drafts/"
HAHITANTSOA_EVENT_DRAFT_DETAIL_PATHS = (
    "/api/v1/hahitantsoa/event-drafts/{id}/",
    "/api/v1/hahitantsoa/event-drafts/{pk}/",
)
HAHITANTSOA_EVENT_DRAFT_AVAILABILITY_PREVIEW_PATHS = (
    "/api/v1/hahitantsoa/event-drafts/{id}/availability-preview/",
    "/api/v1/hahitantsoa/event-drafts/{pk}/availability-preview/",
)
HAHITANTSOA_EVENT_DRAFT_CONFIRMATION_PREFLIGHT_PATHS = (
    "/api/v1/hahitantsoa/event-drafts/{id}/confirmation-preflight/",
    "/api/v1/hahitantsoa/event-drafts/{pk}/confirmation-preflight/",
)
HAHITANTSOA_EVENT_DRAFT_AMENDMENT_PREFLIGHT_PATHS = (
    "/api/v1/hahitantsoa/event-drafts/{id}/amendment-preflight/",
    "/api/v1/hahitantsoa/event-drafts/{pk}/amendment-preflight/",
)
HAHITANTSOA_EVENT_DRAFT_AMENDMENT_REQUEST_LIST_PATH = (
    "/api/v1/hahitantsoa/event-drafts/{event_draft_pk}/amendment-requests/"
)
HAHITANTSOA_EVENT_DRAFT_AMENDMENT_REQUEST_DETAIL_PATH = (
    "/api/v1/hahitantsoa/event-drafts/{event_draft_pk}/amendment-requests/{id}/"
)
HAHITANTSOA_EVENT_DRAFT_AMENDMENT_REQUEST_AVAILABILITY_PREFLIGHT_PATH = (
    "/api/v1/hahitantsoa/event-drafts/{event_draft_pk}/amendment-requests/"
    "{amendment_request_pk}/availability-preflight/"
)
HAHITANTSOA_EVENT_DRAFT_AMENDMENT_REQUEST_LINE_LIST_PATH = (
    "/api/v1/hahitantsoa/event-drafts/{event_draft_pk}/amendment-requests/"
    "{amendment_request_pk}/lines/"
)
HAHITANTSOA_EVENT_DRAFT_AMENDMENT_REQUEST_LINE_DETAIL_PATH = (
    "/api/v1/hahitantsoa/event-drafts/{event_draft_pk}/amendment-requests/"
    "{amendment_request_pk}/lines/{id}/"
)
HAHITANTSOA_EVENT_DRAFT_CONFIRM_PATHS = (
    "/api/v1/hahitantsoa/event-drafts/{id}/confirm/",
    "/api/v1/hahitantsoa/event-drafts/{pk}/confirm/",
)
DOCUMENT_TEMPLATE_REGISTRY_PATH = "/api/v1/documents/templates/"
DOCUMENT_TEMPLATE_DETAIL_PATHS = ("/api/v1/documents/templates/{template_key}/",)
TITAN_PROFORMA_DRAFT_PREVIEW_PATHS = (
    "/api/v1/documents/titan/proforma-drafts/{reservation_draft_id}/preview/",
)
PAYMENT_LIST_PATH = "/api/v1/payments/"
PAYMENT_DETAIL_PATH = "/api/v1/payments/{id}/"
PAYMENT_CONFIRM_PATH = "/api/v1/payments/{id}/confirm/"
BILLING_INVOICE_LIST_PATH = "/api/v1/billing/invoices/"
BILLING_INVOICE_DETAIL_PATH = "/api/v1/billing/invoices/{id}/"
BILLING_INVOICE_SETTLE_PATH = "/api/v1/billing/invoices/{id}/settle/"
RESERVATION_DRAFT_DOCUMENT_INSTANCE_LIST_PATH = (
    "/api/v1/documents/reservation-drafts/{reservation_draft_id}/instances/"
)
RESERVATION_DRAFT_DOCUMENT_INSTANCE_DETAIL_PATH = (
    "/api/v1/documents/reservation-drafts/{reservation_draft_id}/instances/{id}/"
)
RESERVATION_DRAFT_DOCUMENT_INSTANCE_GENERATE_PATH = (
    "/api/v1/documents/reservation-drafts/{reservation_draft_id}/instances/{id}/generate/"
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
    if "allOf" in schema_reference and len(schema_reference["allOf"]) == 1:
        return _resolve_schema(schema, schema_reference["allOf"][0])

    if "oneOf" in schema_reference and len(schema_reference["oneOf"]) == 1:
        return _resolve_schema(schema, schema_reference["oneOf"][0])

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

    assert RESERVATION_DRAFT_DOCUMENT_INSTANCE_LIST_PATH in paths
    assert set(paths[RESERVATION_DRAFT_DOCUMENT_INSTANCE_LIST_PATH]) >= {"get", "post"}
    assert RESERVATION_DRAFT_DOCUMENT_INSTANCE_DETAIL_PATH in paths
    _assert_get_only(paths[RESERVATION_DRAFT_DOCUMENT_INSTANCE_DETAIL_PATH])
    assert RESERVATION_DRAFT_DOCUMENT_INSTANCE_GENERATE_PATH in paths
    assert set(paths[RESERVATION_DRAFT_DOCUMENT_INSTANCE_GENERATE_PATH]) == {"post"}
    assert PAYMENT_LIST_PATH in paths
    assert set(paths[PAYMENT_LIST_PATH]) >= {"get", "post"}
    assert PAYMENT_DETAIL_PATH in paths
    _assert_get_only(paths[PAYMENT_DETAIL_PATH])
    assert PAYMENT_CONFIRM_PATH in paths
    assert set(paths[PAYMENT_CONFIRM_PATH]) == {"post"}
    assert BILLING_INVOICE_LIST_PATH in paths
    _assert_get_only(paths[BILLING_INVOICE_LIST_PATH])
    assert BILLING_INVOICE_DETAIL_PATH in paths
    _assert_get_only(paths[BILLING_INVOICE_DETAIL_PATH])
    assert BILLING_INVOICE_SETTLE_PATH in paths
    assert set(paths[BILLING_INVOICE_SETTLE_PATH]) == {"post"}
    assert INVENTORY_STOCK_MOVEMENT_LIST_PATH in paths
    assert set(paths[INVENTORY_STOCK_MOVEMENT_LIST_PATH]) >= {"get", "post"}
    assert INVENTORY_STOCK_MOVEMENT_DETAIL_PATH in paths
    _assert_get_only(paths[INVENTORY_STOCK_MOVEMENT_DETAIL_PATH])
    assert INVENTORY_RETURN_OPERATION_LIST_PATH in paths
    assert set(paths[INVENTORY_RETURN_OPERATION_LIST_PATH]) >= {"get", "post"}
    assert INVENTORY_RETURN_OPERATION_DETAIL_PATH in paths
    _assert_get_only(paths[INVENTORY_RETURN_OPERATION_DETAIL_PATH])
    assert INVENTORY_RETURN_OPERATION_VALIDATE_PATH in paths
    assert set(paths[INVENTORY_RETURN_OPERATION_VALIDATE_PATH]) == {"post"}
    assert INVENTORY_DAMAGE_LOSS_SETTLEMENT_LIST_PATH in paths
    assert set(paths[INVENTORY_DAMAGE_LOSS_SETTLEMENT_LIST_PATH]) >= {"get", "post"}
    assert INVENTORY_DAMAGE_LOSS_SETTLEMENT_DETAIL_PATH in paths
    _assert_get_only(paths[INVENTORY_DAMAGE_LOSS_SETTLEMENT_DETAIL_PATH])
    assert INVENTORY_DAMAGE_LOSS_SETTLEMENT_VALIDATE_PATH in paths
    assert set(paths[INVENTORY_DAMAGE_LOSS_SETTLEMENT_VALIDATE_PATH]) == {"post"}
    assert INVENTORY_DAMAGE_LOSS_SETTLEMENT_EXECUTION_LIST_PATH in paths
    assert set(paths[INVENTORY_DAMAGE_LOSS_SETTLEMENT_EXECUTION_LIST_PATH]) >= {"get", "post"}
    assert INVENTORY_DAMAGE_LOSS_SETTLEMENT_EXECUTION_DETAIL_PATH in paths
    _assert_get_only(paths[INVENTORY_DAMAGE_LOSS_SETTLEMENT_EXECUTION_DETAIL_PATH])
    assert INVENTORY_DAMAGE_LOSS_SETTLEMENT_EXECUTION_EXECUTE_PATH in paths
    assert set(paths[INVENTORY_DAMAGE_LOSS_SETTLEMENT_EXECUTION_EXECUTE_PATH]) == {"post"}


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


def test_openapi_schema_exposes_hahitantsoa_event_draft_paths_and_contract(client) -> None:
    response = client.get("/api/schema/?format=json")

    assert response.status_code == 200

    schema = response.json()
    paths = schema["paths"]
    detail_path = _get_path(paths, HAHITANTSOA_EVENT_DRAFT_DETAIL_PATHS)

    assert HAHITANTSOA_EVENT_DRAFT_LIST_PATH in paths
    assert set(paths[HAHITANTSOA_EVENT_DRAFT_LIST_PATH]) >= {"get", "post"}
    assert "put" not in paths[HAHITANTSOA_EVENT_DRAFT_LIST_PATH]
    assert "patch" not in paths[HAHITANTSOA_EVENT_DRAFT_LIST_PATH]
    assert "delete" not in paths[HAHITANTSOA_EVENT_DRAFT_LIST_PATH]
    assert detail_path in paths
    assert set(paths[detail_path]) >= {"get", "put", "patch", "delete"}

    availability_preview_path = _get_path(paths, HAHITANTSOA_EVENT_DRAFT_AVAILABILITY_PREVIEW_PATHS)
    assert availability_preview_path in paths
    _assert_get_only(paths[availability_preview_path])
    confirmation_preflight_path = _get_path(
        paths,
        HAHITANTSOA_EVENT_DRAFT_CONFIRMATION_PREFLIGHT_PATHS,
    )
    assert confirmation_preflight_path in paths
    _assert_get_only(paths[confirmation_preflight_path])
    amendment_preflight_path = _get_path(paths, HAHITANTSOA_EVENT_DRAFT_AMENDMENT_PREFLIGHT_PATHS)
    assert amendment_preflight_path in paths
    _assert_get_only(paths[amendment_preflight_path])
    assert HAHITANTSOA_EVENT_DRAFT_AMENDMENT_REQUEST_LIST_PATH in paths
    assert set(paths[HAHITANTSOA_EVENT_DRAFT_AMENDMENT_REQUEST_LIST_PATH]) >= {"get", "post"}
    assert HAHITANTSOA_EVENT_DRAFT_AMENDMENT_REQUEST_DETAIL_PATH in paths
    assert set(paths[HAHITANTSOA_EVENT_DRAFT_AMENDMENT_REQUEST_DETAIL_PATH]) >= {
        "get",
        "put",
        "patch",
    }
    assert "delete" not in paths[HAHITANTSOA_EVENT_DRAFT_AMENDMENT_REQUEST_DETAIL_PATH]
    assert HAHITANTSOA_EVENT_DRAFT_AMENDMENT_REQUEST_AVAILABILITY_PREFLIGHT_PATH in paths
    _assert_get_only(paths[HAHITANTSOA_EVENT_DRAFT_AMENDMENT_REQUEST_AVAILABILITY_PREFLIGHT_PATH])
    assert HAHITANTSOA_EVENT_DRAFT_AMENDMENT_REQUEST_LINE_LIST_PATH in paths
    assert set(paths[HAHITANTSOA_EVENT_DRAFT_AMENDMENT_REQUEST_LINE_LIST_PATH]) >= {
        "get",
        "post",
    }
    assert HAHITANTSOA_EVENT_DRAFT_AMENDMENT_REQUEST_LINE_DETAIL_PATH in paths
    assert set(paths[HAHITANTSOA_EVENT_DRAFT_AMENDMENT_REQUEST_LINE_DETAIL_PATH]) >= {
        "get",
        "put",
        "patch",
        "delete",
    }
    confirmation_path = _get_path(paths, HAHITANTSOA_EVENT_DRAFT_CONFIRM_PATHS)
    assert confirmation_path in paths
    assert set(paths[confirmation_path]) == {"post"}

    create_operation = paths[HAHITANTSOA_EVENT_DRAFT_LIST_PATH]["post"]
    response_schema = create_operation["responses"]["201"]["content"]["application/json"]["schema"]
    draft_schema = _resolve_schema(schema, response_schema)

    expected_fields = {
        "id",
        "public_reference",
        "status",
        "customer_id",
        "customer_display_name",
        "event_name",
        "venue_name",
        "location_details",
        "service_notes",
        "start_at",
        "end_at",
        "notes",
        "lines",
        "prerequisite_status",
        "created_at",
        "updated_at",
    }
    assert expected_fields.issubset(draft_schema["properties"])

    prerequisite_schema = _resolve_schema(schema, draft_schema["properties"]["prerequisite_status"])
    assert {"contract", "deposit", "ready_for_confirmation"}.issubset(
        prerequisite_schema["properties"]
    )

    line_reference = draft_schema["properties"]["lines"]["items"]
    line_schema = _resolve_schema(schema, line_reference)
    assert {
        "id",
        "inventory_item_id",
        "inventory_item_name",
        "inventory_item_kind",
        "quantity",
        "notes",
    }.issubset(line_schema["properties"])

    preview_operation = paths[availability_preview_path]["get"]
    preview_schema_reference = preview_operation["responses"]["200"]["content"]["application/json"][
        "schema"
    ]
    preview_schema = _resolve_schema(schema, preview_schema_reference)
    assert {
        "event_draft_id",
        "public_reference",
        "start_at",
        "end_at",
        "line_count",
        "available_line_count",
        "unavailable_line_count",
        "lines",
    }.issubset(preview_schema["properties"])

    preview_line_reference = preview_schema["properties"]["lines"]["items"]
    preview_line_schema = _resolve_schema(schema, preview_line_reference)
    assert {
        "event_draft_line_id",
        "quantity",
        "inventory_item_id",
        "inventory_item_name",
        "inventory_item_kind",
        "status",
        "conflict_count",
    }.issubset(preview_line_schema["properties"])

    confirmation_preflight_path = _get_path(
        paths, HAHITANTSOA_EVENT_DRAFT_CONFIRMATION_PREFLIGHT_PATHS
    )
    confirmation_preflight_operation = paths[confirmation_preflight_path]["get"]
    confirmation_preflight_schema = _resolve_schema(
        schema,
        confirmation_preflight_operation["responses"]["200"]["content"]["application/json"][
            "schema"
        ],
    )
    assert {"prerequisite_status"}.issubset(confirmation_preflight_schema["properties"])

    confirmation_preflight_operation = paths[confirmation_preflight_path]["get"]
    confirmation_preflight_schema_reference = confirmation_preflight_operation["responses"]["200"][
        "content"
    ]["application/json"]["schema"]
    confirmation_preflight_schema = _resolve_schema(schema, confirmation_preflight_schema_reference)
    assert {
        "event_draft_id",
        "public_reference",
        "status",
        "can_confirm",
        "blockers",
        "active_line_count",
        "unavailable_line_count",
    }.issubset(confirmation_preflight_schema["properties"])

    amendment_preflight_operation = paths[amendment_preflight_path]["get"]
    amendment_preflight_schema_reference = amendment_preflight_operation["responses"]["200"][
        "content"
    ]["application/json"]["schema"]
    amendment_preflight_schema = _resolve_schema(schema, amendment_preflight_schema_reference)
    assert {
        "event_draft_id",
        "public_reference",
        "status",
        "can_amend",
        "blockers",
        "active_line_count",
    }.issubset(amendment_preflight_schema["properties"])

    amendment_request_create_operation = paths[HAHITANTSOA_EVENT_DRAFT_AMENDMENT_REQUEST_LIST_PATH][
        "post"
    ]
    amendment_request_response_schema_reference = amendment_request_create_operation["responses"][
        "201"
    ]["content"]["application/json"]["schema"]
    amendment_request_result_schema = _resolve_schema(
        schema,
        amendment_request_response_schema_reference,
    )
    assert set(amendment_request_result_schema["properties"]) == {"amendment_request"}

    amendment_request_schema_reference = amendment_request_result_schema["properties"][
        "amendment_request"
    ]
    amendment_request_schema = _resolve_schema(schema, amendment_request_schema_reference)
    assert {
        "id",
        "event_draft_id",
        "status",
        "reason",
        "notes",
        "lines",
        "created_at",
        "updated_at",
    }.issubset(amendment_request_schema["properties"])

    amendment_request_availability_operation = paths[
        HAHITANTSOA_EVENT_DRAFT_AMENDMENT_REQUEST_AVAILABILITY_PREFLIGHT_PATH
    ]["get"]
    amendment_request_availability_schema_reference = amendment_request_availability_operation[
        "responses"
    ]["200"]["content"]["application/json"]["schema"]
    amendment_request_availability_schema = _resolve_schema(
        schema,
        amendment_request_availability_schema_reference,
    )
    assert {
        "amendment_request_id",
        "event_draft_id",
        "public_reference",
        "status",
        "start_at",
        "end_at",
        "line_count",
        "available_line_count",
        "unavailable_line_count",
        "lines",
    }.issubset(amendment_request_availability_schema["properties"])

    amendment_request_availability_line_reference = amendment_request_availability_schema[
        "properties"
    ]["lines"]["items"]
    amendment_request_availability_line_schema = _resolve_schema(
        schema,
        amendment_request_availability_line_reference,
    )
    assert {
        "amendment_request_line_id",
        "quantity",
        "inventory_item_id",
        "inventory_item_name",
        "inventory_item_kind",
        "status",
        "conflict_count",
    }.issubset(amendment_request_availability_line_schema["properties"])

    amendment_request_line_operation = paths[
        HAHITANTSOA_EVENT_DRAFT_AMENDMENT_REQUEST_LINE_LIST_PATH
    ]["post"]
    amendment_request_line_schema_reference = amendment_request_line_operation["responses"]["201"][
        "content"
    ]["application/json"]["schema"]
    amendment_request_line_schema = _resolve_schema(schema, amendment_request_line_schema_reference)
    assert {
        "id",
        "inventory_item_id",
        "inventory_item_name",
        "inventory_item_kind",
        "quantity",
        "notes",
    }.issubset(amendment_request_line_schema["properties"])

    confirmation_operation = paths[confirmation_path]["post"]
    confirmation_schema_reference = confirmation_operation["responses"]["200"]["content"][
        "application/json"
    ]["schema"]
    confirmation_schema = _resolve_schema(schema, confirmation_schema_reference)
    assert {
        "status",
        "public_reference",
        "blocked_item_count",
        "event_draft",
    }.issubset(confirmation_schema["properties"])


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
