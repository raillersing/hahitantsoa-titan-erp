from datetime import timedelta
from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError
from django.utils import timezone

from apps.customers.models import Customer
from apps.documents.models import DocumentInstance, DocumentInstanceStatus
from apps.hahitantsoa.models import HahitantsoaEventDraft
from apps.payments.models import Payment, PaymentKind, PaymentMethod, PaymentStatus
from apps.reservations.models import ReservationDraft

pytestmark = pytest.mark.django_db


def _customer() -> Customer:
    return Customer.objects.create(
        display_name="Payment customer",
        email="payment@example.test",
        phone="+261340000222",
        address="Antananarivo",
    )


def _reservation_draft() -> ReservationDraft:
    start_at = timezone.now().replace(microsecond=0) + timedelta(days=2)
    end_at = start_at + timedelta(hours=5)
    return ReservationDraft.objects.create(
        customer=_customer(),
        start_at=start_at,
        end_at=end_at,
        notes="Payment reservation draft",
    )


def _hahitantsoa_event_draft() -> HahitantsoaEventDraft:
    start_at = timezone.now().replace(microsecond=0) + timedelta(days=2)
    end_at = start_at + timedelta(hours=5)
    return HahitantsoaEventDraft.objects.create(
        customer=_customer(),
        event_name="Payment-linked event draft",
        start_at=start_at,
        end_at=end_at,
    )


def _generated_receipt_document() -> DocumentInstance:
    return DocumentInstance.objects.create(
        template_key="shared.payment_receipt.v1",
        template_version="v1",
        template_label="Recu de paiement",
        business_scope="shared",
        document_type="payment_receipt",
        template_status="generated_draft_template",
        template_source_kind="generated_from_brand_style",
        template_source_reference="docs/references/source/Document_B_Presentation_Metier_Evenementiel_v3.4.pdf",
        template_path="backend/apps/documents/templates_documents/shared/recu_paiement/v1/template.html",
        template_preview_path="backend/apps/documents/templates_documents/shared/recu_paiement/v1/preview.pdf",
        template_validated_by_client=False,
        template_notes=(
            "Draft placeholder only. Template content and PDF generation are out of scope for F98."
        ),
        reservation_public_reference="",
        reservation_status="",
        customer_display_name="Standalone source",
        customer_email="",
        customer_phone="",
        customer_address="",
        status=DocumentInstanceStatus.GENERATED,
        content_checksum="a" * 64,
        storage_path="documents/test/receipt.html",
        generated_content_size_bytes=128,
    )


def test_payment_model_accepts_pending_standalone_payment_with_source_label() -> None:
    payment = Payment(
        payment_kind=PaymentKind.OTHER,
        payment_method=PaymentMethod.CASH,
        payment_status=PaymentStatus.PENDING,
        amount=Decimal("150000.00"),
        source_label="Owner cashbox",
    )

    payment.full_clean()
    payment.save()

    assert payment.id is not None


def test_payment_model_rejects_non_positive_amount() -> None:
    payment = Payment(
        payment_kind=PaymentKind.OTHER,
        payment_method=PaymentMethod.CASH,
        payment_status=PaymentStatus.PENDING,
        amount=Decimal("0.00"),
        source_label="Standalone source",
    )

    with pytest.raises(ValidationError) as error_info:
        payment.full_clean()

    assert "amount" in error_info.value.message_dict


def test_payment_model_rejects_standalone_payment_without_source_label() -> None:
    payment = Payment(
        payment_kind=PaymentKind.OTHER,
        payment_method=PaymentMethod.CASH,
        payment_status=PaymentStatus.PENDING,
        amount=Decimal("1.00"),
        source_label="",
    )

    with pytest.raises(ValidationError) as error_info:
        payment.full_clean()

    assert "source_label" in error_info.value.message_dict


def test_payment_model_rejects_confirmed_payment_without_generated_receipt() -> None:
    payment = Payment(
        reservation_draft=_reservation_draft(),
        payment_kind=PaymentKind.DEPOSIT,
        payment_method=PaymentMethod.BANK_TRANSFER,
        payment_status=PaymentStatus.CONFIRMED,
        amount=Decimal("500000.00"),
        paid_at=timezone.now(),
    )

    with pytest.raises(ValidationError) as error_info:
        payment.full_clean()

    assert "receipt_document" in error_info.value.message_dict


def test_payment_model_accepts_confirmed_payment_with_generated_receipt() -> None:
    receipt_document = _generated_receipt_document()
    from django.contrib.auth import get_user_model

    actor = get_user_model().objects.create_user(
        username="payment-model-confirmer",
        password="test-pass",
    )
    payment = Payment(
        reservation_draft=_reservation_draft(),
        receipt_document=receipt_document,
        payment_kind=PaymentKind.DEPOSIT,
        payment_method=PaymentMethod.BANK_TRANSFER,
        payment_status=PaymentStatus.CONFIRMED,
        amount=Decimal("500000.00"),
        paid_at=timezone.now(),
        confirmed_at=timezone.now(),
        confirmed_by=actor,
    )

    payment.full_clean()


def test_payment_model_accepts_pending_hahitantsoa_event_draft_payment() -> None:
    payment = Payment(
        hahitantsoa_event_draft=_hahitantsoa_event_draft(),
        payment_kind=PaymentKind.DEPOSIT,
        payment_method=PaymentMethod.CASH,
        payment_status=PaymentStatus.PENDING,
        amount=Decimal("150000.00"),
    )

    payment.full_clean()
    payment.save()

    assert payment.id is not None
    assert payment.hahitantsoa_event_draft_id is not None


def test_payment_model_rejects_linking_both_draft_types() -> None:
    payment = Payment(
        reservation_draft=_reservation_draft(),
        hahitantsoa_event_draft=_hahitantsoa_event_draft(),
        payment_kind=PaymentKind.DEPOSIT,
        payment_method=PaymentMethod.CASH,
        payment_status=PaymentStatus.PENDING,
        amount=Decimal("150000.00"),
    )

    with pytest.raises(ValidationError) as error_info:
        payment.full_clean()

    assert "hahitantsoa_event_draft" in error_info.value.message_dict
