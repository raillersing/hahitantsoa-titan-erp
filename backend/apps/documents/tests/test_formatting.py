from decimal import Decimal

from apps.documents.formatting import (
    parse_hahitantsoa_service_lines,
    parse_hahitantsoa_services_total,
)


def test_hahitantsoa_service_parser_is_shared_by_totals_and_document_lines() -> None:
    services = parse_hahitantsoa_service_lines(
        "Traiteur prestige (x2) - 1 500 000 Ar\nDécoration florale - 250 000 Ar\nAccueil"
    )

    assert [
        (service["name"], service["quantity"], service["total_price"]) for service in services
    ] == [
        ("Traiteur prestige", 2, Decimal("1500000")),
        ("Décoration florale", 1, Decimal("250000")),
        ("Accueil", 1, Decimal("0.00")),
    ]
    assert parse_hahitantsoa_services_total(
        "Traiteur prestige (x2) - 1 500 000 Ar\nDécoration florale - 250 000 Ar\nAccueil"
    ) == Decimal("1750000")
