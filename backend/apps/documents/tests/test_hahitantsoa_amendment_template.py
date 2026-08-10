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
