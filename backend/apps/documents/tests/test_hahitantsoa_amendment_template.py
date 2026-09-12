from django.template.loader import render_to_string


def _context(*, party_type: str) -> dict[str, object]:
    return {
        "event_draft": {
            "party_type": party_type,
            "customer_display_name": "ETS Ravinala",
            "customer_representative_name": "Rakotomalala Jean",
            "customer_representative_role": "Gérant",
            "start_at": "2026-09-01T18:00:00Z",
            "end_at": "2026-09-02T03:30:00Z",
            "total_amount": "8100000",
            "proforma_reference": "HAH N°/24.109",
            "guest_count": 250,
            "rental_type": "Location nue + logistique",
            "public_reference": "EVT-2026-DEMO",
        }
    }


def test_hahitantsoa_amendment_preserves_source_structure_for_company():
    html = render_to_string(
        "documents/hahitantsoa_contract_amendment.html",
        {"context": _context(party_type="company"), "show_variables": False},
    )

    assert "AVENANT DE CONTRAT" in html
    assert "Les modifications sont les suivantes" in html
    assert "ETS Ravinala" in html
    assert "représentée par Rakotomalala Jean, Gérant" in html
    assert "Fait en trois exemplaires originaux" in html
    assert "customer_party_type" not in html


def test_hahitantsoa_amendment_supports_individual_and_inline_variables():
    normal_html = render_to_string(
        "documents/hahitantsoa_contract_amendment.html",
        {"context": _context(party_type="individual"), "show_variables": False},
    )
    variable_html = render_to_string(
        "documents/hahitantsoa_contract_amendment.html",
        {"context": _context(party_type="individual"), "show_variables": True},
    )

    assert "ETS Ravinala, ci-après dénommée « Le client »" in normal_html
    assert "représentée par" not in normal_html
    assert "{{ client.name }}" in variable_html
    assert "{{ event.startDate }}" in variable_html
    assert "{{ finance.totalAmount }}" in variable_html
    assert "ETS Ravinala" not in variable_html


def test_hahitantsoa_amendment_source_fidelity_elements():
    ctx = _context(party_type="individual")
    ctx["event_draft"]["total_amount_formatted"] = "8 100 000,00"
    ctx["document"] = {"reference": "AVN-2026-001"}

    html = render_to_string(
        "documents/hahitantsoa_contract_amendment.html",
        {"context": ctx, "show_variables": False},
    )

    assert "<h1>AVENANT DE CONTRAT</h1>" in html
    assert "« HAHITANTSOA »" not in html
    assert "8 100 000,00" in html
    assert "Réf. Avenant : AVN-2026-001" in html
    assert "dash-list" in html
    assert "(veuillez rayer les mentions inutiles) :" in html


def _titan_context(*, party_type: str) -> dict[str, object]:
    return {
        "reservation_draft": {
            "party_type": party_type,
            "start_at": "2024-12-20T08:00:00Z",
            "end_at": "2024-12-21T18:00:00Z",
            "pickup_at": "2024-12-19T14:00:00Z",
            "return_at": "2024-12-21T18:00:00Z",
            "total_amount": "750000.00",
            "total_amount_formatted": "750 000",
            "proforma_reference": "077/24",
            "public_reference": "LOC-2024-077",
            "lines": [
                {"quantity": 150, "inventory_item_name": "chaises transparentes", "notes": ""},
                {"quantity": 150, "inventory_item_name": "coussins blancs", "notes": ""},
            ],
            "customer": {
                "party_type": party_type,
                "display_name": "RAVOMANANA Johanna",
                "civilite": "Madame, Monsieur",
                "address": "Lot IVC 45 Antananarivo",
                "phone": "+261 34 00 000 00",
                "representative_name": "RAVOMANANA Johanna",
                "representative_role": "Gérante",
            },
        }
    }


def test_titan_amendment_preserves_source_structure_for_individual():
    html = render_to_string(
        "documents/titan_material_amendment.html",
        {"context": _titan_context(party_type="individual"), "show_variables": False},
    )

    assert "<h1>AVENANT DE CONTRAT</h1>" in html
    assert "« TITAN RENTAL »" not in html
    assert "Madame, Monsieur <strong>RAVOMANANA Johanna</strong>" in html
    assert (
        "Le contrat est conclu entre les Parties en vue de la "
        "location de matériels évènementiels comprenant :"
    ) in html
    assert "dash-list" in html
    assert "150 x chaises transparentes" in html
    assert "150 x coussins blancs" in html
    assert "<strong>750 000</strong> Ariary TTC." in html
    assert "N° Proforma : 077/24" in html
    assert "Le Client," in html


def test_titan_amendment_preserves_source_structure_for_company():
    ctx = _titan_context(party_type="company")
    ctx["reservation_draft"]["customer"]["display_name"] = "Event Solutions SARL"
    ctx["reservation_draft"]["customer"]["representative_name"] = "Andry Rabe"
    ctx["reservation_draft"]["customer"]["representative_role"] = "Directeur"
    ctx["document"] = {"reference": "AVN-TITAN-2024-01"}

    html = render_to_string(
        "documents/titan_material_amendment.html",
        {"context": ctx, "show_variables": False},
    )

    assert "<h1>AVENANT DE CONTRAT</h1>" in html
    assert "La société <strong>Event Solutions SARL</strong>" in html
    assert "représentée par Andry Rabe, Directeur" in html
    assert "Pour la société Event Solutions SARL," in html
    assert "Réf. Avenant : AVN-TITAN-2024-01" in html


def test_titan_amendment_supports_inline_variables():
    html_vars = render_to_string(
        "documents/titan_material_amendment.html",
        {"context": _titan_context(party_type="individual"), "show_variables": True},
    )

    assert "{{ client.name }}" in html_vars
    assert "{{ event.startDate }}" in html_vars
    assert "{{ logistics.pickupDate }}" in html_vars
    assert "{{ logistics.returnDate }}" in html_vars
    assert "{{ lines.quantity }}" in html_vars
    assert "{{ lines.designation }}" in html_vars
    assert "{{ finance.totalAmount }}" in html_vars
    assert "RAVOMANANA Johanna" not in html_vars
