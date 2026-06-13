import hashlib

import pytest
from django.core.files.storage import FileSystemStorage
from tests.backend.test_documents_document_instance_foundation import (
    _draft_with_line,
)

import apps.documents.runtime as runtime_module
from apps.documents.models import DocumentInstanceStatus
from apps.documents.runtime import (
    DocumentRuntimeGenerationError,
    calculate_document_html_checksum,
    generate_document_instance_html,
)
from apps.documents.services import create_document_instance_from_reservation_draft

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def isolated_document_storage(tmp_path, monkeypatch):
    """Redirect artifact writes to a pytest-managed temp directory.

    Monkeypatches both the ``default_storage`` name in the runtime module
    and in this test module so that both writes and reads hit the same
    isolated FileSystemStorage instance.
    """
    storage = FileSystemStorage(location=str(tmp_path))
    monkeypatch.setattr(runtime_module, "default_storage", storage)
    # Also patch the name imported into this test module so reads work.
    monkeypatch.setattr(
        "tests.backend.test_documents_runtime_generation.FileSystemStorage",
        FileSystemStorage,
    )
    return storage


def test_generate_document_instance_html_success(isolated_document_storage) -> None:
    draft = _draft_with_line()
    instance = create_document_instance_from_reservation_draft(
        reservation_draft=draft,
        template_key="titan.proforma.v1",
    )

    result = generate_document_instance_html(document_instance=instance)

    assert instance.status == DocumentInstanceStatus.GENERATED
    assert instance.content_checksum is not None
    assert instance.storage_path is not None
    assert not instance.storage_path.startswith("/") and ".." not in instance.storage_path
    assert instance.storage_path.endswith(".html")
    # Verify stored content matches generated HTML
    with isolated_document_storage.open(instance.storage_path, "rb") as f:
        stored_bytes = f.read()
    assert stored_bytes == result.html_content.encode("utf-8")
    assert instance.generated_content_size_bytes == len(stored_bytes)

    # Checksum/content integrity
    assert hashlib.sha256(stored_bytes).hexdigest() == instance.content_checksum

    assert result.document_instance == instance
    assert result.content_checksum == instance.content_checksum
    assert len(result.content_checksum) == 64

    assert "Client documents" in result.html_content
    assert draft.public_reference in result.html_content
    assert "Description inventory" in result.html_content
    assert "2 x" in result.html_content


def test_generate_document_instance_html_determinism() -> None:
    draft = _draft_with_line()
    instance1 = create_document_instance_from_reservation_draft(
        reservation_draft=draft,
        template_key="titan.proforma.v1",
    )
    instance2 = create_document_instance_from_reservation_draft(
        reservation_draft=draft,
        template_key="titan.proforma.v1",
    )

    result1 = generate_document_instance_html(document_instance=instance1)
    result2 = generate_document_instance_html(document_instance=instance2)

    assert result1.content_checksum == result2.content_checksum
    assert result1.html_content == result2.html_content
    assert instance1.generated_content_size_bytes == instance2.generated_content_size_bytes


def test_generate_document_instance_html_invalid_status() -> None:
    draft = _draft_with_line()
    instance = create_document_instance_from_reservation_draft(
        reservation_draft=draft,
        template_key="titan.proforma.v1",
    )
    instance.status = DocumentInstanceStatus.GENERATED
    instance.content_checksum = "a" * 64
    instance.save(update_fields=["status", "content_checksum"])

    with pytest.raises(DocumentRuntimeGenerationError) as exc_info:
        generate_document_instance_html(document_instance=instance)

    assert exc_info.value.code == "invalid_document_status_for_generation"
    # Ensure no storage path was set
    assert instance.storage_path is None


def test_generate_document_instance_html_no_reservation_mutation() -> None:
    draft = _draft_with_line()
    before_updated_at = draft.updated_at
    instance = create_document_instance_from_reservation_draft(
        reservation_draft=draft,
        template_key="titan.proforma.v1",
    )

    generate_document_instance_html(document_instance=instance)

    draft.refresh_from_db()
    assert draft.updated_at == before_updated_at


def test_calculate_document_html_checksum_returns_sha256_hex_digest() -> None:
    html = "<html><body>Test</body></html>"
    checksum = calculate_document_html_checksum(html)
    assert len(checksum) == 64
    assert calculate_document_html_checksum(html) == checksum
    assert checksum == hashlib.sha256(html.encode("utf-8")).hexdigest()
