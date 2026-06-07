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

    confirmed_read_only_paths = (
        INVENTORY_LIST_PATH,
        detail_path,
        RESERVATION_AVAILABILITY_SUMMARY_PATH,
        RESERVATION_AVAILABLE_ITEM_PREVIEWS_PATH,
        item_availability_preview_path,
        HAHITANTSOA_DISCOVERY_ITEMS_PATH,
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


def test_openapi_documentation_views_are_available(client) -> None:
    swagger_response = client.get("/api/docs/swagger/")
    redoc_response = client.get("/api/docs/redoc/")

    assert swagger_response.status_code == 200
    assert redoc_response.status_code == 200
