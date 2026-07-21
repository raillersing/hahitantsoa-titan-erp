"""Backend tests for apps.excel_import API endpoints."""

import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client

from apps.excel_import.models import ImportJob

pytestmark = pytest.mark.django_db

IMPORT_JOB_LIST_URL = "/api/v1/import/"
VALID_CSV_CONTENT = "Name,Price,Quantity\nWidget A,10.00,5\nWidget B,20.00,3\n"
VALID_CSV_FILENAME = "test_import.csv"


@pytest.fixture
def user():
    return get_user_model().objects.create_user(
        username="import-test-user",
        password="test-pass",
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
        total_rows=10,
        column_mapping={"Name": "name", "Price": "price"},
    )


def _make_csv_upload(content=VALID_CSV_CONTENT, filename=VALID_CSV_FILENAME):
    return SimpleUploadedFile(
        filename,
        content.encode("utf-8"),
        content_type="text/csv",
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
    # DRF create() returns the upload serializer data, not the created instance
    assert data["target_model"] == "inventory_item"
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


# --- Validate import job (authenticated) ---


def test_validate_import_job(authenticated_client, import_job):
    url = f"{IMPORT_JOB_LIST_URL}{import_job.id}/validate/"
    response = authenticated_client.post(url, content_type="application/json")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "completed"
    assert data["valid_rows"] == import_job.total_rows

    import_job.refresh_from_db()
    assert import_job.status == "completed"
    assert import_job.valid_rows == import_job.total_rows


def test_validate_import_job_404(authenticated_client):
    url = f"{IMPORT_JOB_LIST_URL}00000000-0000-0000-0000-000000000000/validate/"
    response = authenticated_client.post(url, content_type="application/json")
    assert response.status_code == 404


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
