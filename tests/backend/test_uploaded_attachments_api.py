from datetime import timedelta

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone

from apps.customers.models import Customer
from apps.documents.models import UploadedAttachment
from apps.hahitantsoa.models import HahitantsoaEventDraft
from apps.reservations.models import ReservationDraft

ATTACHMENTS_URL = "/api/v1/documents/attachments/"

pytestmark = pytest.mark.django_db


@pytest.fixture
def sensitive_client(client, django_user_model):
    user = django_user_model.objects.create_user(
        username="attachment-sensitive-user",
        password="test-password",
        is_staff=True,
    )
    client.force_login(user)
    return client


@pytest.fixture
def customer():
    return Customer.objects.create(
        display_name="Attachment Customer",
        lifecycle_status="client",
        party_type="individual",
    )


@pytest.fixture
def reservation_draft(customer):
    start_at = timezone.now().replace(microsecond=0)
    return ReservationDraft.objects.create(
        customer=customer,
        start_at=start_at,
        end_at=start_at + timedelta(hours=2),
    )


def _pdf_file(name="cin.pdf"):
    return SimpleUploadedFile(
        name,
        b"%PDF-1.7\nvalid test document\n",
        content_type="application/pdf",
    )


def test_sensitive_user_can_upload_and_download_private_attachment(
    sensitive_client,
    customer,
    reservation_draft,
    tmp_path,
    settings,
):
    settings.MEDIA_ROOT = tmp_path
    response = sensitive_client.post(
        ATTACHMENTS_URL,
        {
            "customer_id": str(customer.id),
            "reservation_draft_id": str(reservation_draft.id),
            "category": "CIN",
            "file": _pdf_file(),
        },
    )

    assert response.status_code == 201
    payload = response.json()
    attachment = UploadedAttachment.objects.get(pk=payload["id"])
    assert payload["original_name"] == "cin.pdf"
    assert payload["content_type"] == "application/pdf"
    assert payload["customer_reference"] == customer.public_reference
    assert f"customers/{customer.public_reference}/attachments/" in attachment.file.name
    assert payload["size_bytes"] == attachment.size_bytes
    assert payload["sha256"] == attachment.sha256
    assert "file" not in payload

    download = sensitive_client.get(f"{ATTACHMENTS_URL}{attachment.id}/download/")
    assert download.status_code == 200
    assert download["Content-Type"] == "application/pdf"
    assert b"%PDF-1.7" in b"".join(download.streaming_content)


def test_attachment_can_link_a_hahitantsoa_event_and_its_customer(
    sensitive_client, customer, tmp_path, settings
):
    settings.MEDIA_ROOT = tmp_path
    start_at = timezone.now().replace(microsecond=0)
    event_draft = HahitantsoaEventDraft.objects.create(
        customer=customer,
        event_name="Dossier avec pièce jointe",
        start_at=start_at,
        end_at=start_at + timedelta(hours=2),
    )

    response = sensitive_client.post(
        ATTACHMENTS_URL,
        {
            "customer_id": str(customer.id),
            "hahitantsoa_event_draft_id": str(event_draft.id),
            "category": "CIN",
            "file": _pdf_file(),
        },
    )

    assert response.status_code == 201
    attachment = UploadedAttachment.objects.get(pk=response.json()["id"])
    assert attachment.customer_id == customer.id
    assert attachment.hahitantsoa_event_draft_id == event_draft.id


def test_attachment_upload_rejects_mismatched_file_signature(
    sensitive_client,
    customer,
):
    response = sensitive_client.post(
        ATTACHMENTS_URL,
        {
            "customer_id": str(customer.id),
            "category": "CIN",
            "file": SimpleUploadedFile(
                "fake.pdf",
                b"not a pdf",
                content_type="application/pdf",
            ),
        },
    )

    assert response.status_code == 400
    assert "file" in response.json()
    assert not UploadedAttachment.objects.exists()


def test_payment_attachment_requires_reservation_scope(sensitive_client, customer):
    response = sensitive_client.post(
        ATTACHMENTS_URL,
        {
            "customer_id": str(customer.id),
            "category": "Justificatif paiement",
            "file": _pdf_file("payment.pdf"),
        },
    )

    assert response.status_code == 400
    assert "category" in response.json()


def test_customer_attachment_can_be_uploaded_listed_and_soft_deleted(
    sensitive_client, customer, tmp_path, settings
):
    settings.MEDIA_ROOT = tmp_path
    response = sensitive_client.post(
        ATTACHMENTS_URL,
        {
            "customer_id": str(customer.id),
            "category": "Justificatif domicile",
            "file": _pdf_file("domicile.pdf"),
        },
    )

    assert response.status_code == 201
    attachment_id = response.json()["id"]
    listed = sensitive_client.get(f"{ATTACHMENTS_URL}?customer_id={customer.id}")
    assert listed.status_code == 200
    assert [item["id"] for item in listed.json()] == [attachment_id]

    deleted = sensitive_client.delete(f"{ATTACHMENTS_URL}{attachment_id}/")
    assert deleted.status_code == 204
    assert sensitive_client.get(f"{ATTACHMENTS_URL}?customer_id={customer.id}").json() == []
    assert UploadedAttachment.objects.get(pk=attachment_id).is_deleted is True
