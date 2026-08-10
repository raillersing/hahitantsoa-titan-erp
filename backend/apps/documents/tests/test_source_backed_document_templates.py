from pathlib import Path

import pytest
from django.template.loader import render_to_string

from apps.documents.registry import get_document_template_definition
from apps.documents.views import (
    _build_mock_preview_context,
    _build_preview_bank,
    _resolve_preview_template_path,
)

SOURCE_BACKED_DOCUMENTS = (
    ("hahitantsoa.liability_release.v1", "A4", "DECHARGE DE RESPONSABILITE"),
    ("hahitantsoa.delivery_note.v1", "A4", "BON DE LIVRAISON"),
    ("hahitantsoa.invoice.v1", "A4", "FACTURE"),
    ("titan.delivery_note.v1", "A5", "BON DE LIVRAISON"),
    ("titan.invoice.v1", "A5", "FACTURE"),
    ("shared.breakage_repair_invoice.v1", "A5", "DETAILS DE CASSE"),
    ("hahitantsoa.preparation_sheet.v1", "A4", "Checking de passation"),
)


@pytest.mark.parametrize("template_key,paper_size,title", SOURCE_BACKED_DOCUMENTS)
def test_source_backed_template_contains_source_geometry_and_title(
    template_key: str, paper_size: str, title: str
) -> None:
    definition = get_document_template_definition(template_key)
    assert definition is not None
    template_path = Path(definition.template_path)
    assert template_path.exists()

    source = template_path.read_text(encoding="utf-8")
    assert f"size: {paper_size}" in source
    assert title in source


@pytest.mark.parametrize("template_key,_,__", SOURCE_BACKED_DOCUMENTS)
def test_source_backed_template_preview_renders_with_variables(template_key: str, _, __) -> None:
    definition = get_document_template_definition(template_key)
    assert definition is not None
    html = render_to_string(
        _resolve_preview_template_path(template_key),
        {
            "context": _build_mock_preview_context(definition),
            "bank": _build_preview_bank(definition),
            "show_variables": True,
        },
    )
    assert "{{" in html
    assert "}}" in html


def test_breakage_preview_does_not_expose_placeholder_bank_tokens() -> None:
    definition = get_document_template_definition("shared.breakage_repair_invoice.v1")
    assert definition is not None
    html = render_to_string(
        _resolve_preview_template_path(definition.key),
        {
            "context": _build_mock_preview_context(definition),
            "bank": _build_preview_bank(definition),
            "show_variables": False,
        },
    )

    assert "00004 00009 03319320103 30" in html
    assert "{{rib}}" not in html
    assert "{{iban}}" not in html


def test_checking_preview_exposes_two_source_pages_without_internal_overflow() -> None:
    definition = get_document_template_definition("hahitantsoa.preparation_sheet.v1")
    assert definition is not None
    html = render_to_string(
        _resolve_preview_template_path(definition.key),
        {
            "context": _build_mock_preview_context(definition),
            "bank": _build_preview_bank(definition),
            "show_variables": False,
        },
    )

    assert html.count('class="page document-page"') == 2
