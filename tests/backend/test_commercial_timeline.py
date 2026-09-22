from __future__ import annotations

from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.billing.models import BillingInvoice, BillingInvoiceSourceKind, BillingInvoiceStatus
from apps.common.commercial_timeline import get_commercial_timeline
from apps.customers.models import Customer
from apps.documents.models import DocumentInstance
from apps.hahitantsoa.models import (
    HahitantsoaDurationOption,
    HahitantsoaEventDraft,
    HahitantsoaEventDraftStatus,
    HahitantsoaEventType,
    HahitantsoaRentalType,
)
from apps.identity.models import ApplicationRole, UserRoleAssignment
from apps.identity.roles import CompanyRole
from apps.logistics.models import LogisticsEvent, LogisticsEventStatus, LogisticsEventType
from apps.payments.models import Payment, PaymentKind, PaymentMethod, PaymentStatus
from apps.reservations.models import ReservationDraft

pytestmark = pytest.mark.django_db
User = get_user_model()


@pytest.fixture
def commercial_user():
    user = User.objects.create_user(username="commercial_agent", password="password", is_staff=True)
    role, _ = ApplicationRole.objects.get_or_create(
        slug=CompanyRole.MANAGER.value,
        defaults={"name": "Manager"},
    )
    UserRoleAssignment.objects.create(user=user, role=role)
    return user


@pytest.fixture
def customer_titan():
    return Customer.objects.create(
        display_name="Titan Exclusive Client",
        nif="2001112223",
        stat="1112223334",
    )


@pytest.fixture
def customer_hahitantsoa():
    return Customer.objects.create(
        display_name="Hahitantsoa Event Client",
        nif="2004445556",
        stat="4445556667",
    )


def test_timeline_titan_reservation_and_related_events(commercial_user, customer_titan):
    """Titan reservation lifecycle and related records populate timeline with titan scope."""
    now = timezone.now()
    res = ReservationDraft.objects.create(
        customer=customer_titan,
        public_reference="RD-TITAN-TL-01",
        start_at=now + timezone.timedelta(days=1),
        end_at=now + timezone.timedelta(days=3),
        total_amount=Decimal("2500000.00"),
        confirmed_at=now + timezone.timedelta(hours=1),
        confirmed_by=commercial_user,
    )
    doc = DocumentInstance.objects.create(
        reservation_draft=res,
        customer=customer_titan,
        template_key="titan.invoice.v1",
        template_version="v1",
        template_label="Facture Titan",
        business_scope="titan",
        document_reference="FACT-TL-001",
        reservation_public_reference=res.public_reference,
        status="generated",
    )
    BillingInvoice.objects.create(
        reservation_draft=res,
        document_instance=doc,
        source_kind=BillingInvoiceSourceKind.COMMERCIAL_CLOSEOUT,
        invoice_status=BillingInvoiceStatus.OPEN,
        amount=Decimal("2500000.00"),
        issued_at=now,
        number="FACT-TL-001",
    )
    receipt_titan = DocumentInstance.objects.create(
        reservation_draft=res,
        customer=customer_titan,
        template_key="titan.payment_receipt.v1",
        template_version="v1",
        template_label="Reçu Titan",
        business_scope="titan",
        document_reference="REC-TL-001",
        reservation_public_reference=res.public_reference,
        status="generated",
    )
    Payment.objects.create(
        reservation_draft=res,
        amount=Decimal("1000000.00"),
        payment_kind=PaymentKind.DEPOSIT,
        payment_method=PaymentMethod.CASH,
        payment_status=PaymentStatus.CONFIRMED,
        paid_at=now,
        receipt_document=receipt_titan,
    )
    LogisticsEvent.objects.create(
        reservation_draft=res,
        event_type=LogisticsEventType.DELIVERY,
        status=LogisticsEventStatus.PLANNED,
        scheduled_at=now + timezone.timedelta(days=1),
    )

    timeline = get_commercial_timeline(customer_titan.id)
    assert len(timeline) >= 4

    types = [item["type"] for item in timeline]
    assert "reservation" in types
    assert "reservation_confirmed" in types
    assert "invoice" in types
    assert "payment" in types
    assert "logistics" in types

    res_item = next(i for i in timeline if i["type"] == "reservation")
    assert res_item["metadata"]["business_scope"] == "titan"
    assert res_item["metadata"]["amount"] == "2500000.00"
    assert res_item["metadata"]["reservation_draft_id"] == str(res.id)

    inv_item = next(i for i in timeline if i["type"] == "invoice")
    assert inv_item["metadata"]["business_scope"] == "titan"
    assert inv_item["metadata"]["amount"] == "2500000.00"

    pay_item = next(i for i in timeline if i["type"] == "payment")
    assert pay_item["metadata"]["business_scope"] == "titan"

    log_item = next(i for i in timeline if i["type"] == "logistics")
    assert log_item["metadata"]["business_scope"] == "titan"


def test_timeline_hahitantsoa_event_draft_and_related_events(commercial_user, customer_hahitantsoa):
    """Hahitantsoa event draft lifecycle and related records populate timeline (F24)."""
    now = timezone.now()
    event_draft = HahitantsoaEventDraft.objects.create(
        customer=customer_hahitantsoa,
        public_reference="EVT-HAHI-TL-01",
        event_name="Mariage Princier R&M",
        event_type=HahitantsoaEventType.WEDDING,
        rental_type=HahitantsoaRentalType.BARE,
        duration_option=HahitantsoaDurationOption.DAY,
        start_at=now + timezone.timedelta(days=10),
        end_at=now + timezone.timedelta(days=11),
        space_rental_amount=Decimal("4000000.00"),
        total_amount=Decimal("4000000.00"),
        status=HahitantsoaEventDraftStatus.CONFIRMED,
        confirmed_at=now + timezone.timedelta(hours=2),
        confirmed_by=commercial_user,
    )
    doc = DocumentInstance.objects.create(
        hahitantsoa_event_draft=event_draft,
        customer=customer_hahitantsoa,
        template_key="hahitantsoa.invoice.v1",
        template_version="v1",
        template_label="Facture Hahitantsoa",
        business_scope="hahitantsoa",
        document_reference="FACT-HAHI-001",
        reservation_public_reference=event_draft.public_reference,
        status="generated",
    )
    BillingInvoice.objects.create(
        hahitantsoa_event_draft=event_draft,
        document_instance=doc,
        source_kind=BillingInvoiceSourceKind.COMMERCIAL_CLOSEOUT,
        invoice_status=BillingInvoiceStatus.OPEN,
        amount=Decimal("4000000.00"),
        issued_at=now,
        number="FACT-HAHI-001",
    )
    receipt_hahi = DocumentInstance.objects.create(
        hahitantsoa_event_draft=event_draft,
        customer=customer_hahitantsoa,
        template_key="hahitantsoa.payment_receipt.v1",
        template_version="v1",
        template_label="Reçu Hahitantsoa",
        business_scope="hahitantsoa",
        document_reference="REC-HAHI-001",
        reservation_public_reference=event_draft.public_reference,
        status="generated",
    )
    Payment.objects.create(
        hahitantsoa_event_draft=event_draft,
        amount=Decimal("2000000.00"),
        payment_kind=PaymentKind.DEPOSIT,
        payment_method=PaymentMethod.BANK_TRANSFER,
        payment_status=PaymentStatus.CONFIRMED,
        paid_at=now,
        receipt_document=receipt_hahi,
    )
    LogisticsEvent.objects.create(
        hahitantsoa_event_draft=event_draft,
        event_type=LogisticsEventType.PREPARATION,
        status=LogisticsEventStatus.PLANNED,
        scheduled_at=now + timezone.timedelta(days=10),
    )

    timeline = get_commercial_timeline(customer_hahitantsoa.id)
    assert len(timeline) >= 4

    types = [item["type"] for item in timeline]
    assert "reservation" in types
    assert "reservation_confirmed" in types
    assert "invoice" in types
    assert "payment" in types
    assert "logistics" in types

    res_item = next(i for i in timeline if i["type"] == "reservation")
    assert res_item["metadata"]["business_scope"] == "hahitantsoa"
    assert res_item["metadata"]["hahitantsoa_event_draft_id"] == str(event_draft.id)
    assert res_item["metadata"]["event_name"] == "Mariage Princier R&M"
    assert res_item["metadata"]["amount"] == "4000000.00"

    inv_item = next(i for i in timeline if i["type"] == "invoice")
    assert inv_item["metadata"]["business_scope"] == "hahitantsoa"
    assert inv_item["metadata"]["hahitantsoa_event_draft_id"] == str(event_draft.id)

    pay_item = next(i for i in timeline if i["type"] == "payment")
    assert pay_item["metadata"]["business_scope"] == "hahitantsoa"
    assert pay_item["metadata"]["hahitantsoa_event_draft_id"] == str(event_draft.id)

    log_item = next(i for i in timeline if i["type"] == "logistics")
    assert log_item["metadata"]["business_scope"] == "hahitantsoa"
    assert log_item["metadata"]["hahitantsoa_event_draft_id"] == str(event_draft.id)


def test_timeline_api_endpoint(client, commercial_user, customer_hahitantsoa):
    """Customer timeline endpoint /api/v1/customers/<id>/timeline/ returns chronology."""
    now = timezone.now()
    HahitantsoaEventDraft.objects.create(
        customer=customer_hahitantsoa,
        public_reference="EVT-HAHI-API-01",
        event_name="Séminaire Annuel",
        event_type=HahitantsoaEventType.SEMINAR,
        rental_type=HahitantsoaRentalType.BARE,
        duration_option=HahitantsoaDurationOption.DAY,
        start_at=now + timezone.timedelta(days=5),
        end_at=now + timezone.timedelta(days=6),
        total_amount=Decimal("1500000.00"),
    )

    client.force_login(commercial_user)
    resp = client.get(f"/api/v1/customers/{customer_hahitantsoa.id}/timeline/")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    item = next(e for e in data if e["type"] == "reservation")
    assert item["metadata"]["business_scope"] == "hahitantsoa"
    assert item["metadata"]["event_name"] == "Séminaire Annuel"
