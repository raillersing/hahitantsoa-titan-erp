from __future__ import annotations

from apps.documents.registry import get_document_template_definition


def resolve_document_template_path(template_key: str) -> str | None:
    """Return the canonical Django path declared by the registered template."""

    definition = get_document_template_definition(template_key)
    if definition is None:
        return None

    prefix = "backend/apps/documents/templates/"
    if not definition.template_path.startswith(prefix):
        return None
    return definition.template_path.removeprefix(prefix)
