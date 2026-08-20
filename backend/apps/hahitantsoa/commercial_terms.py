from __future__ import annotations

import calendar
from dataclasses import dataclass
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from apps.hahitantsoa.models import (
    HahitantsoaCommercialTerms,
    HahitantsoaEventDraft,
    HahitantsoaRentalType,
)

MONEY_QUANTUM = Decimal("0.01")


def get_hahitantsoa_commercial_terms() -> HahitantsoaCommercialTerms:
    terms, _ = HahitantsoaCommercialTerms.objects.get_or_create(key="default")
    return terms


def calculate_space_rental_amount(
    *, terms: HahitantsoaCommercialTerms, guest_count: int
) -> Decimal:
    excess_guests = max(guest_count - terms.included_guest_count, 0)
    return (terms.base_space_rental_amount + terms.excess_guest_amount * excess_guests).quantize(
        MONEY_QUANTUM
    )


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
    logistics_amount = sum(
        (
            line.unit_rental_price * line.quantity
            for line in event_draft.lines.filter(is_deleted=False)
        ),
        Decimal("0"),
    ).quantize(MONEY_QUANTUM)
    total_amount = (event_draft.space_rental_amount + logistics_amount).quantize(MONEY_QUANTUM)
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
