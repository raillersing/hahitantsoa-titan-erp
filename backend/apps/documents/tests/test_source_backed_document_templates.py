import pytest
from django.template.loader import render_to_string

from apps.documents.registry import (
    get_document_template_definition,
    list_document_template_definitions,
)
from apps.documents.views import (
    _build_mock_preview_context,
    _build_preview_bank,
    _resolve_preview_template_path,
)

SOURCE_BACKED_DOCUMENTS = (
    ("hahitantsoa.payment_receipt.v1", "80mm", "Reçu de paiement"),
    ("titan.payment_receipt.v1", "80mm", "Reçu de paiement"),
    ("hahitantsoa.liability_release.v1", "A4", "DECHARGE DE RESPONSABILITE"),
    ("hahitantsoa.delivery_note.v1", "A4", "BON DE LIVRAISON"),
    ("hahitantsoa.invoice.v1", "A4", "FACTURE"),
    ("titan.delivery_note.v1", "A4", "BON DE LIVRAISON"),
    ("titan.invoice.v1", "A4", "FACTURE"),
    ("hahitantsoa.breakage_repair_invoice.v1", "A4", "DETAILS DE CASSE"),
    ("titan.breakage_repair_invoice.v1", "A4", "DETAILS DE CASSE"),
    ("hahitantsoa.preparation_sheet.v1", "A4", "Checking de passation"),
)

CONSTRUCTED_DOCUMENTS = (
    ("titan.material_amendment.v1", "AVENANT DE CONTRAT"),
    ("shared.payment_refund_receipt.v1", "REÇU DE REMBOURSEMENT"),
    ("shared.return_note.v1", "BON DE RETOUR"),
    ("shared.internal_release_note.v1", "BON DE SORTIE"),
    ("shared.supplier_purchase_order.v1", "BON DE COMMANDE"),
)


def test_hahitantsoa_contract_uses_canonical_html_css_pages_and_preserves_annex_scope() -> None:
    definition = get_document_template_definition("hahitantsoa.contract.v1")
    assert definition is not None
    html = render_to_string(
        _resolve_preview_template_path(definition.key),
        {
            "context": _build_mock_preview_context(definition),
            "bank": _build_preview_bank(definition),
            "show_variables": False,
        },
    )

    assert "size: A4 portrait" in html
    assert html.count('class="contract-page') == 8
    assert "CONTRAT DE LOCATION « HAHITANTSOA »" in html
    assert "Prix de casse" in html
    assert "Annexe 2 : Plan de masse et évacuation incendie" in html
    assert "total des préjudices" not in html.lower()


@pytest.mark.parametrize("template_key,paper_size,title", SOURCE_BACKED_DOCUMENTS)
def test_source_backed_template_contains_source_geometry_and_title(
    template_key: str, paper_size: str, title: str
) -> None:
    definition = get_document_template_definition(template_key)
    assert definition is not None
    html = render_to_string(
        _resolve_preview_template_path(template_key),
        {
            "context": _build_mock_preview_context(definition),
            "bank": _build_preview_bank(definition),
            "show_variables": False,
        },
    )
    assert f"size: {paper_size}" in html
    assert title in html


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
    if template_key in {"hahitantsoa.payment_receipt.v1", "titan.payment_receipt.v1"}:
        assert "________________" in html
        assert "size: 80mm 120mm" in html
    else:
        assert "{{" in html
        assert "}}" in html


@pytest.mark.parametrize("template_key,title", CONSTRUCTED_DOCUMENTS)
def test_constructed_documents_share_the_a4_family_shell(template_key: str, title: str) -> None:
    definition = get_document_template_definition(template_key)
    assert definition is not None
    html = render_to_string(
        _resolve_preview_template_path(template_key),
        {
            "context": _build_mock_preview_context(definition),
            "bank": _build_preview_bank(definition),
            "show_variables": False,
        },
    )

    assert "size: A4" in html
    assert title.lower() in html.lower()


def test_breakage_preview_does_not_expose_placeholder_bank_tokens() -> None:
    definition = get_document_template_definition("hahitantsoa.breakage_repair_invoice.v1")
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


def test_hahitantsoa_and_titan_breakage_invoices_expose_brand_and_bank() -> None:
    hahi_def = get_document_template_definition("hahitantsoa.breakage_repair_invoice.v1")
    assert hahi_def is not None
    hahi_html = render_to_string(
        _resolve_preview_template_path(hahi_def.key),
        {
            "context": _build_mock_preview_context(hahi_def),
            "bank": _build_preview_bank(hahi_def),
            "show_variables": False,
        },
    )
    assert "hahitantsoa-logo.png" in hahi_html
    assert "00004 00009 03319320103 30" in hahi_html
    assert "hahitantsoa@ergon.mg" in hahi_html
    assert "DETAILS DE CASSE" in hahi_html

    titan_def = get_document_template_definition("titan.breakage_repair_invoice.v1")
    assert titan_def is not None
    titan_html = render_to_string(
        _resolve_preview_template_path(titan_def.key),
        {
            "context": _build_mock_preview_context(titan_def),
            "bank": _build_preview_bank(titan_def),
            "show_variables": False,
        },
    )
    assert "titan-rental-logo.png" in titan_html
    assert "00004 00009 03319320102 33" in titan_html
    assert "titan@ergon.mg" in titan_html
    assert "DETAILS DE CASSE" in titan_html


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


def test_catalog_preview_context_is_blank_and_supports_party_variants() -> None:
    definition = get_document_template_definition("hahitantsoa.contract_amendment.v1")
    assert definition is not None

    individual = _build_mock_preview_context(definition, party_type="individual")
    company = _build_mock_preview_context(definition, party_type="company")

    assert individual["blank_preview"] is True
    assert company["blank_preview"] is True
    assert individual["event_draft"]["party_type"] == "individual"
    assert company["event_draft"]["party_type"] == "company"
    assert individual["event_draft"]["lines"] == []
    assert individual["event_draft"]["customer_display_name"].startswith("_")
    assert company["event_draft"]["customer_display_name"].startswith("_")


def test_catalog_previews_do_not_contain_seeded_demo_customer_data() -> None:
    demo_markers = (
        "ETS Ravinala",
        "Chaise chiavari dorée",
        "Table rectangulaire GM",
        "LOC-2026-DEMO",
        "EVT-2026-DEMO",
        "Rakotomalala Jean",
        "Mariage de Rakotomalala",
    )

    for definition in list_document_template_definitions():
        if definition.key == "hahitantsoa.house_rules.v1":
            continue
        template_path = _resolve_preview_template_path(definition.key)
        assert template_path is not None
        html = render_to_string(
            template_path,
            {
                "context": _build_mock_preview_context(definition),
                "bank": _build_preview_bank(definition),
                "show_variables": False,
                "blank_preview": True,
            },
        )
        assert not any(marker in html for marker in demo_markers), definition.key
