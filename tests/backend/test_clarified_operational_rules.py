from datetime import UTC, date, datetime, time, timedelta
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.cashbox.models import CashboxOperatorAccount
from apps.cashbox.services import get_or_create_operator_cash_account
from apps.customers.models import Customer
from apps.documents.models import DocumentInstance
from apps.finance.models import FinanceAccountKind
from apps.inventory.models import (
    InventoryAvailability,
    InventoryAvailabilityStatus,
    InventoryItem,
)
from apps.logistics.models import LogisticsEvent, TitanClosedDay
from apps.logistics.services import (
    LogisticsServiceError,
    default_logistics_scheduled_at,
    next_titan_working_day,
    previous_titan_working_day,
)
from apps.reservations.amendments import (
    ReservationAmendmentError,
    create_reservation_draft_amendment,
)
from apps.reservations.models import ReservationDraft, ReservationDraftLine

pytestmark = pytest.mark.django_db


def test_titan_previous_and_next_working_days_skip_configured_closed_day():
    TitanClosedDay.objects.create(date=date(2026, 6, 26), label="Férié")

    assert previous_titan_working_day(scheduled_date=date(2026, 6, 26)) == date(2026, 6, 25)
    assert next_titan_working_day(scheduled_date=date(2026, 6, 26)) == date(2026, 6, 27)


def test_titan_default_outbound_and_return_dates_follow_client_rule():
    start = timezone.make_aware(datetime(2026, 6, 27, 12, 0), UTC)
    end = timezone.make_aware(datetime(2026, 6, 25, 12, 0), UTC)
    TitanClosedDay.objects.create(date=date(2026, 6, 26), label="Férié")

    outbound = default_logistics_scheduled_at(reservation_start_at=start)
    returned = default_logistics_scheduled_at(reservation_start_at=end, operation="return")

    assert outbound.date() == date(2026, 6, 25)
    assert returned.date() == date(2026, 6, 27)
    assert outbound.time() == time(6, 0)
    assert returned.time() == time(6, 0)


def test_each_authorized_operator_gets_one_stable_cash_account():
    operator = get_user_model().objects.create_user(
        username="cashbox-operator-rule",
        password="test-pass",
        is_staff=True,
    )

    first = get_or_create_operator_cash_account(operator=operator, actor=operator)
    second = get_or_create_operator_cash_account(operator=operator, actor=operator)

    assert first.pk == second.pk
    assert first.kind == FinanceAccountKind.CASH
    assert first.currency == "MGA"
    assert CashboxOperatorAccount.objects.filter(operator=operator).count() == 1


def test_titan_schedule_rejects_closed_day_and_outside_hours():
    from apps.logistics.services import _validate_operational_schedule

    TitanClosedDay.objects.create(date=date(2026, 6, 26), label="Férié")
    closed = timezone.make_aware(datetime(2026, 6, 26, 10, 0), UTC)
    too_early = timezone.make_aware(datetime(2026, 6, 25, 5, 59), UTC)

    with pytest.raises(LogisticsServiceError, match="jour férié"):
        _validate_operational_schedule(scheduled_at=closed)
    with pytest.raises(LogisticsServiceError, match="06:00 et 22:00"):
        _validate_operational_schedule(scheduled_at=too_early)


def test_titan_amendment_updates_dates_and_quantities_without_resetting_status():
    actor = get_user_model().objects.create_user(
        username="amendment-operator",
        password="test-pass",
        is_staff=True,
    )
    customer = Customer.objects.create(display_name="Amendment client")
    item = InventoryItem.objects.create(
        name="Amendment item",
        kind="material",
        rental_price="1000.00",
    )
    added_item = InventoryItem.objects.create(
        name="Amendment added item",
        kind="material",
        rental_price="2000.00",
    )
    start_at = timezone.now().replace(microsecond=0) + timedelta(days=3)
    draft = ReservationDraft.objects.create(
        customer=customer,
        start_at=start_at,
        end_at=start_at + timedelta(hours=3),
        status="confirmed",
        confirmed_at=timezone.now(),
        confirmed_by=actor,
        subtotal_amount="1000.00",
        total_amount="1000.00",
    )
    line = ReservationDraftLine.objects.create(
        reservation_draft=draft,
        inventory_item=item,
        quantity=1,
        unit_rental_price="1000.00",
    )
    previous_block = InventoryAvailability.objects.create(
        inventory_item=item,
        reservation_draft=draft,
        status=InventoryAvailabilityStatus.RESERVED,
        start_at=start_at,
        end_at=start_at + timedelta(hours=3),
    )

    with (
        patch(
            "apps.reservations.amendments.generate_reservation_draft_document_instance_html"
        ) as generate_html,
        patch("apps.reservations.amendments.generate_document_instance_pdf") as generate_pdf,
    ):
        document = DocumentInstance.objects.create(
            template_key="titan.material_amendment.v1",
            reservation_draft=draft,
            status="prepared",
        )
        generate_html.return_value = document
        generate_pdf.return_value = document
        result = create_reservation_draft_amendment(
            reservation_draft=draft,
            actor=actor,
            reason="Quantité modifiée",
            changed_end_at=start_at + timedelta(hours=5),
            changed_lines=[
                {"inventory_item": item, "quantity": 2, "notes": "Deux unités"},
                {"inventory_item": added_item, "quantity": 1, "notes": "Ajout"},
            ],
        )

    draft.refresh_from_db()
    assert result.amendment.changed_end_at == start_at + timedelta(hours=5)
    assert draft.status == "confirmed"
    assert draft.end_at == start_at + timedelta(hours=5)
    active_lines = draft.lines.filter(is_deleted=False).order_by("inventory_item__name")
    assert active_lines.get(inventory_item=item).quantity == 2
    assert active_lines.get(inventory_item=item).unit_rental_price == 1000
    assert active_lines.get(inventory_item=added_item).unit_rental_price == 2000
    assert draft.subtotal_amount == 4000
    assert draft.total_amount == 4000
    line.refresh_from_db()
    assert line.is_deleted is False
    previous_block.refresh_from_db()
    assert previous_block.is_deleted is True
    blocks = draft.inventory_availability_blocks.filter(is_deleted=False)
    assert blocks.count() == 2
    assert {block.inventory_item_id for block in blocks} == {item.id, added_item.id}
    assert all(block.end_at == start_at + timedelta(hours=5) for block in blocks)


def test_titan_amendment_is_blocked_after_logistics_dispatch():
    actor = get_user_model().objects.create_user(
        username="amendment-dispatch-operator",
        password="test-pass",
        is_staff=True,
    )
    start_at = timezone.now().replace(microsecond=0) + timedelta(days=3)
    draft = ReservationDraft.objects.create(
        customer=Customer.objects.create(display_name="Client expédition"),
        start_at=start_at,
        end_at=start_at + timedelta(hours=3),
        status="confirmed",
        confirmed_at=timezone.now(),
        confirmed_by=actor,
    )
    item = InventoryItem.objects.create(name="Article expédié", kind="material")
    ReservationDraftLine.objects.create(reservation_draft=draft, inventory_item=item, quantity=1)
    LogisticsEvent.objects.create(
        reservation_draft=draft,
        event_type="handover",
        status="dispatched",
        scheduled_at=start_at - timedelta(days=1),
    )

    with pytest.raises(ReservationAmendmentError, match="corrective workflow") as error:
        create_reservation_draft_amendment(
            reservation_draft=draft,
            actor=actor,
            reason="Modification tardive",
        )

    assert error.value.code == "amendment_operationally_locked"
