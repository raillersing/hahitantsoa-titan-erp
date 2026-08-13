from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from apps.customers.models import Customer
from apps.documents.models import DocumentInstance, DocumentInstanceStatus
from apps.hahitantsoa.models import HahitantsoaEventDraft, HahitantsoaEventType
from apps.notifications.models import PaymentReminderDispatch, SystemNotification
from apps.notifications.services import prepare_payment_reminder_dispatch
from apps.payments.models import Payment, PaymentKind, PaymentMethod, PaymentStatus
from apps.payments.reminders import (
    build_hahitantsoa_payment_reminder,
    build_reservation_payment_reminder,
)
from apps.reservations.models import ReservationDraft

pytestmark = pytest.mark.django_db


def _receipt() -> DocumentInstance:
    return DocumentInstance.objects.create(
        template_key="shared.payment_receipt.v1",
        template_version="v1",
        template_label="Reçu de paiement",
        business_scope="shared",
        document_type="payment_receipt",
        template_status="generated_draft_template",
        template_source_kind="generated_from_brand_style",
        template_source_reference="test",
        template_path="test.html",
        template_preview_path="test.pdf",
        reservation_public_reference="",
        reservation_status="",
        customer_display_name="Client",
        customer_email="",
        customer_phone="",
        customer_address="",
        status=DocumentInstanceStatus.GENERATED,
        content_checksum="a" * 64,
        storage_path="documents/test/receipt.html",
        generated_content_size_bytes=128,
    )


def _customer(*, phone: str = "+261 34 00 00 333") -> Customer:
    return Customer.objects.create(display_name="Client rappel", phone=phone)


def _period():
    start_at = timezone.now().replace(microsecond=0) + timedelta(days=3)
    return start_at, start_at + timedelta(hours=6)


def _confirmed_payment(
    *, actor, reservation_draft=None, hahitantsoa_event_draft=None, amount="125000.00"
):
    return Payment.objects.create(
        reservation_draft=reservation_draft,
        hahitantsoa_event_draft=hahitantsoa_event_draft,
        payment_kind=PaymentKind.DEPOSIT,
        payment_method=PaymentMethod.BANK_TRANSFER,
        payment_status=PaymentStatus.CONFIRMED,
        amount=Decimal(amount),
        paid_at=timezone.now(),
        receipt_document=_receipt(),
        confirmed_at=timezone.now(),
        confirmed_by=actor,
        created_by=actor,
        updated_by=actor,
        source_label="Client deposit",
    )


def test_titan_payment_reminder_contains_confirmed_recap_and_whatsapp_link(django_user_model):
    actor = django_user_model.objects.create_user(username="reminder-titan")
    start_at, end_at = _period()
    draft = ReservationDraft.objects.create(customer=_customer(), start_at=start_at, end_at=end_at)
    _confirmed_payment(actor=actor, reservation_draft=draft)
    _confirmed_payment(actor=actor, reservation_draft=draft, amount="50000.00")
    Payment.objects.create(
        reservation_draft=draft,
        payment_kind=PaymentKind.DEPOSIT,
        payment_method=PaymentMethod.CASH,
        payment_status=PaymentStatus.PENDING,
        amount=Decimal("999999.00"),
        source_label="Pending deposit",
        created_by=actor,
        updated_by=actor,
    )

    reminder = build_reservation_payment_reminder(reservation_draft=draft)

    assert reminder.business_scope == "titan"
    assert reminder.confirmed_payment_count == 2
    assert reminder.confirmed_amount == Decimal("175000.00")
    assert "Total confirmé : 175 000,00 MGA" in reminder.message
    assert reminder.whatsapp_url.startswith("https://wa.me/261340000333?text=")
    assert "999999" not in reminder.message


def test_hahitantsoa_payment_reminder_is_available_without_usable_phone(django_user_model):
    actor = django_user_model.objects.create_user(username="reminder-hahitantsoa")
    start_at, end_at = _period()
    event_draft = HahitantsoaEventDraft.objects.create(
        customer=_customer(phone="034 00 00 333"),
        event_name="Mariage de test",
        event_type=HahitantsoaEventType.WEDDING,
        start_at=start_at,
        end_at=end_at,
    )
    _confirmed_payment(actor=actor, hahitantsoa_event_draft=event_draft, amount="250000.00")

    reminder = build_hahitantsoa_payment_reminder(hahitantsoa_event_draft=event_draft)

    assert reminder.business_scope == "hahitantsoa"
    assert "événement Hahitantsoa — Mariage de test" in reminder.message
    assert reminder.whatsapp_url is None


def test_payment_reminder_endpoint_returns_prefilled_recap(client, django_user_model):
    actor = django_user_model.objects.create_user(username="reminder-api", is_staff=True)
    start_at, end_at = _period()
    draft = ReservationDraft.objects.create(customer=_customer(), start_at=start_at, end_at=end_at)
    _confirmed_payment(actor=actor, reservation_draft=draft)
    client.force_login(actor)

    response = client.get(
        "/api/v1/payments/reminder/whatsapp/",
        {"reservation_draft_id": str(draft.id)},
    )

    assert response.status_code == 200
    assert response.json()["business_scope"] == "titan"
    assert response.json()["confirmed_amount"] == "125000.00"
    assert response.json()["whatsapp_available"] is True


def test_payment_reminder_endpoint_requires_one_scope_identifier(client, django_user_model):
    actor = django_user_model.objects.create_user(username="reminder-api-validation", is_staff=True)
    client.force_login(actor)

    response = client.get("/api/v1/payments/reminder/whatsapp/")

    assert response.status_code == 400
    assert response.json()["code"] == "payment_reminder_single_draft_required"


def test_payment_reminder_dispatch_is_persistent_and_idempotent(django_user_model):
    actor = django_user_model.objects.create_user(username="reminder-dispatch")
    start_at, end_at = _period()
    draft = ReservationDraft.objects.create(customer=_customer(), start_at=start_at, end_at=end_at)

    first = prepare_payment_reminder_dispatch(
        actor=actor,
        reservation_draft=draft,
        reminder_key="j30",
    )
    second = prepare_payment_reminder_dispatch(
        actor=actor,
        reservation_draft=draft,
        reminder_key="j30",
    )

    assert first.id == second.id
    assert (
        PaymentReminderDispatch.objects.filter(reservation_draft=draft, reminder_key="j30").count()
        == 1
    )
    assert (
        SystemNotification.objects.filter(
            recipient=actor, link=f"/payment-reminders/{first.id}"
        ).count()
        == 1
    )


def test_payment_reminder_dispatch_api_requires_one_scope(client, django_user_model):
    actor = django_user_model.objects.create_user(username="reminder-dispatch-api", is_staff=True)
    client.force_login(actor)

    response = client.post(
        "/api/v1/notifications/payment-reminders/",
        {"reminder_key": "j10"},
        content_type="application/json",
    )

    assert response.status_code == 400
    assert response.json()["code"] == "single_draft_required"


def test_payment_reminder_dispatch_detail_is_available_to_authorized_staff(
    client, django_user_model
):
    actor = django_user_model.objects.create_user(
        username="reminder-detail-authorized", is_staff=True
    )
    start_at, end_at = _period()
    draft = ReservationDraft.objects.create(customer=_customer(), start_at=start_at, end_at=end_at)
    dispatch = prepare_payment_reminder_dispatch(actor=actor, reservation_draft=draft)
    client.force_login(actor)

    response = client.get(f"/api/v1/notifications/payment-reminders/{dispatch.id}/")

    assert response.status_code == 200
    assert response.json()["id"] == str(dispatch.id)
    assert response.json()["reservation_draft"] == str(draft.id)
    assert response.json()["reminder"]["draft_id"] == str(draft.id)
    assert response.json()["reminder"]["confirmed_amount"] == "0.00"


def test_payment_reminder_dispatch_detail_rejects_unauthorized_user(client, django_user_model):
    actor = django_user_model.objects.create_user(username="reminder-detail-owner", is_staff=True)
    other_actor = django_user_model.objects.create_user(
        username="reminder-detail-other", is_staff=False
    )
    start_at, end_at = _period()
    draft = ReservationDraft.objects.create(customer=_customer(), start_at=start_at, end_at=end_at)
    dispatch = prepare_payment_reminder_dispatch(actor=actor, reservation_draft=draft)
    client.force_login(other_actor)

    response = client.get(f"/api/v1/notifications/payment-reminders/{dispatch.id}/")

    assert response.status_code == 403
