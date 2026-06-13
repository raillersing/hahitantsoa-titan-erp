from __future__ import annotations

import hashlib
from dataclasses import dataclass

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

    checksum = calculate_document_html_checksum(html_content)

    document_instance.status = DocumentInstanceStatus.GENERATED
    document_instance.content_checksum = checksum
    document_instance.save(update_fields=["status", "content_checksum", "updated_at"])

    return DocumentGenerationResult(
        document_instance=document_instance,
        html_content=html_content,
        content_checksum=checksum,
    )
