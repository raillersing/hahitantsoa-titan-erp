"""Recover legacy receipt artifacts without rewriting their financial identity."""

from datetime import timedelta
from decimal import Decimal

import pytest
from django.core.files.base import ContentFile
from django.core.files.storage import FileSystemStorage
from django.utils import timezone
from rest_framework.test import APIClient

from apps.customers.models import Customer
from apps.documents.models import DocumentInstance
from apps.documents.runtime import DocumentRuntimeGenerationError, generate_document_instance_html
from apps.documents.services import generate_document_instance_pdf
from apps.hahitantsoa.models import HahitantsoaEventDraft
from apps.payments.models import Payment
from apps.reservations.models import ReservationDraft

pytestmark = pytest.mark.django_db


@pytest.fixture
def storage(tmp_path, monkeypatch):
    storage = FileSystemStorage(location=str(tmp_path))
    monkeypatch.setattr("apps.documents.runtime.default_storage", storage)
    monkeypatch.setattr("django.core.files.storage.default_storage", storage)
    return storage


@pytest.fixture
def actor_client(django_user_model):
    actor = django_user_model.objects.create_user(username="legacy-receipt-reader", is_staff=True)
    client = APIClient()
    client.force_authenticate(user=actor)
    return actor, client


def _receipt(domain, actor, *, linked=True):
    customer = Customer.objects.create(display_name="Client reçu historique")
    start = timezone.now() + timedelta(days=7)
    model = HahitantsoaEventDraft if domain == "hahitantsoa" else ReservationDraft
    dossier = model.objects.create(
        customer=customer, start_at=start, end_at=start + timedelta(hours=4), created_by=actor
    )
    source = {
        "hahitantsoa_event_draft" if domain == "hahitantsoa" else "reservation_draft": dossier
    }
    receipt = DocumentInstance.objects.create(
        **source,
        customer=customer,
        template_key="RECU-PAIEMENT",
        template_version="1.0",
        template_label="Reçu historique",
        business_scope=domain,
        document_type="recu",
        document_reference=f"{dossier.public_reference}-REC-01",
        status="generated",
        customer_display_name="Identité figée historique",
    )
    payment = Payment.objects.create(
        **source,
        receipt_document=receipt if linked else None,
        payment_kind="deposit",
        payment_method="cash",
        payment_status="confirmed" if linked else "pending",
        amount=Decimal("125000.00"),
        paid_at=timezone.now() if linked else None,
        confirmed_at=timezone.now() if linked else None,
        confirmed_by=actor if linked else None,
    )
    return receipt, payment


def _artifact_url(receipt):
    return f"/api/v1/documents/instances/{receipt.pk}/artifact/"


@pytest.mark.parametrize("domain", ["titan", "hahitantsoa"])
@pytest.mark.parametrize("status", ["generated", "issued"])
def test_private_get_recovers_legacy_receipt_once_and_pdf_preserves_identity(
    actor_client, storage, settings, domain, status
):
    actor, client = actor_client
    receipt, payment = _receipt(domain, actor)
    if status == "issued":
        receipt.status = status
        receipt.issued_at = timezone.now() - timedelta(days=2)
        receipt.save(update_fields=["status", "issued_at"])
    old_document = DocumentInstance.objects.values().get(pk=receipt.pk)
    old_payment = Payment.objects.values().get(pk=payment.pk)
    response = client.get(_artifact_url(receipt))
    assert response.status_code == 200
    html = response.content.decode()
    assert receipt.document_reference in html
    assert "125 000" in html
    assert "@page { size: 80mm 120mm; margin: 0; }" in html
    assert ("Hahitantsoa" if domain == "hahitantsoa" else "Titan") in html
    receipt.refresh_from_db()
    checksum = receipt.content_checksum
    path = receipt.storage_path
    assert storage.exists(path)
    response = client.get(_artifact_url(receipt))
    assert response.status_code == 200
    assert response.content.decode() == html
    if status == "generated":
        settings.DOCUMENT_PDF_GENERATOR_CLASS = "apps.documents.pdf.MockPDFGenerator"
        generate_document_instance_pdf(document_instance=receipt, actor=actor)
        receipt.refresh_from_db()
        with storage.open(receipt.pdf_storage_path, "rb") as artifact:
            assert artifact.read().startswith(b"%PDF")
    assert receipt.content_checksum == checksum
    assert receipt.storage_path == path
    changed_artifact_fields = {
        "storage_path",
        "content_checksum",
        "generated_content_size_bytes",
        "updated_at",
        "pdf_storage_path",
        "pdf_generated_at",
        "pdf_content_checksum",
    }
    new_document = DocumentInstance.objects.values().get(pk=receipt.pk)
    assert {k: v for k, v in new_document.items() if k not in changed_artifact_fields} == {
        k: v for k, v in old_document.items() if k not in changed_artifact_fields
    }
    assert Payment.objects.values().get(pk=payment.pk) == old_payment
    assert Payment.objects.count() == 1
    assert DocumentInstance.objects.count() == 1


@pytest.mark.parametrize("domain", ["titan", "hahitantsoa"])
def test_existing_legacy_artifact_is_returned_unchanged(actor_client, storage, domain):
    actor, client = actor_client
    receipt, _ = _receipt(domain, actor)
    original = b"<html>Original historical receipt bytes</html>"
    receipt.storage_path = storage.save("historical/receipt.html", ContentFile(original))
    receipt.content_checksum = "a" * 64
    receipt.save(update_fields=["storage_path", "content_checksum"])
    before = DocumentInstance.objects.values().get(pk=receipt.pk)
    response = client.get(_artifact_url(receipt))
    assert response.status_code == 200
    assert response.content == original
    assert DocumentInstance.objects.values().get(pk=receipt.pk) == before


@pytest.mark.parametrize("mismatch", ["unlinked", "scope", "dossier", "customer"])
def test_legacy_recovery_fails_closed_for_inconsistent_payment_source(
    actor_client, storage, mismatch
):
    actor, client = actor_client
    receipt, _ = _receipt("hahitantsoa", actor, linked=mismatch != "unlinked")
    if mismatch == "scope":
        receipt.business_scope = "titan"
        receipt.save(update_fields=["business_scope"])
    elif mismatch == "dossier":
        other, _ = _receipt("hahitantsoa", actor)
        receipt.hahitantsoa_event_draft_id = other.hahitantsoa_event_draft_id
        receipt.save(update_fields=["hahitantsoa_event_draft"])
    elif mismatch == "customer":
        receipt.customer = Customer.objects.create(display_name="Autre client")
        receipt.save(update_fields=["customer"])
    before = DocumentInstance.objects.values().get(pk=receipt.pk)
    response = client.get(_artifact_url(receipt))
    assert response.status_code == 404
    with pytest.raises(DocumentRuntimeGenerationError) as error:
        generate_document_instance_html(document_instance=receipt, actor=actor, force=True)
    assert error.value.code == (
        "payment_receipt_payment_not_found"
        if mismatch == "unlinked"
        else "payment_receipt_source_mismatch"
    )
    assert DocumentInstance.objects.values().get(pk=receipt.pk) == before
