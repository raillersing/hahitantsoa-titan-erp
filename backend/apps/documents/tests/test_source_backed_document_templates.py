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
    ("shared.preparation_sheet.v1", "BON DE PRÉPARATION"),
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
    assert "Carte Nationale d’Identité/Passeport" in html
    assert "Prix de casse" in html
    assert "Annexe 2 : Plan de masse et évacuation incendie" in html
    assert "total des préjudices" not in html.lower()


def test_titan_material_contract_uses_canonical_html_css_pages() -> None:
    definition = get_document_template_definition("titan.material_contract.v1")
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
    assert html.count('class="contract-page') == 3
    assert "CONTRAT DE LOCATION DE MATERIELS EVENEMENTIELS" in html
    assert "« TITAN RENTAL »" in html
    assert "Carte Nationale d’Identité/Passeport" in html
    assert "Article 1 : Objet du contrat" in html
    assert "Article 12 : Transport" in html
    assert "titan-rental-logo.png" in html


def test_titan_material_amendment_uses_canonical_html_css_amendment_page() -> None:
    definition = get_document_template_definition("titan.material_amendment.v1")
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
    assert html.count('class="contract-page contract-page--amendment') == 1
    assert "AVENANT DE CONTRAT « TITAN RENTAL »" in html
    assert "titan-rental-logo.png" in html


def test_titan_material_contract_distinguishes_individual_and_company() -> None:
    definition = get_document_template_definition("titan.material_contract.v1")
    assert definition is not None
    template_path = _resolve_preview_template_path(definition.key)
    bank = _build_preview_bank(definition)

    # Individual variant
    html_indiv = render_to_string(
        template_path,
        {
            "context": _build_mock_preview_context(definition, party_type="individual"),
            "bank": bank,
            "show_variables": False,
        },
    )
    assert "Madame/Monsieur" in html_indiv
    assert "Carte Nationale d’Identité/Passeport" in html_indiv
    assert "NIF :" not in html_indiv
    assert "STAT :" not in html_indiv
    assert "RCS :" not in html_indiv
    assert "Le Client," in html_indiv

    # Company variant
    html_company = render_to_string(
        template_path,
        {
            "context": _build_mock_preview_context(definition, party_type="company"),
            "bank": bank,
            "show_variables": False,
        },
    )
    assert "La société" in html_company
    assert "NIF :" in html_company
    assert "STAT :" in html_company
    assert "RCS :" in html_company
    assert "Pour la société" in html_company


def test_titan_material_amendment_distinguishes_individual_and_company() -> None:
    definition = get_document_template_definition("titan.material_amendment.v1")
    assert definition is not None
    template_path = _resolve_preview_template_path(definition.key)
    bank = _build_preview_bank(definition)

    # Individual variant
    html_indiv = render_to_string(
        template_path,
        {
            "context": _build_mock_preview_context(definition, party_type="individual"),
            "bank": bank,
            "show_variables": False,
        },
    )
    assert "Madame/Monsieur" in html_indiv
    assert "demeurant au" in html_indiv
    assert "Le Client," in html_indiv

    # Company variant
    html_company = render_to_string(
        template_path,
        {
            "context": _build_mock_preview_context(definition, party_type="company"),
            "bank": bank,
            "show_variables": False,
        },
    )
    assert "La société" in html_company
    assert "dont le siège social est situé" in html_company
    assert "Pour la société" in html_company


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
        assert "................" in html
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
    assert individual["event_draft"]["customer_display_name"].startswith(".")
    assert company["event_draft"]["customer_display_name"].startswith(".")


def test_titan_catalog_preview_context_supplies_contract_proforma_reference() -> None:
    definition = get_document_template_definition("titan.material_contract.v1")
    assert definition is not None

    context = _build_mock_preview_context(definition)

    assert context["reservation_draft"]["proforma_reference"] == "................"


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


def test_shared_preparation_sheet_uses_proforma_format_and_columns() -> None:
    definition = get_document_template_definition("shared.preparation_sheet.v1")
    assert definition is not None
    html = render_to_string(
        _resolve_preview_template_path(definition.key),
        {
            "context": _build_mock_preview_context(definition),
            "bank": _build_preview_bank(definition),
            "show_variables": False,
        },
    )

    assert "size: A4" in html
    assert "BON DE PRÉPARATION" in html
    assert ">DESIGNATION<" in html
    assert ">QTE<" in html
    assert ">OBSERVATIONS<" in html
    assert "Le Préparateur" in html
    assert "Contrôle Départ" in html
    assert "ergon-logo.png" in html


def test_shared_return_and_release_notes_use_designation_column() -> None:
    for key in ("shared.return_note.v1", "shared.internal_release_note.v1"):
        definition = get_document_template_definition(key)
        assert definition is not None
        html = render_to_string(
            _resolve_preview_template_path(definition.key),
            {
                "context": _build_mock_preview_context(definition),
                "bank": _build_preview_bank(definition),
                "show_variables": False,
            },
        )
        assert "<th>DESIGNATION</th>" in html


def test_delivery_notes_use_qte_and_designation_columns() -> None:
    for key in ("titan.delivery_note.v1", "hahitantsoa.delivery_note.v1"):
        definition = get_document_template_definition(key)
        assert definition is not None
        html = render_to_string(
            _resolve_preview_template_path(definition.key),
            {
                "context": _build_mock_preview_context(definition),
                "bank": _build_preview_bank(definition),
                "show_variables": False,
            },
        )
        assert "<th>QTE</th>" in html
        assert "<th>DESIGNATION</th>" in html


def test_refund_receipt_and_supplier_po_use_uppercase_columns() -> None:
    receipt_def = get_document_template_definition("shared.payment_refund_receipt.v1")
    assert receipt_def is not None
    receipt_html = render_to_string(
        _resolve_preview_template_path(receipt_def.key),
        {
            "context": _build_mock_preview_context(receipt_def),
            "bank": _build_preview_bank(receipt_def),
            "show_variables": False,
        },
    )
    assert "<th>DESIGNATION / MOTIF</th>" in receipt_html
    assert "<th>MONTANT</th>" in receipt_html
    assert "TOTAL REMBOURSÉ" in receipt_html
    assert "OBSERVATIONS" not in receipt_html

    po_def = get_document_template_definition("shared.supplier_purchase_order.v1")
    assert po_def is not None
    po_html = render_to_string(
        _resolve_preview_template_path(po_def.key),
        {
            "context": _build_mock_preview_context(po_def),
            "bank": _build_preview_bank(po_def),
            "show_variables": False,
        },
    )
    assert "<th>DESIGNATION</th>" in po_html
    assert "<th>QTE</th>" in po_html
    assert "<th>P.U.</th>" in po_html
    assert "<th>MONTANT</th>" in po_html
    assert "TOTAL COMMANDE" in po_html
    assert "OBSERVATIONS" not in po_html


def test_contracts_render_smart_civilite_gender_and_identity_document_choice() -> None:
    import datetime

    for template_key in ("hahitantsoa.contract.v1", "titan.material_contract.v1"):
        definition = get_document_template_definition(template_key)
        assert definition is not None
        template_path = _resolve_preview_template_path(definition.key)
        bank = _build_preview_bank(definition)

        # 1. Test Monsieur + né + CIN
        context_m_cin = _build_mock_preview_context(definition, party_type="individual")
        target_dict = (
            context_m_cin["reservation_draft"]["customer"]
            if "reservation_draft" in context_m_cin
            else context_m_cin["event_draft"]
        )
        civ_key = "customer_civilite" if "customer_civilite" in target_dict else "civilite"
        id_type_key = "customer_id_type" if "customer_id_type" in target_dict else "id_type"
        dup_date_key = (
            "customer_id_duplicata_date"
            if "customer_id_duplicata_date" in target_dict
            else "id_duplicata_date"
        )
        dup_place_key = (
            "customer_id_duplicata_place"
            if "customer_id_duplicata_place" in target_dict
            else "id_duplicata_place"
        )
        target_dict[civ_key] = "Monsieur"
        target_dict[id_type_key] = "CIN"
        target_dict[dup_date_key] = datetime.date(2023, 5, 12)
        target_dict[dup_place_key] = "Antananarivo"

        html_m = render_to_string(
            template_path,
            {"context": context_m_cin, "bank": bank, "show_variables": False},
        )
        assert "Monsieur " in html_m
        assert " né le " in html_m
        assert "titulaire de la Carte Nationale d’Identité" in html_m
        assert "duplicata du 12/05/2023 à Antananarivo" in html_m

        # 2. Test Madame + née + Passeport
        context_f_pass = _build_mock_preview_context(definition, party_type="individual")
        target_dict_f = (
            context_f_pass["reservation_draft"]["customer"]
            if "reservation_draft" in context_f_pass
            else context_f_pass["event_draft"]
        )
        civ_f_key = "customer_civilite" if "customer_civilite" in target_dict_f else "civilite"
        id_f_key = "customer_id_type" if "customer_id_type" in target_dict_f else "id_type"
        target_dict_f[civ_f_key] = "Madame"
        target_dict_f[id_f_key] = "Passeport"

        html_f = render_to_string(
            template_path,
            {"context": context_f_pass, "bank": bank, "show_variables": False},
        )
        assert "Madame " in html_f
        assert " née le " in html_f
        assert "titulaire du Passeport" in html_f


def test_hahitantsoa_contract_smart_rental_type_and_deposit() -> None:
    definition = get_document_template_definition("hahitantsoa.contract.v1")
    assert definition is not None
    template_path = _resolve_preview_template_path(definition.key)
    bank = _build_preview_bank(definition)

    # 1. Bare rental test: exclusively 1 000 000 Ar deposit, no 1 500 000 Ar mention
    context_bare = _build_mock_preview_context(definition)
    context_bare["event_draft"]["rental_type"] = "bare"
    context_bare["event_draft"]["access_schedule"] = "same_day"
    context_bare["event_draft"]["duration_option"] = "day"

    html_bare = render_to_string(
        template_path,
        {"context": context_bare, "bank": bank, "show_variables": False},
    )
    assert "Type de location : Location nue<br>" in html_bare
    assert "versement d’un acompte de <strong>1 000 000,00 Ariary</strong>" in html_bare
    assert "1 500 000,00 Ariary" not in html_bare
    assert "Les intervenants du client accèderont aux locaux le jour-J à 07 heures." in html_bare
    assert "veuillez rayer" not in html_bare
    assert "Formule horaire : Fête de jour (Sortie J-J à 20:00)" in html_bare

    # 2. Logistics rental test: exclusively 1 500 000 Ar deposit, no 1 000 000 Ar mention
    context_logistics = _build_mock_preview_context(definition)
    context_logistics["event_draft"]["rental_type"] = "logistics"
    context_logistics["event_draft"]["access_schedule"] = "day_before"
    context_logistics["event_draft"]["duration_option"] = "night_1"

    html_logistics = render_to_string(
        template_path,
        {"context": context_logistics, "bank": bank, "show_variables": False},
    )
    assert "Type de location : Location nue + logistique<br>" in html_logistics
    assert "versement d’un acompte de <strong>1 500 000,00 Ariary</strong>" in html_logistics
    assert "1 000 000,00 Ariary" not in html_logistics
    assert "accèderont aux locaux la veille à 15 heures 30" in html_logistics
    assert "veuillez rayer" not in html_logistics
    assert "Utilisation de nuit Option 1" in html_logistics


def test_titan_material_contract_smart_caution_amount() -> None:
    definition = get_document_template_definition("titan.material_contract.v1")
    assert definition is not None
    template_path = _resolve_preview_template_path(definition.key)
    bank = _build_preview_bank(definition)

    context = _build_mock_preview_context(definition)
    context["reservation_draft"]["caution_amount"] = "450 000,00"

    html = render_to_string(
        template_path,
        {"context": context, "bank": bank, "show_variables": False},
    )
    assert "dépôt de garantie la somme de <strong>450 000,00 Ariary</strong>." in html
    assert "pour les locations de moins de 200 000,00 Ariary" not in html


def test_hahitantsoa_amendment_smart_options_rendering() -> None:
    html_custom = render_to_string(
        "documents/hahitantsoa_contract_amendment.html",
        {
            "context": {
                "event_draft": {
                    "party_type": "individual",
                    "customer_display_name": "Razafy Pierre",
                    "public_reference": "EVT-2026-DEMO",
                    "proforma_reference": "HAH N°/24.109",
                    "rental_type": "bare",
                    "duration_option": "Nuit Option 1",
                    "access_schedule": "same_day",
                    "service_notes": "Installation estrade et sono",
                }
            },
            "show_variables": False,
        },
    )
    assert "accèderont aux locaux le jour-J à 07 heures." in html_custom
    assert "veuillez rayer" not in html_custom
    assert "Type : Location nue" in html_custom
    assert "Formule horaire : Nuit Option 1" in html_custom
    assert "Installation estrade et sono" in html_custom
    # Generic unselected checkboxes should not appear
    assert "Ciel étoilé" not in html_custom
    assert "Piste lumineuse" not in html_custom


def test_titan_contract_and_amendment_dynamic_material_lines() -> None:
    for key in ("titan.material_contract.v1", "titan.material_amendment.v1"):
        definition = get_document_template_definition(key)
        assert definition is not None
        template_path = _resolve_preview_template_path(definition.key)
        bank = _build_preview_bank(definition)

        # 1. Real custom lines test
        context = _build_mock_preview_context(definition)
        context["reservation_draft"]["lines"] = [
            {"quantity": 10, "inventory_item_name": "TENTE MODULAIRE 10X10", "notes": ""},
            {"quantity": 80, "inventory_item_name": "CHAISES NAPOLEON", "notes": "or"},
        ]

        html_real = render_to_string(
            template_path,
            {"context": context, "bank": bank, "show_variables": False},
        )
        assert "10 x TENTE MODULAIRE 10X10" in html_real
        assert "80 x CHAISES NAPOLEON — or" in html_real
        assert "150 x CHAISES TRANSPARENTES" not in html_real
        assert "150 x COUSSINS" not in html_real

        # 2. Variable inspection mode
        html_vars = render_to_string(
            template_path,
            {"context": context, "bank": bank, "show_variables": True},
        )
        assert "{{ lines.quantity }}" in html_vars
        assert "{{ lines.designation }}" in html_vars
        assert "150 x CHAISES TRANSPARENTES" not in html_vars


def test_hahitantsoa_contract_annexe3_breakage_table() -> None:
    definition = get_document_template_definition("hahitantsoa.contract.v1")
    assert definition is not None
    template_path = _resolve_preview_template_path(definition.key)
    bank = _build_preview_bank(definition)

    context = _build_mock_preview_context(definition)
    context["event_draft"]["lines"] = [
        {
            "inventory_item_name": "Chaise argentée",
            "quantity": 250,
            "breakage_price": "25 000,00",
            "notes": "",
        },
        {
            "inventory_item_name": "Table ronde",
            "quantity": 30,
            "breakage_price": None,
            "notes": "",
        },
    ]

    html = render_to_string(
        template_path,
        {"context": context, "bank": bank, "show_variables": False},
    )

    # 1. Table structure and headers
    assert "<u>Annexe 3 : Prix de casse</u>" in html
    assert '<th class="text-left">Article</th>' in html
    assert '<th class="text-center">Qté commandée</th>' in html
    assert '<th class="text-right">Prix de casse / u</th>' in html
    assert "Total potentiel" not in html
    assert "évaluer selon le constat" not in html
    assert "à évaluer selon constat" not in html

    # 2. Dynamic client lines
    assert "<td>Chaise argentée</td>" in html
    assert '<td class="text-center">250</td>' in html
    assert '<td class="text-right">Ar 25 000,00</td>' in html
    assert "<td>Table ronde</td>" in html
    assert '<td class="text-center">30</td>' in html
    assert '<td class="text-right">—</td>' in html

    # 3. Informative note at the bottom
    assert "Note : le local ou les matériels qui ne figurent pas dans la liste" in html
