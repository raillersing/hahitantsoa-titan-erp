from __future__ import annotations

from datetime import timedelta

import pytest
from django.utils import timezone

from apps.documents.models import DocumentInstance, DocumentInstanceStatus
from apps.documents.pdf import (
    DocumentPDFGenerationError,
    MockPDFGenerator,
    build_pdf_artifact_storage_path,
    calculate_pdf_checksum,
    get_pdf_generator,
)
from apps.documents.services import (
    DEFAULT_PROFORMA_VALIDITY_DAYS,
    generate_document_instance_pdf,
)


@pytest.fixture
def sensitive_user(django_user_model):
    return django_user_model.objects.create_user(
        username="pdf-sensitive-user", password="test-pass", is_staff=True
    )


@pytest.fixture
def sensitive_client(sensitive_user):
    from django.test import Client

    client = Client()
    client.force_login(sensitive_user)
    return client


class TestMockPDFGenerator:
    def test_generate_pdf_returns_pdf_bytes(self) -> None:
        gen = MockPDFGenerator()
        result = gen.generate_pdf("<html><body>Hello</body></html>")
        assert isinstance(result, bytes)
        assert result.startswith(b"%PDF-1.4")

    def test_content_type(self) -> None:
        gen = MockPDFGenerator()
        assert gen.content_type == "application/pdf"


class TestPDFHelpers:
    def test_calculate_pdf_checksum(self) -> None:
        data = b"test_pdf_content"
        checksum = calculate_pdf_checksum(data)
        assert len(checksum) == 64

    def test_build_pdf_artifact_storage_path(self) -> None:
        from unittest.mock import MagicMock

        instance = MagicMock()
        instance.id = "abc123"
        path = build_pdf_artifact_storage_path(instance, "a" * 64)
        assert path == "documents/abc123/aaaaaaaaaaaa.pdf"


class TestGetPDFGenerator:
    def test_default_returns_mock(self) -> None:
        gen = get_pdf_generator()
        assert isinstance(gen, MockPDFGenerator)


class TestGenerateDocumentInstancePDFService:
    @pytest.mark.django_db
    def test_unissued_existing_proforma_has_no_fictional_issue_dates(self) -> None:
        instance = DocumentInstance.objects.create(
            template_key="titan.proforma.v1",
            template_version="1",
            template_label="Legacy",
            business_scope="titan",
            document_type="proforma",
            template_status="active",
            template_source_kind="generated_from_brand_style",
            template_source_reference="ref",
            template_path="documents/titan_proforma.html",
            template_preview_path="",
            reservation_public_reference="T-LEGACY",
            reservation_status="draft",
            customer_display_name="Customer",
            status=DocumentInstanceStatus.GENERATED,
            prepared_at=timezone.now(),
        )

        assert instance.issued_at is None
        assert instance.valid_until is None
        assert instance.proforma_validity_days is None

    def test_generates_pdf_and_updates_model(self, sensitive_client, django_user_model) -> None:
        from django.core.files.base import ContentFile
        from django.core.files.storage import default_storage

        user = django_user_model.objects.create_user(
            username="pdf_gen", password="p", is_staff=True
        )
        instance = DocumentInstance.objects.create(
            template_key="titan.proforma.v1",
            template_version="1",
            template_label="Test",
            business_scope="titan",
            document_type="proforma",
            template_status="active",
            template_source_kind="generated_from_brand_style",
            template_source_reference="ref",
            template_path="documents/titan_proforma.html",
            template_preview_path="",
            reservation_public_reference="T-001",
            reservation_status="draft",
            customer_display_name="Customer",
            status=DocumentInstanceStatus.GENERATED,
            prepared_at=timezone.now(),
            content_checksum="abc",
            storage_path="documents/test/abc.html",
            generated_content_size_bytes=100,
        )

        # Pre-create HTML artifact in storage
        default_storage.save(instance.storage_path, ContentFile(b"<html>Test</html>"))

        result = generate_document_instance_pdf(document_instance=instance, actor=user)

        assert result.pdf_storage_path is not None
        assert result.pdf_storage_path.endswith(".pdf")
        assert result.pdf_generated_at is not None
        assert result.pdf_content_checksum is not None
        assert len(result.pdf_content_checksum) == 64
        assert default_storage.exists(result.pdf_storage_path)
        assert result.status == DocumentInstanceStatus.ISSUED
        assert result.proforma_validity_days == DEFAULT_PROFORMA_VALIDITY_DAYS
        assert result.issued_at is not None
        assert result.valid_until == result.issued_at + timedelta(
            days=DEFAULT_PROFORMA_VALIDITY_DAYS
        )

    def test_repeated_proforma_pdf_issuance_is_idempotent(self, django_user_model) -> None:
        from django.core.files.base import ContentFile
        from django.core.files.storage import default_storage

        instance = DocumentInstance.objects.create(
            template_key="titan.proforma.v1",
            template_version="1",
            template_label="Test",
            business_scope="titan",
            document_type="proforma",
            template_status="active",
            template_source_kind="generated_from_brand_style",
            template_source_reference="ref",
            template_path="documents/titan_proforma.html",
            template_preview_path="",
            reservation_public_reference="T-REPEAT",
            reservation_status="draft",
            customer_display_name="Customer",
            status=DocumentInstanceStatus.GENERATED,
            prepared_at=timezone.now(),
            storage_path="documents/test/repeat.html",
            content_checksum="abc",
            generated_content_size_bytes=100,
            proforma_validity_days=7,
        )
        default_storage.save(instance.storage_path, ContentFile(b"<html>Test</html>"))

        first = generate_document_instance_pdf(document_instance=instance)
        second = generate_document_instance_pdf(document_instance=instance)

        assert second.id == first.id
        assert second.issued_at == first.issued_at
        assert second.valid_until == first.valid_until
        assert second.pdf_storage_path == first.pdf_storage_path

    def test_fails_for_non_generated_status(self, django_user_model) -> None:
        user = django_user_model.objects.create_user(
            username="pdf_gen2", password="p", is_staff=True
        )
        instance = DocumentInstance.objects.create(
            template_key="titan.proforma.v1",
            template_version="1",
            template_label="Test",
            business_scope="titan",
            document_type="proforma",
            template_status="active",
            template_source_kind="generated_from_brand_style",
            template_source_reference="ref",
            template_path="documents/titan_proforma.html",
            template_preview_path="",
            reservation_public_reference="T-002",
            reservation_status="draft",
            customer_display_name="Customer",
            status=DocumentInstanceStatus.PREPARED,
            prepared_at=timezone.now(),
        )

        with pytest.raises(DocumentPDFGenerationError) as exc_info:
            generate_document_instance_pdf(document_instance=instance, actor=user)
        assert exc_info.value.code == "invalid_document_status_for_pdf_generation"

    def test_fails_when_html_artifact_missing(self, django_user_model) -> None:
        user = django_user_model.objects.create_user(
            username="pdf_gen3", password="p", is_staff=True
        )
        instance = DocumentInstance.objects.create(
            template_key="titan.proforma.v1",
            template_version="1",
            template_label="Test",
            business_scope="titan",
            document_type="proforma",
            template_status="active",
            template_source_kind="generated_from_brand_style",
            template_source_reference="ref",
            template_path="documents/titan_proforma.html",
            template_preview_path="",
            reservation_public_reference="T-003",
            reservation_status="draft",
            customer_display_name="Customer",
            status=DocumentInstanceStatus.GENERATED,
            prepared_at=timezone.now(),
            storage_path="documents/missing/test.html",
        )

        with pytest.raises(DocumentPDFGenerationError) as exc_info:
            generate_document_instance_pdf(document_instance=instance, actor=user)
        assert exc_info.value.code == "document_html_artifact_not_found"


class TestPDFGenerateAPI:
    def test_pdf_generate_requires_auth(self, client, django_user_model) -> None:
        django_user_model.objects.create_user(username="pdf_auth", password="p", is_staff=True)
        response = client.post(
            "/api/v1/documents/reservation-drafts/11111111-1111-1111-1111-111111111111/"
            "instances/11111111-1111-1111-1111-111111111111/generate-pdf/"
        )
        assert response.status_code in {401, 403}

    def test_pdf_generate_success(self, sensitive_client, django_user_model) -> None:
        from django.core.files.base import ContentFile
        from django.core.files.storage import default_storage

        from apps.customers.models import Customer
        from apps.reservations.models import ReservationDraft

        django_user_model.objects.create_user(username="pdf_api", password="p", is_staff=True)
        customer = Customer.objects.create(display_name="C")
        draft = ReservationDraft.objects.create(
            public_reference="T-PDF",
            customer=customer,
            start_at=timezone.now(),
            end_at=timezone.now(),
        )
        instance = DocumentInstance.objects.create(
            reservation_draft=draft,
            template_key="titan.proforma.v1",
            template_version="1",
            template_label="Test",
            business_scope="titan",
            document_type="proforma",
            template_status="active",
            template_source_kind="generated_from_brand_style",
            template_source_reference="ref",
            template_path="documents/titan_proforma.html",
            template_preview_path="",
            reservation_public_reference="T-PDF",
            reservation_status="draft",
            customer_display_name="C",
            status=DocumentInstanceStatus.GENERATED,
            prepared_at=timezone.now(),
            storage_path=f"documents/test/{draft.id}.html",
            content_checksum="abc",
            generated_content_size_bytes=50,
        )
        default_storage.save(instance.storage_path, ContentFile(b"<html>Test</html>"))

        response = sensitive_client.post(
            f"/api/v1/documents/reservation-drafts/{draft.id}/instances/{instance.id}/generate-pdf/"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(instance.id)
        assert data["pdf_storage_path"] is not None
        assert data["pdf_content_checksum"] is not None


class TestPDFRetrieveAPI:
    def test_pdf_retrieve_requires_auth(self, client, django_user_model) -> None:
        django_user_model.objects.create_user(username="pdf_ret", password="p", is_staff=True)
        response = client.get(
            "/api/v1/documents/instances/11111111-1111-1111-1111-111111111111/pdf/"
        )
        assert response.status_code in {401, 403}

    def test_pdf_retrieve_404_when_no_pdf(self, sensitive_client, django_user_model) -> None:
        instance = DocumentInstance.objects.create(
            template_key="titan.proforma.v1",
            template_version="1",
            template_label="Test",
            business_scope="titan",
            document_type="proforma",
            template_status="active",
            template_source_kind="generated_from_brand_style",
            template_source_reference="ref",
            template_path="documents/titan_proforma.html",
            template_preview_path="",
            reservation_public_reference="T-NO",
            reservation_status="draft",
            customer_display_name="C",
            status=DocumentInstanceStatus.GENERATED,
            prepared_at=timezone.now(),
        )
        response = sensitive_client.get(f"/api/v1/documents/instances/{instance.id}/pdf/")
        assert response.status_code == 404
