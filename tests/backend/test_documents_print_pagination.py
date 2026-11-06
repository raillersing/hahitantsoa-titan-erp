from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from django.conf import settings
from django.template.loader import render_to_string
from weasyprint import HTML


def _render(html):
    brand = Path(settings.BASE_DIR) / "apps/documents/static/brand"
    html = html.replace('src="/brand/', f'src="{brand.as_uri()}/')
    return HTML(string=html).render()


def _text(page):
    return " ".join(box.text for box in page._page_box.descendants() if getattr(box, "text", None))


def _receipt(scope, history_count, *, long_fields=False):
    return render_to_string(
        f"documents/{scope}_payment_receipt.html",
        {
            "context": {
                "payment": {
                    "payment_kind": "deposit",
                    "payment_method": "bank_transfer" if long_fields else "cash",
                    "receipt_reference": (
                        "H-012/2026-REC-01-" + "Z" * 44 if long_fields else "H-012/2026-REC-01"
                    ),
                    "payment_date_label": "05/11/2026",
                    "customer_display_name": (
                        ("Entreprise de qualification avec raison sociale longue " * 5)[:255]
                        if long_fields
                        else "Entreprise de qualification"
                    ),
                    "event_date_label": "10/12/2026",
                    "amount_label": "100 000",
                    "amount_in_words": "Cent mille ariary",
                    "payment_method_label": "Espèces",
                    "bank_name": "Banque de qualification " * 10 if long_fields else "",
                    "transaction_reference": "VIREMENT-" + "9" * 50 if long_fields else "",
                    "history": [
                        {"date_label": f"JOUR-{i:02}", "amount_label": str(100_000 + i)}
                        for i in range(history_count)
                    ],
                    "total_deposit_label": "100 000",
                    "proforma_reference": "H-012/2026-PF",
                    "proforma_amount_label": "1 000 000",
                    "remaining_balance_label": "900 000",
                }
            }
        },
    )


@pytest.mark.parametrize("scope", ["hahitantsoa", "titan"])
@pytest.mark.parametrize("history_count", [1, 40])
def test_receipt_fixed_paper_and_complete_history(scope, history_count):
    rendered = _render(_receipt(scope, history_count))
    assert len(rendered.pages) == 1 if history_count == 1 else len(rendered.pages) > 1
    for page_number, page in enumerate(rendered.pages, start=1):
        assert page.width == pytest.approx(80 * 96 / 25.4)
        assert page.height == pytest.approx(104 * 96 / 25.4)
        assert "H-012/2026-REC-01" in _text(page)
        assert f"{page_number}/{len(rendered.pages)}" in _text(page)
    text = " ".join(_text(page) for page in rendered.pages)
    for i in range(history_count):
        assert f"JOUR-{i:02}" in text
        assert str(100_000 + i) in text
    assert "Reste à payer" in text
    assert "900 000" in text
    assert rendered.write_pdf().startswith(b"%PDF-")
    # The payment's amount and its label stay together on one physical page.
    assert any(
        "Montant payé" in _text(page) and "Cent mille" in _text(page) for page in rendered.pages
    )


@pytest.mark.parametrize("scope", ["hahitantsoa", "titan"])
def test_receipt_long_company_bank_and_reference_remain_inside_paper(scope):
    rendered = _render(_receipt(scope, 1, long_fields=True))
    text = " ".join(_text(page) for page in rendered.pages)
    assert "Entreprise de qualification" in text
    assert "Banque de qualification" in text
    assert "Reste à payer" in text
    for page in rendered.pages:
        assert page.width == pytest.approx(80 * 96 / 25.4)
        assert page.height == pytest.approx(104 * 96 / 25.4)
        for box in page._page_box.descendants():
            if getattr(box, "text", None):
                assert box.position_x >= 0
                assert box.position_x + box.width <= page.width + 0.1
                assert box.position_y + box.height <= page.height + 0.1


def _invoice(line_count):
    start = datetime(2026, 12, 31, 8, tzinfo=UTC)
    return render_to_string(
        "documents/hahitantsoa_invoice.html",
        {
            "document": {"reference": "H-012/2026-FA", "date": start.date()},
            "context": {
                "event_draft": {
                    "public_reference": "H-012/2026",
                    "customer_display_name": "Client de qualification",
                    "customer_contacts": "034 00 000 00",
                    "customer_phone": "034 00 000 00",
                    "invoice_period": {
                        "start_at": start,
                        "end_at": start + timedelta(hours=18),
                        "duration_label": "Utilisation de nuit Option 2",
                        "duration_hours": 18,
                        "ends_next_day": True,
                    },
                    "lines": [
                        {
                            "quantity": 1,
                            "inventory_item_name": f"ARTICLE-{i:03}",
                            "notes": "Article avec une précision de composition",
                            "sub_items": ["Accessoire inclus", "Équipement inclus"],
                            "unit_price": "10 000,00",
                            "total_price": "10 000,00",
                            "breakage_price": "20 000,00",
                        }
                        for i in range(line_count)
                    ],
                    "sub_total": "230 000,00",
                    "discount": "0,00",
                    "total_amount": "230 000,00",
                    "total_amount_in_words": "Deux cent trente mille ariary",
                }
            },
        },
    )


@pytest.mark.parametrize("line_count", [1, 23])
def test_invoice_paginates_before_settlement_without_losing_rows(line_count):
    rendered = _render(_invoice(line_count))
    if line_count == 1:
        assert len(rendered.pages) == 1
    else:
        assert len(rendered.pages) > 1
    text = " ".join(_text(page) for page in rendered.pages)
    for i in range(line_count):
        assert f"ARTICLE-{i:03}" in text
    assert "Utilisation de nuit Option 2" in text
    assert "01/01/2027" in text
    assert "TOTAL A PAYER" in text
    assert "Deux cent trente mille ariary" in text
    assert "Le responsable" in text and "Le Client" in text
    assert rendered.write_pdf().startswith(b"%PDF-")
    for page in rendered.pages:
        assert page.width == pytest.approx(210 * 96 / 25.4)
        assert page.height == pytest.approx(297 * 96 / 25.4)
        assert "H-012/2026-FA" in _text(page)
        rows, settlements = [], []
        for box in page._page_box.descendants():
            if box.element is None:
                continue
            classes = box.element.get("class", "").split()
            if box.element_tag == "tr":
                rows.append(box)
            if "invoice-settlement" in classes:
                settlements.append(box)
        if rows and settlements:
            assert max(row.position_y + row.height for row in rows) <= min(
                settlement.position_y for settlement in settlements
            )
