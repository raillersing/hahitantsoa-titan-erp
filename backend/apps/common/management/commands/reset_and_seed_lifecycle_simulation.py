"""Reset the local demo database and create real document-generation scenarios."""

from __future__ import annotations

from io import StringIO
from pathlib import Path

from django.conf import settings
from django.core import serializers
from django.core.management import BaseCommand, CommandError, call_command
from django.db import transaction

from apps.documents.models import DocumentTemplate, DocumentTemplateVersion
from apps.documents.registry import DOCUMENT_TEMPLATE_REGISTRY

PRESERVED_FIXTURE_LABELS = (
    "auth.user",
    "identity.applicationrole",
    "identity.userroleassignment",
    "inventory.inventoryitem",
    "inventory.inventorystoragelocation",
    "material_package.materialpackage",
    "material_package.materialpackageline",
    "hahitantsoa.hahitantsoaservice",
    "documents.documenttemplate",
    "documents.documenttemplateversion",
)


class Command(BaseCommand):
    help = (
        "Reset local demo data while preserving users and catalogues, then seed "
        "real Titan/Hahitantsoa document-generation scenarios."
    )

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            "--confirm-local-reset",
            action="store_true",
            help="Confirm destructive reset of the current local DEBUG database.",
        )

    def handle(self, *args, **options) -> None:
        if not settings.DEBUG:
            raise CommandError("Refusing lifecycle simulation reset when DEBUG is False.")
        if not options["confirm_local_reset"]:
            raise CommandError("Destructive reset blocked. Re-run with --confirm-local-reset.")

        preserved_fixture = self._dump_preserved_catalogue()
        call_command("flush", interactive=False, verbosity=0)
        self._restore_preserved_catalogue(preserved_fixture)
        self._ensure_active_document_templates()
        call_command("seed_realistic_lifecycle_scenarios", verbosity=0)

    def _dump_preserved_catalogue(self) -> str:
        output = StringIO()
        call_command(
            "dumpdata",
            *PRESERVED_FIXTURE_LABELS,
            "--natural-foreign",
            "--natural-primary",
            "--format=json",
            stdout=output,
            verbosity=0,
        )
        return output.getvalue()

    def _restore_preserved_catalogue(self, fixture: str) -> None:
        if not fixture.strip():
            return
        with transaction.atomic():
            for deserialized_object in serializers.deserialize("json", fixture):
                deserialized_object.save()

    def _ensure_active_document_templates(self) -> None:
        repository_root = Path(settings.BASE_DIR).parent
        for definition in DOCUMENT_TEMPLATE_REGISTRY:
            # ponytail: house rules are deliberately enforced outside document generation.
            if definition.key == "hahitantsoa.house_rules.v1":
                continue
            template = DocumentTemplate.objects.filter(code=definition.key).first()
            if template is not None:
                if (
                    template.status == "active"
                    and template.versions.filter(status="active").exclude(body_html="").exists()
                ):
                    continue
                raise CommandError(
                    "Document template requires a usable active version before "
                    f"the lifecycle simulation can run: {definition.key}"
                )

            source_path = repository_root / definition.template_path
            if not source_path.is_file():
                raise CommandError(f"Missing registered document source: {source_path}")
            template = DocumentTemplate.objects.create(
                code=definition.key,
                name=definition.label,
                business_scope=definition.business_scope,
                document_type=definition.document_type,
                status="active",
            )
            DocumentTemplateVersion.objects.create(
                template=template,
                version=definition.version,
                status="active",
                body_html=source_path.read_text(encoding="utf-8"),
            )
