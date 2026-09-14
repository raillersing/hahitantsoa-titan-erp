from datetime import timedelta
from decimal import Decimal

import pytest
from django.template.loader import render_to_string
from django.utils import timezone

from apps.customers.models import Customer
from apps.documents.models import DocumentInstance, DocumentInstanceStatus
from apps.documents.payment_receipts import (
    HAHITANTSOA_PAYMENT_RECEIPT_TEMPLATE_KEY,
    TITAN_PAYMENT_RECEIPT_TEMPLATE_KEY,
    build_payment_receipt_context,
    payment_receipt_template_key,
)
from apps.hahitantsoa.models import HahitantsoaEventDraft
from apps.payments.models import Payment, PaymentKind, PaymentMethod, PaymentStatus
from apps.reservations.models import ReservationDraft

pytestmark = pytest.mark.django_db


def _document(*, event: HahitantsoaEventDraft, payment_template: bool = False):
    return DocumentInstance.objects.create(
        hahitantsoa_event_draft=event,
        customer=event.customer,
        template_key=(
            HAHITANTSOA_PAYMENT_RECEIPT_TEMPLATE_KEY
            if payment_template
            else "hahitantsoa.proforma.v1"
        ),
        template_version="v1",
        template_label="Reçu" if payment_template else "Proforma Hahitantsoa",
        business_scope="hahitantsoa",
        document_type="payment_receipt" if payment_template else "proforma",
        template_status="source_backed_template",
        template_source_kind="source_image",
        template_source_reference="test",
        template_path="test.html",
        template_preview_path="test.pdf",
        reservation_public_reference="118/026",
        reservation_status=event.status,
        customer_display_name=event.customer.display_name,
        status=DocumentInstanceStatus.GENERATED,
    )


def test_hahitantsoa_receipt_context_contains_history_and_event_fields(django_user_model):
    actor = django_user_model.objects.create_user(username="receipt-context-actor")
    start_at = timezone.now().replace(microsecond=0) + timedelta(days=3)
    customer = Customer.objects.create(display_name="RANDRIANARIMALAIA Mamitiana")
    event = HahitantsoaEventDraft.objects.create(
        customer=customer,
        event_name="Test event",
        public_reference="H-012/2026",
        space_rental_amount=Decimal("3000000.00"),
        total_amount=Decimal("3000000.00"),
        start_at=start_at,
        end_at=start_at + timedelta(hours=4),
    )
    proforma = _document(event=event)
    receipt = _document(event=event, payment_template=True)
    first = Payment.objects.create(
        hahitantsoa_event_draft=event,
        receipt_document=_document(event=event, payment_template=True),
        payment_kind=PaymentKind.DEPOSIT,
        payment_method=PaymentMethod.CASH,
        payment_status=PaymentStatus.CONFIRMED,
        amount=Decimal("1500000.00"),
        paid_at=start_at - timedelta(days=2),
        confirmed_at=start_at - timedelta(days=2),
        confirmed_by=actor,
    )
    payment = Payment.objects.create(
        hahitantsoa_event_draft=event,
        receipt_document=receipt,
        payment_kind=PaymentKind.DEPOSIT,
        payment_method=PaymentMethod.MOBILE_MONEY,
        payment_status=PaymentStatus.CONFIRMED,
        amount=Decimal("710000.00"),
        paid_at=start_at - timedelta(days=1),
        external_reference="4485796407",
        confirmed_at=start_at - timedelta(days=1),
        confirmed_by=actor,
    )

    assert proforma.document_type == "proforma"
    assert first.id != payment.id
    assert payment_receipt_template_key(payment=payment) == HAHITANTSOA_PAYMENT_RECEIPT_TEMPLATE_KEY

    context = build_payment_receipt_context(payment=payment)

    assert context.template.key == HAHITANTSOA_PAYMENT_RECEIPT_TEMPLATE_KEY
    assert context.payment.customer_display_name == customer.display_name
    assert context.payment.event_date == event.start_at
    assert context.payment.amount_label == "710 000"
    assert context.payment.payment_method_label == "Mvola"
    assert context.payment.transaction_reference == "4485796407"
    assert context.payment.total_deposit_label == "2 210 000"
    assert context.payment.proforma_reference == "118/026"
    assert context.payment.proforma_amount_label == "3 000 000"
    assert context.payment.remaining_balance_label == "790 000"
    assert len(context.payment.history) == 2


def test_hahitantsoa_receipt_with_cheque_details_and_rendering(django_user_model):
    actor = django_user_model.objects.create_user(username="cheque-test-actor")
    start_at = timezone.now().replace(microsecond=0) + timedelta(days=5)
    customer = Customer.objects.create(display_name="RAKOTOARISOA Hery")
    event = HahitantsoaEventDraft.objects.create(
        customer=customer,
        event_name="Mariage",
        public_reference="H-045/2026",
        space_rental_amount=Decimal("2000000.00"),
        total_amount=Decimal("2000000.00"),
        start_at=start_at,
        end_at=start_at + timedelta(hours=6),
    )
    _document(event=event)
    receipt = _document(event=event, payment_template=True)
    payment = Payment.objects.create(
        hahitantsoa_event_draft=event,
        receipt_document=receipt,
        payment_kind=PaymentKind.DEPOSIT,
        payment_method=PaymentMethod.CHEQUE,
        payment_status=PaymentStatus.CONFIRMED,
        amount=Decimal("1000000.00"),
        paid_at=start_at - timedelta(days=2),
        bank_name="BNI Madagascar",
        check_number="CHQ-778899",
        confirmed_at=start_at - timedelta(days=2),
        confirmed_by=actor,
    )

    context = build_payment_receipt_context(payment=payment)
    assert context.payment.bank_name == "BNI Madagascar"
    assert context.payment.check_number == "CHQ-778899"
    assert context.payment.payment_method_label == "Chèque"

    rendered_html = render_to_string(
        "documents/hahitantsoa_payment_receipt.html",
        {"context": context},
    )
    assert "Chèque" in rendered_html
    assert "Nom de la banque" in rendered_html
    assert "BNI Madagascar" in rendered_html
    assert "N° Chèque" in rendered_html
    assert "CHQ-778899" in rendered_html
    assert "Date Evénement" in rendered_html
    assert "Document officiel généré par" not in rendered_html
    assert "Signature" not in rendered_html
    assert "color: #000000" in rendered_html


def test_caution_receipt_rendering_without_rental_history_or_balance(django_user_model):
    actor = django_user_model.objects.create_user(username="caution-test-actor")
    start_at = timezone.now().replace(microsecond=0) + timedelta(days=7)
    customer = Customer.objects.create(display_name="ANDRIANASOLO Faly")
    event = HahitantsoaEventDraft.objects.create(
        customer=customer,
        event_name="Concert",
        public_reference="H-099/2026",
        space_rental_amount=Decimal("5000000.00"),
        total_amount=Decimal("5000000.00"),
        start_at=start_at,
        end_at=start_at + timedelta(hours=8),
    )
    _document(event=event)
    receipt = _document(event=event, payment_template=True)
    caution_payment = Payment.objects.create(
        hahitantsoa_event_draft=event,
        receipt_document=receipt,
        payment_kind=PaymentKind.CAUTION,
        payment_method=PaymentMethod.MVOLA,
        payment_status=PaymentStatus.CONFIRMED,
        amount=Decimal("500000.00"),
        paid_at=start_at - timedelta(days=1),
        external_reference="MV-998877",
        confirmed_at=start_at - timedelta(days=1),
        confirmed_by=actor,
    )

    context = build_payment_receipt_context(payment=caution_payment)
    assert context.payment.payment_kind == "caution"
    assert context.payment.amount_label == "500 000"
    assert context.payment.remaining_balance_label == ""

    rendered_html = render_to_string(
        "documents/hahitantsoa_payment_receipt.html",
        {"context": context},
    )
    assert "Reçu de dépôt de garantie" in rendered_html
    assert "Montant caution" in rendered_html
    assert "500 000 Ar" in rendered_html
    assert "Caution versée" in rendered_html
    assert "Dépôt de garantie (Caution)" in rendered_html
    assert "Historique des paiements" not in rendered_html
    assert "Reste à payer" not in rendered_html
    assert "Signature" not in rendered_html


def test_titan_receipt_with_virement_and_date_location(django_user_model):
    actor = django_user_model.objects.create_user(username="titan-receipt-actor")
    start_at = timezone.now().replace(microsecond=0) + timedelta(days=4)
    customer = Customer.objects.create(display_name="ENTREPRISE ABC")
    draft = ReservationDraft.objects.create(
        customer=customer,
        public_reference="RES-2026-0042",
        start_at=start_at,
        end_at=start_at + timedelta(days=2),
    )
    receipt = DocumentInstance.objects.create(
        reservation_draft=draft,
        customer=customer,
        template_key=TITAN_PAYMENT_RECEIPT_TEMPLATE_KEY,
        template_version="v1",
        template_label="Reçu Titan",
        business_scope="titan",
        document_type="payment_receipt",
        template_status="source_backed_template",
        template_source_kind="source_image",
        template_source_reference="titan-test",
        template_path="titan_test.html",
        template_preview_path="titan_test.pdf",
        reservation_public_reference=draft.public_reference,
        customer_display_name=customer.display_name,
        status=DocumentInstanceStatus.GENERATED,
    )
    payment = Payment.objects.create(
        reservation_draft=draft,
        receipt_document=receipt,
        payment_kind=PaymentKind.DEPOSIT,
        payment_method=PaymentMethod.VIREMENT,
        payment_status=PaymentStatus.CONFIRMED,
        amount=Decimal("1200000.00"),
        bank_name="BMOI",
        external_reference="VIR-554433",
        paid_at=start_at - timedelta(days=2),
        confirmed_at=start_at - timedelta(days=2),
        confirmed_by=actor,
    )

    context = build_payment_receipt_context(payment=payment)
    assert context.template.key == TITAN_PAYMENT_RECEIPT_TEMPLATE_KEY
    assert context.payment.payment_method_label == "Virement"
    assert context.payment.bank_name == "BMOI"
    assert context.payment.transaction_reference == "VIR-554433"

    rendered_html = render_to_string(
        "documents/titan_payment_receipt.html",
        {"context": context},
    )
    assert "Reçu de paiement d'acompte" in rendered_html
    assert "Date Location" in rendered_html
    assert "Nom de la banque" in rendered_html
    assert "BMOI" in rendered_html
    assert "Réf. Paiement" not in rendered_html or "Référence" in rendered_html
    assert "VIR-554433" in rendered_html
    assert "Signature" not in rendered_html
    assert "Document officiel généré par" not in rendered_html
    assert "color: #000000" in rendered_html
