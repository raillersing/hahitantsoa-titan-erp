from apps.documents.rendering import resolve_document_template_path


def test_protected_workflow_documents_resolve_to_their_existing_templates() -> None:
    assert (
        resolve_document_template_path("hahitantsoa.contract.v1")
        == "documents/hahitantsoa_contract.html"
    )
    assert (
        resolve_document_template_path("titan.material_contract.v1")
        == "documents/titan_material_contract.html"
    )
    assert (
        resolve_document_template_path("hahitantsoa.proforma.v1")
        == "documents/hahitantsoa_proforma.html"
    )
    assert resolve_document_template_path("titan.proforma.v1") == "documents/titan_proforma.html"


def test_unknown_or_excluded_document_has_no_runtime_template() -> None:
    assert resolve_document_template_path("hahitantsoa.house_rules.v1") is None
    assert resolve_document_template_path("shared.unknown.v1") is None
