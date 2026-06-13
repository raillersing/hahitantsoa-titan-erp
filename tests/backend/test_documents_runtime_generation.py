import pytest
from tests.backend.test_documents_document_instance_foundation import (
    _draft_with_line,
)

from apps.documents.models import DocumentInstanceStatus
from apps.documents.runtime import (
    DocumentRuntimeGenerationError,
    calculate_document_html_checksum,
    generate_document_instance_html,
)
from apps.documents.services import create_document_instance_from_reservation_draft

pytestmark = pytest.mark.django_db


def test_generate_document_instance_html_success() -> None:
    draft = _draft_with_line()
    instance = create_document_instance_from_reservation_draft(
        reservation_draft=draft,
        template_key="titan.proforma.v1",
    )

    result = generate_document_instance_html(document_instance=instance)

    assert instance.status == DocumentInstanceStatus.GENERATED
    assert instance.content_checksum is not None
    assert instance.storage_path is None
    assert instance.generated_content_size_bytes is not None
    assert instance.generated_content_size_bytes == len(result.html_content.encode("utf-8"))

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
    import hashlib

    html = "<html><body>Test</body></html>"
    checksum = calculate_document_html_checksum(html)
    assert len(checksum) == 64
    assert calculate_document_html_checksum(html) == checksum
    assert checksum == hashlib.sha256(html.encode("utf-8")).hexdigest()
