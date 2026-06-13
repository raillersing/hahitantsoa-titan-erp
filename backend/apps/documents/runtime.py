from __future__ import annotations

import hashlib
from dataclasses import dataclass

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db import transaction
from django.template.loader import render_to_string

from apps.documents.commercial import build_reservation_draft_commercial_document_context
from apps.documents.models import DocumentInstance, DocumentInstanceStatus


class DocumentRuntimeGenerationError(ValueError):
    def __init__(self, message: str, *, code: str) -> None:
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class DocumentGenerationResult:
    document_instance: DocumentInstance
    html_content: str
    content_checksum: str


def calculate_document_html_checksum(html_content: str) -> str:
    return hashlib.sha256(html_content.encode("utf-8")).hexdigest()


def build_document_artifact_storage_path(document_instance, content_checksum: str) -> str:
    """Return a deterministic relative path for the HTML artifact.
    Includes the document instance PK and a prefix of the checksum.
    """
    safe_checksum = content_checksum[:12]
    return f"documents/{document_instance.id}/{safe_checksum}.html"


def store_document_html_artifact(
    document_instance, html_content: str, content_checksum: str
) -> str:
    """Save the HTML content to the default storage and return the relative path.
    Uses UTF-8 encoding.
    """
    path = build_document_artifact_storage_path(document_instance, content_checksum)
    default_storage.save(path, ContentFile(html_content.encode("utf-8")))
    return path


@transaction.atomic
def generate_document_instance_html(
    *,
    document_instance: DocumentInstance,
    actor: object | None = None,
) -> DocumentGenerationResult:
    if document_instance.status != DocumentInstanceStatus.PREPARED:
        raise DocumentRuntimeGenerationError(
            f"Cannot generate document from status: {document_instance.status}",
            code="invalid_document_status_for_generation",
        )

    context = build_reservation_draft_commercial_document_context(
        reservation_draft=document_instance.reservation_draft,
        template_key=document_instance.template_key,
    )

    if context.template.key == "titan.proforma.v1":
        template_path = "documents/titan_proforma.html"
    else:
        template_path = context.template.template_path

    html_content = render_to_string(template_path, {"context": context})

    if not html_content or not html_content.strip():
        raise DocumentRuntimeGenerationError(
            "Generated document HTML content is empty or invalid.",
            code="empty_generated_html_content",
        )

    checksum = calculate_document_html_checksum(html_content)
    if not checksum or len(checksum) != 64:
        raise DocumentRuntimeGenerationError(
            "Calculated checksum is invalid.",
            code="invalid_calculated_checksum",
        )

    size_bytes = len(html_content.encode("utf-8"))
    if size_bytes <= 0:
        raise DocumentRuntimeGenerationError(
            "Generated content size must be positive.",
            code="invalid_generated_content_size",
        )

    storage_path = store_document_html_artifact(document_instance, html_content, checksum)
    if not storage_path or ".." in storage_path or storage_path.startswith("/"):
        raise DocumentRuntimeGenerationError(
            f"Unsafe or invalid storage path resolved: {storage_path}",
            code="unsafe_storage_path",
        )

    document_instance.status = DocumentInstanceStatus.GENERATED
    document_instance.content_checksum = checksum
    document_instance.generated_content_size_bytes = size_bytes
    document_instance.storage_path = storage_path
    document_instance.save(
        update_fields=[
            "status",
            "content_checksum",
            "generated_content_size_bytes",
            "storage_path",
            "updated_at",
        ]
    )

    return DocumentGenerationResult(
        document_instance=document_instance,
        html_content=html_content,
        content_checksum=checksum,
    )
