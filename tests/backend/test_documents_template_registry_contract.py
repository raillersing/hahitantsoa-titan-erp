from pathlib import Path

from apps.documents.registry import (
    DOCUMENT_TEMPLATE_REGISTRY,
    get_document_template_definition,
    get_document_template_workflow_usage,
    list_document_template_definitions,
)

SOURCE_REFERENCE_PREFIX = "docs/references/source/"
WINDOWS_SOURCE_PREFIX = "/mnt/c/Users/raillersing/Documents/Ergon Projects/Modele Facture/"


def _is_documented_source_artifact(path_value: str) -> bool:
    return path_value.endswith((".pdf", ".jpeg", ".jpg")) and (
        path_value.startswith(SOURCE_REFERENCE_PREFIX)
        or path_value.startswith(WINDOWS_SOURCE_PREFIX)
    )


def _is_runtime_template_source(path_value: str) -> bool:
    return (
        path_value.startswith("backend/apps/documents/templates/documents/")
        and Path(path_value).exists()
    )


def _path_exists_or_is_documented_source_artifact(path_value: str) -> bool:
    """Return whether a registry source is present or intentionally documented.

    The backend Docker image copies backend/ and tests/ but does not copy docs/.
    Registry source references may therefore point to versioned repository source
    files that are valid in the repository while absent from the backend test image.
    """

    return Path(path_value).exists() or _is_documented_source_artifact(path_value)


def test_document_template_registry_keys_are_unique() -> None:
    keys = [template.key for template in DOCUMENT_TEMPLATE_REGISTRY]

    assert len(keys) == len(set(keys))


def test_document_template_registry_required_fields_are_populated() -> None:
    for template in DOCUMENT_TEMPLATE_REGISTRY:
        assert template.key
        assert template.business_scope in {"hahitantsoa", "titan", "shared"}
        assert template.document_type
        assert template.label
        assert template.version
        assert template.status in {
            "validated_source_template",
            "generated_draft_template",
            "source_backed_template",
        }
        assert template.source_kind in {
            "source_pdf",
            "source_image",
            "source_html",
            "generated_from_brand_style",
        }
        assert template.source_reference
        assert template.template_path
        assert template.preview_path
        assert template.notes
        assert get_document_template_workflow_usage(template.key)


def test_document_template_registry_lookup_contract() -> None:
    templates = list_document_template_definitions()

    assert templates == DOCUMENT_TEMPLATE_REGISTRY
    assert get_document_template_definition("titan.proforma.v1") is not None
    assert get_document_template_definition("shared.unknown.v1") is None


def test_document_template_workflow_usage_is_explicit_and_read_only() -> None:
    assert get_document_template_workflow_usage("titan.proforma.v1") == (
        "Titan · réservation · proforma",
    )
    assert get_document_template_workflow_usage("shared.unknown.v1") == ()


def test_validated_source_templates_have_documented_approved_references() -> None:
    validated_templates = [
        template
        for template in DOCUMENT_TEMPLATE_REGISTRY
        if template.status == "validated_source_template"
    ]

    assert validated_templates

    for template in validated_templates:
        assert template.validated_by_client, template.key
        if template.source_kind == "source_html":
            assert template.source_reference == template.template_path, template.key
            assert _is_runtime_template_source(template.source_reference), template.key
        else:
            assert template.source_kind in {"source_pdf", "source_image"}, template.key
            assert _path_exists_or_is_documented_source_artifact(template.source_reference), (
                template.key
            )


def test_missing_runtime_html_templates_are_documented_as_non_runtime_foundation() -> None:
    missing_template_paths = [
        template.key
        for template in DOCUMENT_TEMPLATE_REGISTRY
        if not Path(template.template_path).exists()
    ]

    assert missing_template_paths

    for template in DOCUMENT_TEMPLATE_REGISTRY:
        if Path(template.template_path).exists():
            continue

        assert template.template_path.endswith("/template.html")

        is_approved_source_artifact = (
            template.status == "validated_source_template"
            and template.source_kind in {"source_pdf", "source_image"}
            and _path_exists_or_is_documented_source_artifact(template.source_reference)
        )
        is_approved_runtime_template = (
            template.status == "validated_source_template"
            and template.source_kind == "source_html"
            and template.source_reference == template.template_path
            and _is_runtime_template_source(template.source_reference)
        )
        is_generated_placeholder = (
            template.status == "generated_draft_template"
            and "Draft placeholder only" in template.notes
        )
        is_explicit_non_runtime_note = "Runtime PDF generation is not implemented" in template.notes
        is_runtime_generated_template = "PDF is generated at runtime" in template.notes

        assert (
            is_approved_source_artifact
            or is_approved_runtime_template
            or is_generated_placeholder
            or is_explicit_non_runtime_note
            or is_runtime_generated_template
        ), template.key


def test_preview_paths_are_either_source_pdfs_or_documented_future_outputs() -> None:
    for template in DOCUMENT_TEMPLATE_REGISTRY:
        preview_path = Path(template.preview_path)

        if preview_path.exists():
            continue

        is_future_preview_output = template.preview_path.endswith("/preview.pdf")
        is_source_pdf_preview = _is_documented_source_artifact(template.preview_path)

        assert is_future_preview_output or is_source_pdf_preview, template.key

        is_approved_source_artifact = (
            template.status == "validated_source_template"
            and template.source_kind in {"source_pdf", "source_image"}
            and _path_exists_or_is_documented_source_artifact(template.source_reference)
        )
        is_approved_runtime_template = (
            template.status == "validated_source_template"
            and template.source_kind == "source_html"
            and template.source_reference == template.template_path
            and _is_runtime_template_source(template.source_reference)
        )
        is_generated_placeholder = (
            template.status == "generated_draft_template"
            and "Draft placeholder only" in template.notes
        )
        is_explicit_non_runtime_note = "Runtime PDF generation is not implemented" in template.notes
        is_runtime_generated_template = "PDF is generated at runtime" in template.notes

        assert (
            is_approved_source_artifact
            or is_approved_runtime_template
            or is_generated_placeholder
            or is_explicit_non_runtime_note
            or is_runtime_generated_template
        ), template.key
