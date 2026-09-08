from __future__ import annotations

import logging

from django.db import transaction
from django.utils import timezone

from apps.documents.models import NumberingSequence, NumberingSequenceBrand

logger = logging.getLogger(__name__)

DEFAULT_PREFIX_BY_BRAND = {
    NumberingSequenceBrand.TITAN: "T-",
    NumberingSequenceBrand.HAHITANTSOA: "H-",
}


def _normalize_brand(brand: str) -> str:
    brand_str = str(brand).lower().strip()
    if brand_str in {NumberingSequenceBrand.TITAN, "t"}:
        return NumberingSequenceBrand.TITAN
    if brand_str in {NumberingSequenceBrand.HAHITANTSOA, "h"}:
        return NumberingSequenceBrand.HAHITANTSOA
    return brand_str


def get_or_create_numbering_sequence(
    brand: str,
    year: int | None = None,
) -> NumberingSequence:
    brand_norm = _normalize_brand(brand)
    current_year = year or timezone.now().year
    default_prefix = DEFAULT_PREFIX_BY_BRAND.get(brand_norm, "")

    seq, _ = NumberingSequence.objects.get_or_create(
        brand=brand_norm,
        year=current_year,
        defaults={
            "prefix": default_prefix,
            "next_number": 1,
            "padding": 3,
            "suffix_template": "/{year}",
        },
    )
    return seq


def peek_next_public_reference(
    brand: str,
    year: int | None = None,
) -> str:
    """Read-only preview of the next reference to be assigned."""
    brand_norm = _normalize_brand(brand)
    current_year = year or timezone.now().year
    seq = get_or_create_numbering_sequence(brand=brand_norm, year=current_year)

    # Check against database records to show accurate next available number
    candidate_num = seq.next_number
    candidate_ref = seq.format_reference(candidate_num)

    while _reference_already_exists(brand_norm, candidate_ref):
        candidate_num += 1
        candidate_ref = seq.format_reference(candidate_num)

    return candidate_ref


def _reference_already_exists(brand: str, reference: str) -> bool:
    if brand == NumberingSequenceBrand.TITAN:
        from apps.reservations.models import ReservationDraft

        return ReservationDraft.objects.filter(
            public_reference=reference,
            is_deleted=False,
        ).exists()
    elif brand == NumberingSequenceBrand.HAHITANTSOA:
        from apps.hahitantsoa.models import HahitantsoaEventDraft

        return HahitantsoaEventDraft.objects.filter(
            public_reference=reference,
            is_deleted=False,
        ).exists()
    return False


@transaction.atomic
def generate_next_public_reference(
    brand: str,
    year: int | None = None,
) -> str:
    """Atomically reserve and generate the next unique reference."""
    brand_norm = _normalize_brand(brand)
    current_year = year or timezone.now().year

    # Ensure sequence exists before locking
    get_or_create_numbering_sequence(brand=brand_norm, year=current_year)

    # Lock sequence record
    seq = (
        NumberingSequence.objects.select_for_update()
        .filter(brand=brand_norm, year=current_year)
        .first()
    )
    if seq is None:
        seq = get_or_create_numbering_sequence(brand=brand_norm, year=current_year)

    candidate_num = seq.next_number
    candidate_ref = seq.format_reference(candidate_num)

    while _reference_already_exists(brand_norm, candidate_ref):
        candidate_num += 1
        candidate_ref = seq.format_reference(candidate_num)

    # Save next available number after candidate_num
    seq.next_number = candidate_num + 1
    seq.save(update_fields=["next_number", "updated_at"])

    return candidate_ref


@transaction.atomic
def configure_numbering_sequence(
    *,
    brand: str,
    year: int,
    next_number: int,
    prefix: str | None = None,
    padding: int | None = None,
    suffix_template: str | None = None,
    actor: object | None = None,
) -> NumberingSequence:
    brand_norm = _normalize_brand(brand)
    if next_number < 1:
        raise ValueError("Next sequence number must be positive (>= 1).")

    get_or_create_numbering_sequence(brand=brand_norm, year=year)
    seq = NumberingSequence.objects.select_for_update().filter(brand=brand_norm, year=year).first()
    if seq is None:
        seq = get_or_create_numbering_sequence(brand=brand_norm, year=year)

    seq.next_number = next_number
    if prefix is not None:
        seq.prefix = prefix
    if padding is not None and 1 <= padding <= 8:
        seq.padding = padding
    if suffix_template is not None:
        seq.suffix_template = suffix_template

    if actor and getattr(actor, "is_authenticated", False):
        seq.updated_by = actor

    seq.save()
    return seq
