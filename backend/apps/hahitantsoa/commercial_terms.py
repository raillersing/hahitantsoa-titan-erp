from __future__ import annotations

import calendar
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from decimal import ROUND_HALF_UP, Decimal

from django.utils import timezone

from apps.hahitantsoa.models import (
    HahitantsoaCommercialTerms,
    HahitantsoaDurationOption,
    HahitantsoaEventDraft,
    HahitantsoaRentalType,
)

MONEY_QUANTUM = Decimal("0.01")


def get_hahitantsoa_commercial_terms() -> HahitantsoaCommercialTerms:
    terms, _ = HahitantsoaCommercialTerms.objects.get_or_create(key="default")
    return terms


def calculate_duration_supplement(
    *, terms: HahitantsoaCommercialTerms, duration_option: str
) -> Decimal:
    if duration_option == HahitantsoaDurationOption.NIGHT_1:
        return terms.night_option_1_amount.quantize(MONEY_QUANTUM)
    if duration_option == HahitantsoaDurationOption.NIGHT_2:
        return (terms.night_option_2_amount + terms.night_security_amount).quantize(MONEY_QUANTUM)
    return Decimal("0.00")


def calculate_space_rental_amount(
    *,
    terms: HahitantsoaCommercialTerms,
    guest_count: int,
    duration_option: str = HahitantsoaDurationOption.DAY,
) -> Decimal:
    excess_guests = max(guest_count - terms.included_guest_count, 0)
    return (
        terms.base_space_rental_amount
        + terms.excess_guest_amount * excess_guests
        + calculate_duration_supplement(terms=terms, duration_option=duration_option)
    ).quantize(MONEY_QUANTUM)


def get_hahitantsoa_event_draft_access_schedule(*, event_draft: HahitantsoaEventDraft) -> str:
    """Return the contract access rule from confirmed prior-day venue occupancy."""
    event_day = timezone.localtime(event_draft.start_at).date()
    previous_day = event_day - timedelta(days=1)
    current_timezone = timezone.get_current_timezone()
    previous_day_start = timezone.make_aware(
        datetime.combine(previous_day, time.min), current_timezone
    )
    event_day_start = timezone.make_aware(datetime.combine(event_day, time.min), current_timezone)
    prior_night_2_exists = (
        HahitantsoaEventDraft.objects.filter(
            status="confirmed",
            is_deleted=False,
            venue_key=event_draft.venue_key,
            duration_option=HahitantsoaDurationOption.NIGHT_2,
            start_at__gte=previous_day_start,
            start_at__lt=event_day_start,
        )
        .exclude(pk=event_draft.pk)
        .exists()
    )
    return "same_day" if prior_night_2_exists else "day_before"


def default_deposit_amount(*, terms: HahitantsoaCommercialTerms, rental_type: str) -> Decimal:
    if rental_type == HahitantsoaRentalType.LOGISTICS:
        return terms.logistics_deposit_amount.quantize(MONEY_QUANTUM)
    return terms.bare_deposit_amount.quantize(MONEY_QUANTUM)


def subtract_one_calendar_month(value: date) -> date:
    previous_month = value.month - 1 or 12
    previous_year = value.year - 1 if value.month == 1 else value.year
    return value.replace(
        year=previous_year,
        month=previous_month,
        day=min(value.day, calendar.monthrange(previous_year, previous_month)[1]),
    )


@dataclass(frozen=True)
class HahitantsoaPaymentSchedule:
    space_rental_amount: Decimal
    logistics_amount: Decimal
    total_amount: Decimal
    deposit_amount: Decimal
    remaining_after_deposit: Decimal
    first_installment_amount: Decimal
    second_installment_amount: Decimal
    first_installment_due_on: date
    second_installment_due_on: date


def get_hahitantsoa_payment_schedule(
    *, event_draft: HahitantsoaEventDraft
) -> HahitantsoaPaymentSchedule:
    logistics_amount = Decimal(str(event_draft.logistics_amount)).quantize(MONEY_QUANTUM)
    total_amount = Decimal(str(event_draft.total_amount)).quantize(MONEY_QUANTUM)
    deposit_amount = min(event_draft.required_deposit_amount, total_amount).quantize(MONEY_QUANTUM)
    remaining_after_deposit = (total_amount - deposit_amount).quantize(MONEY_QUANTUM)
    first_installment_amount = (remaining_after_deposit / 2).quantize(
        MONEY_QUANTUM, rounding=ROUND_HALF_UP
    )
    second_installment_amount = (remaining_after_deposit - first_installment_amount).quantize(
        MONEY_QUANTUM
    )
    event_date = event_draft.start_at.date()
    return HahitantsoaPaymentSchedule(
        space_rental_amount=event_draft.space_rental_amount.quantize(MONEY_QUANTUM),
        logistics_amount=logistics_amount,
        total_amount=total_amount,
        deposit_amount=deposit_amount,
        remaining_after_deposit=remaining_after_deposit,
        first_installment_amount=first_installment_amount,
        second_installment_amount=second_installment_amount,
        first_installment_due_on=subtract_one_calendar_month(event_date),
        second_installment_due_on=event_date.fromordinal(event_date.toordinal() - 10),
    )


def recalculate_hahitantsoa_event_draft_totals(*, event_draft: HahitantsoaEventDraft) -> None:
    """Persist the commercial snapshot from immutable event-draft line prices."""
    from apps.documents.formatting import parse_hahitantsoa_services_total

    logistics_amount = sum(
        (
            line.unit_rental_price * line.quantity
            for line in event_draft.lines.filter(is_deleted=False)
        ),
        Decimal("0"),
    ).quantize(MONEY_QUANTUM)
    services_amount = parse_hahitantsoa_services_total(event_draft.service_notes).quantize(
        MONEY_QUANTUM
    )
    event_draft.logistics_amount = logistics_amount
    event_draft.total_amount = (
        event_draft.space_rental_amount + logistics_amount + services_amount
    ).quantize(MONEY_QUANTUM)
    event_draft.full_clean()
    event_draft.save(update_fields=["logistics_amount", "total_amount", "updated_at"])
