from datetime import datetime, time, timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from apps.customers.models import Customer, CustomerLifecycleStatus
from apps.hahitantsoa.commercial_terms import (
    calculate_duration_supplement,
    get_hahitantsoa_event_draft_access_schedule,
)
from apps.hahitantsoa.models import (
    HahitantsoaCommercialTerms,
    HahitantsoaDurationOption,
    HahitantsoaEventDraft,
    HahitantsoaEventDraftStatus,
)


def test_night_option_one_excludes_night_security_supplement() -> None:
    terms = HahitantsoaCommercialTerms(
        night_option_1_amount=Decimal("300000.00"),
        night_option_2_amount=Decimal("500000.00"),
        night_security_amount=Decimal("120000.00"),
    )

    assert calculate_duration_supplement(
        terms=terms,
        duration_option=HahitantsoaDurationOption.NIGHT_1,
    ) == Decimal("300000.00")
    assert calculate_duration_supplement(
        terms=terms,
        duration_option=HahitantsoaDurationOption.NIGHT_2,
    ) == Decimal("620000.00")


@pytest.mark.django_db
def test_prior_confirmed_night_two_requires_same_day_access_only() -> None:
    customer = Customer.objects.create(
        display_name="Client durée Hahitantsoa",
        lifecycle_status=CustomerLifecycleStatus.CLIENT,
    )
    current_timezone = timezone.get_current_timezone()
    event_day = timezone.localdate() + timedelta(days=14)
    event_start = timezone.make_aware(datetime.combine(event_day, time(10, 0)), current_timezone)
    event_end = event_start + timedelta(hours=10)
    venue_name = "Salle Hahitantsoa"

    HahitantsoaEventDraft.objects.create(
        customer=customer,
        event_name="Réception nocturne la veille",
        venue_name=venue_name,
        duration_option=HahitantsoaDurationOption.NIGHT_2,
        status=HahitantsoaEventDraftStatus.CONFIRMED,
        start_at=event_start - timedelta(days=1),
        end_at=event_start - timedelta(hours=6),
    )
    event_draft = HahitantsoaEventDraft.objects.create(
        customer=customer,
        event_name="Réception du lendemain",
        venue_name=venue_name,
        duration_option=HahitantsoaDurationOption.DAY,
        start_at=event_start,
        end_at=event_end,
    )

    assert get_hahitantsoa_event_draft_access_schedule(event_draft=event_draft) == "same_day"


@pytest.mark.django_db
def test_prior_day_or_night_one_keeps_day_before_access() -> None:
    customer = Customer.objects.create(
        display_name="Client accès J-1",
        lifecycle_status=CustomerLifecycleStatus.CLIENT,
    )
    current_timezone = timezone.get_current_timezone()
    event_day = timezone.localdate() + timedelta(days=14)
    event_start = timezone.make_aware(datetime.combine(event_day, time(10, 0)), current_timezone)
    venue_name = "Salle Hahitantsoa"

    HahitantsoaEventDraft.objects.create(
        customer=customer,
        event_name="Réception nuit option un la veille",
        venue_name=venue_name,
        duration_option=HahitantsoaDurationOption.NIGHT_1,
        status=HahitantsoaEventDraftStatus.CONFIRMED,
        start_at=event_start - timedelta(days=1),
        end_at=event_start - timedelta(hours=12),
    )
    event_draft = HahitantsoaEventDraft.objects.create(
        customer=customer,
        event_name="Réception avec accès J-1",
        venue_name=venue_name,
        duration_option=HahitantsoaDurationOption.DAY,
        start_at=event_start,
        end_at=event_start + timedelta(hours=10),
    )

    assert get_hahitantsoa_event_draft_access_schedule(event_draft=event_draft) == "day_before"
