from __future__ import annotations

import logging

from django.db import transaction
from django.utils import timezone

from apps.documents.models import (
    NumberingSequence,
    NumberingSequenceBrand,
    NumberingSequenceType,
)

logger = logging.getLogger(__name__)

DEFAULT_SEQUENCE_CONFIG: dict[tuple[str, str], dict[str, object]] = {
    (NumberingSequenceBrand.TITAN, NumberingSequenceType.PROFORMA): {
        "prefix": "T-",
        "padding": 3,
        "suffix_template": "/{year}",
    },
    (NumberingSequenceBrand.HAHITANTSOA, NumberingSequenceType.PROFORMA): {
        "prefix": "H-",
        "padding": 3,
        "suffix_template": "/{year}",
    },
    (NumberingSequenceBrand.TITAN, NumberingSequenceType.INVOICE): {
        "prefix": "T-",
        "padding": 3,
        "suffix_template": "/{year}-FA",
    },
    (NumberingSequenceBrand.HAHITANTSOA, NumberingSequenceType.INVOICE): {
        "prefix": "H-",
        "padding": 3,
        "suffix_template": "/{year}-FA",
    },
    (NumberingSequenceBrand.TITAN, NumberingSequenceType.DELIVERY_NOTE): {
        "prefix": "T-",
        "padding": 3,
        "suffix_template": "/{year}-BL",
    },
    (NumberingSequenceBrand.HAHITANTSOA, NumberingSequenceType.DELIVERY_NOTE): {
        "prefix": "H-",
        "padding": 3,
        "suffix_template": "/{year}-BL",
    },
}


def _normalize_brand(brand: str) -> str:
    brand_str = str(brand).lower().strip()
    if brand_str in {NumberingSequenceBrand.TITAN, "t"}:
        return NumberingSequenceBrand.TITAN
    if brand_str in {NumberingSequenceBrand.HAHITANTSOA, "h"}:
        return NumberingSequenceBrand.HAHITANTSOA
    return brand_str


def _normalize_sequence_type(sequence_type: str | None) -> str:
    if not sequence_type:
        return NumberingSequenceType.PROFORMA
    seq_str = str(sequence_type).lower().strip()
    if seq_str in {NumberingSequenceType.INVOICE, "facture", "fa"}:
        return NumberingSequenceType.INVOICE
    if seq_str in {
        NumberingSequenceType.DELIVERY_NOTE,
        "delivery_note",
        "bl",
        "bon_livraison",
        "bon_sortie",
    }:
        return NumberingSequenceType.DELIVERY_NOTE
    return NumberingSequenceType.PROFORMA


def get_or_create_numbering_sequence(
    brand: str,
    sequence_type: str = NumberingSequenceType.PROFORMA,
    year: int | None = None,
) -> NumberingSequence:
    brand_norm = _normalize_brand(brand)
    seq_type_norm = _normalize_sequence_type(sequence_type)
    current_year = year or timezone.now().year

    config = DEFAULT_SEQUENCE_CONFIG.get(
        (brand_norm, seq_type_norm),
        {
            "prefix": "T-" if brand_norm == NumberingSequenceBrand.TITAN else "H-",
            "padding": 3,
            "suffix_template": "/{year}",
        },
    )

    seq, _ = NumberingSequence.objects.get_or_create(
        brand=brand_norm,
        sequence_type=seq_type_norm,
        year=current_year,
        defaults={
            "prefix": str(config.get("prefix", "")),
            "next_number": 1,
            "padding": int(config.get("padding", 3)),
            "suffix_template": str(config.get("suffix_template", "/{year}")),
        },
    )
    return seq


def peek_next_public_reference(
    brand: str,
    sequence_type: str = NumberingSequenceType.PROFORMA,
    year: int | None = None,
) -> str:
    """Read-only preview of the next reference to be assigned."""
    brand_norm = _normalize_brand(brand)
    seq_type_norm = _normalize_sequence_type(sequence_type)
    current_year = year or timezone.now().year
    seq = get_or_create_numbering_sequence(
        brand=brand_norm, sequence_type=seq_type_norm, year=current_year
    )

    # Check against database records to show accurate next available number
    candidate_num = seq.next_number
    candidate_ref = seq.format_reference(candidate_num)

    while _reference_already_exists(brand_norm, seq_type_norm, candidate_ref):
        candidate_num += 1
        candidate_ref = seq.format_reference(candidate_num)

    return candidate_ref


def _reference_already_exists(brand: str, sequence_type: str, reference: str) -> bool:
    seq_type_norm = _normalize_sequence_type(sequence_type)
    if seq_type_norm == NumberingSequenceType.PROFORMA:
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
    else:
        from apps.documents.models import DocumentInstance, DocumentInstanceStatus

        return (
            DocumentInstance.objects.filter(
                document_reference=reference,
            )
            .exclude(status=DocumentInstanceStatus.VOIDED)
            .exists()
        )
    return False


@transaction.atomic
def generate_next_public_reference(
    brand: str,
    sequence_type: str = NumberingSequenceType.PROFORMA,
    year: int | None = None,
) -> str:
    """Atomically reserve and generate the next unique reference."""
    brand_norm = _normalize_brand(brand)
    seq_type_norm = _normalize_sequence_type(sequence_type)
    current_year = year or timezone.now().year

    # Ensure sequence exists before locking
    get_or_create_numbering_sequence(
        brand=brand_norm, sequence_type=seq_type_norm, year=current_year
    )

    # Lock sequence record
    seq = (
        NumberingSequence.objects.select_for_update()
        .filter(brand=brand_norm, sequence_type=seq_type_norm, year=current_year)
        .first()
    )
    if seq is None:
        seq = get_or_create_numbering_sequence(
            brand=brand_norm, sequence_type=seq_type_norm, year=current_year
        )

    candidate_num = seq.next_number
    candidate_ref = seq.format_reference(candidate_num)

    while _reference_already_exists(brand_norm, seq_type_norm, candidate_ref):
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
    sequence_type: str = NumberingSequenceType.PROFORMA,
    year: int,
    next_number: int,
    prefix: str | None = None,
    padding: int | None = None,
    suffix_template: str | None = None,
    actor: object | None = None,
) -> NumberingSequence:
    brand_norm = _normalize_brand(brand)
    seq_type_norm = _normalize_sequence_type(sequence_type)
    if next_number < 1:
        raise ValueError("Next sequence number must be positive (>= 1).")

    get_or_create_numbering_sequence(brand=brand_norm, sequence_type=seq_type_norm, year=year)
    seq = (
        NumberingSequence.objects.select_for_update()
        .filter(brand=brand_norm, sequence_type=seq_type_norm, year=year)
        .first()
    )
    if seq is None:
        seq = get_or_create_numbering_sequence(
            brand=brand_norm, sequence_type=seq_type_norm, year=year
        )

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
