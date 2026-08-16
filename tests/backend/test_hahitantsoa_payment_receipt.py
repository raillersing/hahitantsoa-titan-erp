from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from apps.customers.models import Customer
from apps.documents.models import DocumentInstance, DocumentInstanceStatus
from apps.documents.payment_receipts import (
    HAHITANTSOA_PAYMENT_RECEIPT_TEMPLATE_KEY,
    build_payment_receipt_context,
    payment_receipt_template_key,
)
from apps.hahitantsoa.models import HahitantsoaEventDraft
from apps.payments.models import Payment, PaymentKind, PaymentMethod, PaymentStatus

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
    assert context.payment.proforma_amount_label == ""
    assert context.payment.remaining_balance_label == ""
    assert len(context.payment.history) == 2
