from __future__ import annotations

import hashlib
from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from apps.documents.models import DocumentInstance


class DocumentPDFGenerationError(ValueError):
    def __init__(self, message: str, *, code: str) -> None:
        super().__init__(message)
        self.code = code


class DocumentPDFGenerator(ABC):
    """Abstract base for HTML-to-PDF document generators."""

    @abstractmethod
    def generate_pdf(self, html_content: str) -> bytes:
        """Convert *html_content* to PDF bytes."""

    @property
    def content_type(self) -> str:
        return "application/pdf"


class MockPDFGenerator(DocumentPDFGenerator):
    """Test-safe PDF generator that returns a minimal PDF byte stream.

    Does not require external binaries or heavy libraries.
    Suitable for CI, local dev, and environments without a real PDF engine.
    """

    def generate_pdf(self, html_content: str) -> bytes:
        # Minimal valid PDF 1.4 structure for tests and stub scenarios.
        # Real production environments should configure a concrete engine
        # such as WeasyPrint, xhtml2pdf, or a remote PDF service.
        pdf_body = (
            b"%PDF-1.4\n"
            b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
            b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
            b"3 0 obj\n<< /Type /Page /Parent 2 0 R"
            b" /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n"
            b"4 0 obj\n<< /Length 0 >>\nstream\n"
            b"endstream\nendobj\n"
            b"xref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n"
            b"0000000115 00000 n\n0000000214 00000 n\n"
            b"trailer\n<< /Size 5 /Root 1 0 R >>\n"
            b"startxref\n263\n%%EOF\n"
        )
        return pdf_body


def get_pdf_generator() -> DocumentPDFGenerator:
    """Return the active PDF generator configured in Django settings.

    Default is ``MockPDFGenerator``.
    Override via ``settings.DOCUMENT_PDF_GENERATOR_CLASS``.
    """
    from django.conf import settings
    from django.utils.module_loading import import_string

    class_path = getattr(settings, "DOCUMENT_PDF_GENERATOR_CLASS", None)
    if class_path is None:
        return MockPDFGenerator()
    try:
        generator_class = import_string(class_path)
        return generator_class()
    except Exception as error:
        raise DocumentPDFGenerationError(
            f"Failed to load PDF generator class '{class_path}': {error}",
            code="pdf_generator_load_failed",
        ) from error


def calculate_pdf_checksum(pdf_content: bytes) -> str:
    return hashlib.sha256(pdf_content).hexdigest()


def build_pdf_artifact_storage_path(document_instance: DocumentInstance, checksum: str) -> str:
    safe_checksum = checksum[:12]
    return f"documents/{document_instance.id}/{safe_checksum}.pdf"
