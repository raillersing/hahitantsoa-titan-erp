from datetime import timedelta

import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.utils import timezone

from apps.customers.models import Customer
from apps.documents.models import DocumentInstance
from apps.documents.services import create_document_instance_from_hahitantsoa_event_draft
from apps.hahitantsoa.composition import default_bare_rental_composition
from apps.hahitantsoa.models import HahitantsoaEventDraft


@pytest.mark.django_db(transaction=True)
def test_migration_keeps_existing_composition_and_generated_artifact_untouched():
    start = timezone.now() + timedelta(days=40)
    draft = HahitantsoaEventDraft.objects.create(
        customer=Customer.objects.create(display_name="Historical composition"),
        event_name="Historical event",
        start_at=start,
        end_at=start + timedelta(hours=4),
    )
    emitted = create_document_instance_from_hahitantsoa_event_draft(
        event_draft=draft, template_key="hahitantsoa.proforma.v1"
    )
    prepared = create_document_instance_from_hahitantsoa_event_draft(
        event_draft=draft, template_key="hahitantsoa.delivery_note.v1"
    )
    DocumentInstance.objects.filter(pk=emitted.pk).update(
        status="generated", content_checksum="a" * 64, storage_path="historical.html"
    )
    old_targets = [
        ("documents", "0021_alter_numberingsequence_options_and_more"),
        ("hahitantsoa", "0021_update_night_security_amount_default"),
    ]
    executor = MigrationExecutor(connection)
    latest = executor.loader.graph.leaf_nodes()
    try:
        executor.migrate(old_targets)
    finally:
        MigrationExecutor(connection).migrate(latest)
    draft.refresh_from_db()
    emitted.refresh_from_db()
    prepared.refresh_from_db()
    assert [row["label"] for row in draft.bare_rental_composition] == [
        "Salle",
        "Espace vert",
        "Estrade mariés",
        "Estrade animation",
        "Table mariés",
        "Table DJ",
        "Chaises pliables",
    ]
    assert emitted.bare_rental_composition_snapshot["legacy"] is True
    assert emitted.content_checksum == "a" * 64
    assert emitted.storage_path == "historical.html"
    assert prepared.bare_rental_composition_snapshot is None
    new_draft = HahitantsoaEventDraft.objects.create(
        customer=draft.customer,
        event_name="New event",
        start_at=start + timedelta(days=1),
        end_at=start + timedelta(days=1, hours=4),
    )
    assert new_draft.bare_rental_composition == default_bare_rental_composition()
