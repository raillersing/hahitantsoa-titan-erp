"""Ariary amount and number formatting utilities for official documents."""

from __future__ import annotations

import re
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

_FRENCH_UNITS = (
    "zéro",
    "un",
    "deux",
    "trois",
    "quatre",
    "cinq",
    "six",
    "sept",
    "huit",
    "neuf",
    "dix",
    "onze",
    "douze",
    "treize",
    "quatorze",
    "quinze",
    "seize",
)
_FRENCH_TENS = {
    20: "vingt",
    30: "trente",
    40: "quarante",
    50: "cinquante",
    60: "soixante",
}


def _french_number_words(value: int) -> str:
    """Render a non-negative integer in French for official document totals."""
    if value < 0:
        raise ValueError("French number words only supports non-negative values.")
    if value < 17:
        return _FRENCH_UNITS[value]
    if value < 20:
        return f"dix-{_FRENCH_UNITS[value - 10]}"
    if value < 70:
        tens, remainder = divmod(value, 10)
        prefix = _FRENCH_TENS[tens * 10]
        if remainder == 0:
            return prefix
        if remainder == 1:
            return f"{prefix} et un"
        return f"{prefix}-{_french_number_words(remainder)}"
    if value < 80:
        remainder = value - 60
        if remainder == 11:
            return "soixante et onze"
        return f"soixante-{_french_number_words(remainder)}"
    if value < 100:
        remainder = value - 80
        if remainder == 0:
            return "quatre-vingts"
        return f"quatre-vingt-{_french_number_words(remainder)}"
    if value < 1000:
        hundreds, remainder = divmod(value, 100)
        prefix = "cent" if hundreds == 1 else f"{_french_number_words(hundreds)} cent"
        if remainder == 0:
            return f"{prefix}s" if hundreds > 1 else prefix
        return f"{prefix} {_french_number_words(remainder)}"

    for scale, singular in ((1_000_000_000, "milliard"), (1_000_000, "million"), (1000, "mille")):
        if value >= scale:
            quantity, remainder = divmod(value, scale)
            if scale == 1000:
                quantity_words = _french_number_words(quantity)
                if quantity_words.endswith("cents"):
                    quantity_words = quantity_words[:-1]
                prefix = singular if quantity == 1 else f"{quantity_words} {singular}"
            else:
                suffix = singular if quantity == 1 else f"{singular}s"
                prefix = f"{_french_number_words(quantity)} {suffix}"
            return prefix if remainder == 0 else f"{prefix} {_french_number_words(remainder)}"
    raise ValueError("French number words supports values below one trillion.")


def format_ariary_amount_in_words(value: object) -> str:
    """Return the exact Ariary amount in French words without losing a fraction."""
    if value is None or value == "":
        return "Zéro Ariary"
    try:
        cleaned = (
            str(value)
            .replace(" ", "")
            .replace("\xa0", "")
            .replace("Ar", "")
            .replace("ar", "")
            .replace(",", ".")
            .strip()
        )
        if not cleaned:
            return "Zéro Ariary"
        amount = Decimal(cleaned).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    except (InvalidOperation, ValueError) as exc:
        raise ValueError("Document total amount must be a valid decimal value.") from exc
    if amount < 0:
        raise ValueError("Document total amount cannot be negative.")

    whole_amount = int(amount)
    hundredths = int((amount - whole_amount) * 100)
    words = f"{_french_number_words(whole_amount)} Ariary"
    if hundredths:
        words = f"{words} et {_french_number_words(hundredths)} centièmes d'Ariary"
    return words[:1].upper() + words[1:]


def format_ariary_amount(value: object) -> str:
    """Format a numeric value into Ariary string representation (e.g. 1 500 000,00)."""
    if value is None or value == "":
        return "0,00"
    try:
        cleaned = (
            str(value)
            .replace(" ", "")
            .replace("\xa0", "")
            .replace("Ar", "")
            .replace("ar", "")
            .replace(",", ".")
            .strip()
        )
        amount = Decimal(cleaned)
        return f"{amount:,.2f}".replace(",", " ").replace(".", ",")
    except InvalidOperation, ValueError:
        return "0,00"


def parse_service_price(price_str: str) -> Decimal | None:
    """Extract decimal price from formatted Ariary price strings."""
    if not price_str:
        return None
    cleaned = (
        str(price_str)
        .replace(" ", "")
        .replace("\xa0", "")
        .replace("Ar", "")
        .replace("ar", "")
        .replace(",", ".")
        .strip()
    )
    try:
        return Decimal(cleaned)
    except InvalidOperation, ValueError:
        return None


def parse_hahitantsoa_service_lines(service_notes: str | None) -> list[dict[str, object]]:
    """Parse Hahitantsoa service notes into canonical commercial line values."""
    if not service_notes or not service_notes.strip():
        return []

    lines: list[dict[str, object]] = []
    raw_entries = (
        [entry.strip() for entry in service_notes.splitlines() if entry.strip()]
        if "\n" in service_notes
        else [
            entry.strip()
            for entry in re.split(r",\s*(?=[A-Za-zÀ-ÿ0-9])", service_notes)
            if entry.strip()
        ]
    )
    for entry in raw_entries:
        quantity = 1
        name = entry
        total_price = Decimal("0.00")
        priced = False
        quantity_match = re.match(
            r"^(?P<name>.+?)\s*\((?:x\s*|qté\s*:\s*)?(?P<qty>\d+)\)\s*[-:]\s*(?P<price>[\d\s,.]+)\s*(?:Ar|ariary)?$",
            entry,
            re.IGNORECASE,
        )
        price_match = re.match(
            r"^(?P<name>.+?)\s*[-:]\s*(?P<price>[\d\s,.]+)\s*(?:Ar|ariary)?$",
            entry,
            re.IGNORECASE,
        )
        quantity_only_match = re.match(
            r"^(?P<name>.+?)\s*\((?:x\s*|qté\s*:\s*)?(?P<qty>\d+)\)$",
            entry,
            re.IGNORECASE,
        )
        if quantity_match:
            name = quantity_match.group("name").strip()
            quantity = max(1, int(quantity_match.group("qty")))
            parsed_price = parse_service_price(quantity_match.group("price"))
            if parsed_price is not None:
                total_price = parsed_price
                priced = True
        elif price_match:
            name = price_match.group("name").strip()
            parsed_price = parse_service_price(price_match.group("price"))
            if parsed_price is not None:
                total_price = parsed_price
                priced = True
        elif quantity_only_match:
            name = quantity_only_match.group("name").strip()
            quantity = max(1, int(quantity_only_match.group("qty")))

        lines.append(
            {
                "name": name,
                "quantity": quantity,
                "total_price": total_price,
                "priced": priced,
            }
        )
    return lines


def parse_hahitantsoa_services_total(service_notes: str | None) -> Decimal:
    """Calculate the total price of all parsed services in service_notes."""
    return sum(
        (line["total_price"] for line in parse_hahitantsoa_service_lines(service_notes)),
        Decimal("0.00"),
    )


_format_ariary_amount = format_ariary_amount
