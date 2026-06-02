OPENAPI_TITLE = "Hahitantsoa Titan ERP API"
INVENTORY_LIST_PATH = "/api/v1/inventory/items/"
INVENTORY_DETAIL_PATHS = (
    "/api/v1/inventory/items/{id}/",
    "/api/v1/inventory/items/{pk}/",
)


def _get_inventory_detail_path(paths: dict) -> str:
    for detail_path in INVENTORY_DETAIL_PATHS:
        if detail_path in paths:
            return detail_path

    expected_paths = ", ".join(INVENTORY_DETAIL_PATHS)
    raise AssertionError(f"Expected one inventory detail path among: {expected_paths}")


def test_openapi_schema_exposes_read_only_inventory_paths(client) -> None:
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

    assert "get" in paths[INVENTORY_LIST_PATH]
    assert "post" not in paths[INVENTORY_LIST_PATH]

    detail_operations = paths[detail_path]
    assert "get" in detail_operations
    assert "put" not in detail_operations
    assert "patch" not in detail_operations
    assert "delete" not in detail_operations


def test_openapi_documentation_views_are_available(client) -> None:
    swagger_response = client.get("/api/docs/swagger/")
    redoc_response = client.get("/api/docs/redoc/")

    assert swagger_response.status_code == 200
    assert redoc_response.status_code == 200
