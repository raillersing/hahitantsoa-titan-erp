import pytest

from apps.common.management.commands import reset_and_seed_lifecycle_simulation
from apps.common.management.commands.reset_and_seed_lifecycle_simulation import Command
from apps.documents.models import DocumentTemplate
from apps.documents.registry import get_document_template_definition

pytestmark = pytest.mark.django_db


def test_active_template_bootstrap_skips_house_rules_generation_disabled(monkeypatch) -> None:
    definition = get_document_template_definition("hahitantsoa.house_rules.v1")
    assert definition is not None
    monkeypatch.setattr(
        reset_and_seed_lifecycle_simulation,
        "DOCUMENT_TEMPLATE_REGISTRY",
        (definition,),
    )

    Command()._ensure_active_document_templates()

    assert not DocumentTemplate.objects.filter(code=definition.key).exists()
