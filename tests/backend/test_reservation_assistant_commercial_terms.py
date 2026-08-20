from datetime import datetime, timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from apps.customers.models import Customer, CustomerContactPoint
from apps.customers.serializers import CustomerSerializer
from apps.hahitantsoa.models import HahitantsoaEventDraft, HahitantsoaEventDraftLine
from apps.hahitantsoa.services import get_hahitantsoa_event_draft_prerequisite_status
from apps.inventory.models import InventoryItem

pytestmark = pytest.mark.django_db


def test_customer_contact_points_keep_multiple_values_and_sync_legacy_fields() -> None:
    serializer = CustomerSerializer(
        data={
            "display_name": "Client multi-contact",
            "contact_points": [
                {"kind": "email", "value": "first@example.test", "is_primary": True},
                {"kind": "email", "value": "second@example.test", "label": "Comptabilité"},
                {"kind": "phone", "value": "+261 34 00 000 01"},
                {"kind": "phone", "value": "+261 34 00 000 02", "label": "WhatsApp"},
            ],
        }
    )

    assert serializer.is_valid(), serializer.errors
    customer = serializer.save()

    assert CustomerContactPoint.objects.filter(customer=customer).count() == 4
    assert customer.email == "first@example.test"
    assert customer.phone == "+261 34 00 000 01"


def test_hahitantsoa_logistics_defaults_apply_the_tariff_and_payment_schedule(
    django_user_model,
) -> None:
    actor = django_user_model.objects.create_user(username="commercial-terms-user")
    customer = Customer.objects.create(display_name="Hahitantsoa customer")
    start_at = timezone.make_aware(datetime(2026, 10, 31, 9, 0))
    draft = HahitantsoaEventDraft.objects.create(
        customer=customer,
        event_name="Mise en place logistique",
        rental_type="logistics",
        guest_count=252,
        space_rental_amount=Decimal("6510000"),
        required_deposit_amount=Decimal("1500000"),
        start_at=start_at,
        end_at=start_at + timedelta(hours=8),
        created_by=actor,
    )
    line = HahitantsoaEventDraftLine.objects.create(
        event_draft=draft,
        inventory_item=InventoryItem.objects.create(
            name="Pack lumière", kind="material_pack", rental_price=Decimal("12500")
        ),
        quantity=2,
        unit_rental_price=Decimal("12500"),
    )

    from apps.hahitantsoa.commercial_terms import get_hahitantsoa_payment_schedule

    schedule = get_hahitantsoa_payment_schedule(event_draft=draft)
    assert line.unit_rental_price == Decimal("12500")
    assert schedule.logistics_amount == Decimal("25000.00")
    assert schedule.total_amount == Decimal("6535000.00")
    assert schedule.deposit_amount == Decimal("1500000.00")
    assert schedule.first_installment_amount == Decimal("2517500.00")
    assert schedule.second_installment_amount == Decimal("2517500.00")
    assert schedule.first_installment_due_on.isoformat() == "2026-09-30"
    assert schedule.second_installment_due_on.isoformat() == "2026-10-21"


def test_required_deposit_can_be_paid_in_multiple_confirmed_payments(django_user_model) -> None:
    actor = django_user_model.objects.create_user(username="split-deposit-user")
    customer = Customer.objects.create(display_name="Acompte fractionné")
    start_at = timezone.now().replace(microsecond=0) + timedelta(days=40)
    draft = HahitantsoaEventDraft.objects.create(
        customer=customer,
        event_name="Acompte fractionné",
        required_deposit_amount=Decimal("1500000"),
        start_at=start_at,
        end_at=start_at + timedelta(hours=6),
        created_by=actor,
    )
    from apps.payments.services import confirm_payment, create_payment

    for amount in ("500000", "1000000"):
        payment = create_payment(
            actor=actor,
            hahitantsoa_event_draft=draft,
            payment_kind="deposit",
            payment_method="cash",
            payment_status="pending",
            amount=amount,
        )
        confirm_payment(payment=payment, actor=actor)

    status = get_hahitantsoa_event_draft_prerequisite_status(event_draft=draft)
    assert status.deposit.truth_present is True
