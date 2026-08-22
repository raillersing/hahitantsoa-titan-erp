"""Backend tests for apps.excel_import API endpoints."""

import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client

from apps.excel_import.models import ImportJob
from apps.inventory.models import InventoryItem, InventoryStockMovement, InventoryStorageLocation

pytestmark = pytest.mark.django_db

IMPORT_JOB_LIST_URL = "/api/v1/import/"
VALID_CSV_CONTENT = "Name,Price,Quantity\nWidget A,10.00,5\nWidget B,20.00,3\n"
VALID_CSV_FILENAME = "test_import.csv"


@pytest.fixture
def user():
    return get_user_model().objects.create_user(
        username="import-test-user",
        password="test-pass",
        is_staff=True,
    )


@pytest.fixture
def authenticated_client(user):
    client = Client()
    client.force_login(user)
    return client


@pytest.fixture
def import_job(user):
    return ImportJob.objects.create(
        created_by=user,
        filename="sample.csv",
        status="mapping",
        target_model="inventory_item",
        total_rows=10,
        column_mapping={"Name": "name", "Price": "price"},
        source_rows=[{"Name": "Imported chair", "Price": "100"}],
    )


def _make_csv_upload(content=VALID_CSV_CONTENT, filename=VALID_CSV_FILENAME):
    return SimpleUploadedFile(
        filename,
        content.encode("utf-8"),
        content_type="text/csv",
    )


def _make_xlsx_upload():
    from io import BytesIO
    from zipfile import ZIP_DEFLATED, ZipFile

    workbook = BytesIO()
    headers = [
        "Désignation",
        "Emplacement",
        "Code",
        "Section",
        "Unité",
        "STOCK INVENTAIRE AVRIL",
        "STOCK disponible",
        "CASSES",
        "Prix d'achat [Ar]",
        "Prix de location",
        "Prix de casse",
    ]
    values = [
        "Assiette test",
        "Dépôt A",
        "ART-001",
        "Vaisselle",
        "u",
        "14",
        "12",
        "2",
        "1000",
        "150",
        "2000",
    ]
    columns = "ABCDEFGHIJK"
    header_cells = "".join(
        f'<c r="{column}1" t="inlineStr"><is><t>{value}</t></is></c>'
        for column, value in zip(columns, headers, strict=True)
    )
    value_cells = "".join(
        (
            f'<c r="{column}2" t="inlineStr"><is><t>{value}</t></is></c>'
            if index < 5
            else f'<c r="{column}2"><v>{value}</v></c>'
        )
        for index, (column, value) in enumerate(zip(columns, values, strict=True))
    )
    with ZipFile(workbook, "w", ZIP_DEFLATED) as archive:
        archive.writestr(
            "xl/worksheets/sheet1.xml",
            f"""<?xml version=\"1.0\" encoding=\"UTF-8\"?>
            <worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><sheetData>
              <row r=\"1\">{header_cells}</row>
              <row r=\"2\">{value_cells}</row>
            </sheetData></worksheet>""",
        )
    return SimpleUploadedFile(
        "inventory.xlsx",
        workbook.getvalue(),
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


# --- List import jobs (authenticated) ---


def test_list_import_jobs_returns_200(authenticated_client, import_job):
    response = authenticated_client.get(IMPORT_JOB_LIST_URL)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["filename"] == "sample.csv"
    assert data[0]["status"] == "mapping"
    assert data[0]["total_rows"] == 10


def test_list_import_jobs_empty(authenticated_client):
    response = authenticated_client.get(IMPORT_JOB_LIST_URL)
    assert response.status_code == 200
    assert response.json() == []


# --- Create import job (authenticated) ---


def test_create_import_job(authenticated_client):
    csv_file = _make_csv_upload()
    response = authenticated_client.post(
        IMPORT_JOB_LIST_URL,
        data={"file": csv_file, "target_model": "inventory_item"},
        format="multipart",
    )
    assert response.status_code == 201
    data = response.json()
    # The upload response must be the persisted ImportJob contract consumed by
    # the mapping screen.
    assert data["target_model"] == "inventory_item"
    assert data["status"] == "mapping"
    assert data["column_mapping"] == {
        "Name": "name",
        "Price": "",
        "Quantity": "initial_stock",
    }
    # Verify the job was actually created in the database
    job = ImportJob.objects.latest("created_at")
    assert job.filename == VALID_CSV_FILENAME
    assert job.status == "mapping"
    assert job.total_rows == 2
    assert "Name" in job.column_mapping
    assert "Price" in job.column_mapping
    assert job.created_by is not None
    assert job.target_model == "inventory_item"


def test_create_import_job_customer_target(authenticated_client):
    csv_file = _make_csv_upload(
        content="Full Name,Email\nJohn Doe,john@example.com\n",
        filename="customers.csv",
    )
    response = authenticated_client.post(
        IMPORT_JOB_LIST_URL,
        data={"file": csv_file, "target_model": "customer"},
        format="multipart",
    )
    assert response.status_code == 201
    assert response.json()["target_model"] == "customer"


def test_create_import_job_missing_file(authenticated_client):
    response = authenticated_client.post(
        IMPORT_JOB_LIST_URL,
        data={"target_model": "inventory_item"},
        format="multipart",
    )
    assert response.status_code == 400


def test_create_import_job_rejects_csv_without_headers(authenticated_client):
    response = authenticated_client.post(
        IMPORT_JOB_LIST_URL,
        data={
            "file": _make_csv_upload(content="", filename="empty.csv"),
            "target_model": "inventory_item",
        },
        format="multipart",
    )
    assert response.status_code == 400
    assert "file" in response.json()


# --- Validate import job (authenticated) ---


def test_validate_import_job(authenticated_client, import_job):
    url = f"{IMPORT_JOB_LIST_URL}{import_job.id}/validate/"
    response = authenticated_client.post(url, content_type="application/json")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "completed"
    assert data["valid_rows"] == 1

    import_job.refresh_from_db()
    assert import_job.status == "completed"
    assert import_job.valid_rows == 1


def test_mapping_and_validation_import_inventory_items(authenticated_client):
    response = authenticated_client.post(
        IMPORT_JOB_LIST_URL,
        data={
            "file": _make_csv_upload(
                content="name,kind,description\nImported lamp,material,LED lamp\n"
            ),
            "target_model": "inventory_item",
        },
        format="multipart",
    )
    job_id = response.json()["id"]
    mapping_response = authenticated_client.patch(
        f"{IMPORT_JOB_LIST_URL}{job_id}/mapping/",
        data={"column_mapping": {"name": "name", "kind": "kind", "description": "description"}},
        content_type="application/json",
    )
    assert mapping_response.status_code == 200
    validate_response = authenticated_client.post(
        f"{IMPORT_JOB_LIST_URL}{job_id}/validate/",
        content_type="application/json",
    )
    assert validate_response.status_code == 200
    assert validate_response.json()["status"] == "completed"
    assert validate_response.json()["valid_rows"] == 1
    assert InventoryItem.objects.filter(
        name="Imported lamp", is_active=True, is_deleted=False
    ).exists()


def test_xlsx_import_maps_inventory_stock_location_and_prices(authenticated_client):
    response = authenticated_client.post(
        IMPORT_JOB_LIST_URL,
        data={"file": _make_xlsx_upload(), "target_model": "inventory_item"},
        format="multipart",
    )
    assert response.status_code == 201
    job_id = response.json()["id"]
    assert response.json()["column_mapping"]["Désignation"] == "name"
    assert response.json()["column_mapping"]["STOCK INVENTAIRE AVRIL"] == (
        "reported_inventory_quantity"
    )
    assert response.json()["column_mapping"]["STOCK disponible"] == "initial_stock"

    validate_response = authenticated_client.post(
        f"{IMPORT_JOB_LIST_URL}{job_id}/validate/",
        content_type="application/json",
    )
    assert validate_response.status_code == 200
    assert validate_response.json()["status"] == "completed"

    item = InventoryItem.objects.get(name="Assiette test")
    assert item.code == "ART-001"
    assert item.section == "Vaisselle"
    assert item.unit == "u"
    assert item.reported_inventory_quantity == 14
    assert item.purchase_price == 1000
    assert item.rental_price == 150
    assert item.breakage_price == 2000
    assert item.reported_damaged_quantity == 2
    location = InventoryStorageLocation.objects.get(name="Dépôt A")
    movement = InventoryStockMovement.objects.get(inventory_item=item)
    assert movement.storage_location == location
    assert movement.quantity == 12


def test_validate_import_job_404(authenticated_client):
    url = f"{IMPORT_JOB_LIST_URL}00000000-0000-0000-0000-000000000000/validate/"
    response = authenticated_client.post(url, content_type="application/json")
    assert response.status_code == 404


def test_import_job_list_is_scoped_to_creator(authenticated_client, import_job, user):
    other = get_user_model().objects.create_user(username="other-import-user")
    ImportJob.objects.create(
        created_by=other,
        filename="other.csv",
        status="mapping",
        target_model="inventory_item",
    )
    response = authenticated_client.get(IMPORT_JOB_LIST_URL)
    assert response.status_code == 200
    assert [row["filename"] for row in response.json()] == [import_job.filename]


def test_import_job_rejects_oversized_file(authenticated_client):
    oversized = SimpleUploadedFile(
        "oversized.csv",
        b"a" * (10 * 1024 * 1024 + 1),
        content_type="text/csv",
    )
    response = authenticated_client.post(
        IMPORT_JOB_LIST_URL,
        data={"file": oversized, "target_model": "inventory_item"},
        format="multipart",
    )
    assert response.status_code == 400
    assert "10 MB" in str(response.json())


# --- Unauthenticated access denied (403) ---


def test_unauthenticated_list_import_jobs_denied(client):
    response = client.get(IMPORT_JOB_LIST_URL)
    assert response.status_code == 403


def test_unauthenticated_create_import_job_denied(client):
    csv_file = _make_csv_upload()
    response = client.post(
        IMPORT_JOB_LIST_URL,
        data={"file": csv_file, "target_model": "inventory_item"},
        format="multipart",
    )
    assert response.status_code == 403


def test_unauthenticated_validate_import_job_denied(client):
    url = f"{IMPORT_JOB_LIST_URL}00000000-0000-0000-0000-000000000000/validate/"
    response = client.post(url, content_type="application/json")
    assert response.status_code == 403
