"""Reset the local demo database and create real document-generation scenarios."""

from __future__ import annotations

from io import StringIO

from django.conf import settings
from django.core import serializers
from django.core.management import BaseCommand, CommandError, call_command
from django.db import transaction

from apps.documents.models import DocumentInstance
from apps.documents.services import (
    create_document_instance_from_hahitantsoa_event_draft,
    create_document_instance_from_reservation_draft,
    generate_document_instance_pdf,
    generate_hahitantsoa_event_draft_document_instance_html,
    generate_reservation_draft_document_instance_html,
)
from apps.hahitantsoa.models import HahitantsoaEventDraft
from apps.reservations.models import ReservationDraft

PRESERVED_FIXTURE_LABELS = (
    "auth.user",
    "identity.applicationrole",
    "identity.userroleassignment",
    "inventory.inventoryitem",
    "inventory.inventorystoragelocation",
    "material_package.materialpackage",
    "material_package.materialpackageline",
    "hahitantsoa.hahitantsoaservice",
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
        call_command("seed_all_demo", verbosity=0)
        self._generate_scenario_documents()

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

    def _generate_scenario_documents(self) -> None:
        actor = self._actor()
        titan_count = 0
        hahitantsoa_count = 0

        titan_documents = {
            "T-001/2026": ("T-001/2026", ("PF",)),
            "T-002/2026": ("T-002/2026", ("PF", "CT")),
            "T-003/2026": ("T-003/2026", ("PF", "CT")),
            "T-004/2026": ("T-004/2026", ("CT",)),
        }
        for draft in ReservationDraft.objects.filter(is_deleted=False).order_by("public_reference"):
            scenario = titan_documents.get(draft.public_reference)
            if scenario is None:
                continue
            root, suffixes = scenario
            if "PF" in suffixes:
                proforma = create_document_instance_from_reservation_draft(
                    reservation_draft=draft,
                    template_key="titan.proforma.v1",
                    actor=actor,
                    notes="Simulation cycle de vie Titan.",
                )
                self._emit_reservation_document(proforma, draft, actor, f"{root}-PF")
                titan_count += 1

            if "CT" in suffixes:
                contract = create_document_instance_from_reservation_draft(
                    reservation_draft=draft,
                    template_key="titan.material_contract.v1",
                    actor=actor,
                    notes="Simulation contrat Titan.",
                )
                self._emit_reservation_document(contract, draft, actor, f"{root}-CT")
                titan_count += 1

        event = HahitantsoaEventDraft.objects.filter(
            public_reference="H-001/2026", is_deleted=False
        ).first()
        if event is not None:
            root = "H-001/2026"
            proforma = create_document_instance_from_hahitantsoa_event_draft(
                event_draft=event,
                template_key="hahitantsoa.proforma.v1",
                actor=actor,
                notes="Simulation cycle de vie Hahitantsoa.",
            )
            self._emit_event_document(proforma, event, actor, f"{root}-PF")
            hahitantsoa_count += 1

            contract = create_document_instance_from_hahitantsoa_event_draft(
                event_draft=event,
                template_key="hahitantsoa.contract.v1",
                actor=actor,
                notes="Simulation contrat Hahitantsoa.",
            )
            self._emit_event_document(contract, event, actor, f"{root}-CT")
            hahitantsoa_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Lifecycle simulation ready: {titan_count} Titan and "
                f"{hahitantsoa_count} Hahitantsoa documents emitted."
            )
        )

    @staticmethod
    def _actor():
        from django.contrib.auth import get_user_model

        return get_user_model().objects.filter(is_active=True).order_by("id").first()

    @staticmethod
    def _emit_reservation_document(
        document: DocumentInstance, draft, actor, reference: str
    ) -> None:
        document.document_reference = reference
        document.save(update_fields=["document_reference", "updated_at"])
        document = generate_reservation_draft_document_instance_html(
            reservation_draft=draft,
            document_instance_id=document.id,
            actor=actor,
        )
        generate_document_instance_pdf(document_instance=document, actor=actor)

    @staticmethod
    def _emit_event_document(document: DocumentInstance, event, actor, reference: str) -> None:
        document.document_reference = reference
        document.save(update_fields=["document_reference", "updated_at"])
        document = generate_hahitantsoa_event_draft_document_instance_html(
            event_draft=event,
            document_instance_id=document.id,
            actor=actor,
        )
        generate_document_instance_pdf(document_instance=document, actor=actor)
