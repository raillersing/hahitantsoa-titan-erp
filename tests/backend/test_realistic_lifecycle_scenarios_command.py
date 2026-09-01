import pytest
from django.core.management import call_command

from apps.documents.models import DocumentInstance, DocumentInstanceStatus
from apps.documents.runtime import DocumentGenerationResult
from apps.hahitantsoa.models import HahitantsoaEventDraft
from apps.inventory.models import InventoryItem
from apps.reservations.models import ReservationDraft, ReservationDraftStatus

pytestmark = pytest.mark.django_db


def test_realistic_scenarios_cover_prospect_confirmation_closeout_and_damage(
    django_user_model,
    monkeypatch,
    settings,
) -> None:
    settings.DEBUG = True
    django_user_model.objects.create_user(
        username="realistic-simulation-operator",
        password="test-password",
        is_staff=True,
    )
    InventoryItem.objects.create(name="Enceinte active", kind="material")
    InventoryItem.objects.create(name="Projecteur", kind="material")

    from apps.common.management.commands import seed_realistic_lifecycle_scenarios
    from apps.documents import services as document_services
    from apps.hahitantsoa import services as hahitantsoa_services
    from apps.payments import services as payment_services

    def generated_result(*, document_instance, actor):
        document_instance.status = DocumentInstanceStatus.GENERATED
        document_instance.content_checksum = "a" * 64
        document_instance.storage_path = f"tests/{document_instance.id}.html"
        document_instance.generated_content_size_bytes = 1
        document_instance.save(
            update_fields=[
                "status",
                "content_checksum",
                "storage_path",
                "generated_content_size_bytes",
                "updated_at",
            ]
        )
        return DocumentGenerationResult(
            document_instance=document_instance,
            html_content="<html></html>",
            content_checksum=document_instance.content_checksum,
        )

    # PDF rendering is separately exercised by the mounted simulation. This unit
    # test keeps the lifecycle proof focused on persisted service transitions.
    monkeypatch.setattr(
        seed_realistic_lifecycle_scenarios,
        "generate_document_instance_pdf",
        lambda *, document_instance, actor: document_instance,
    )
    monkeypatch.setattr(
        document_services,
        "generate_document_instance_pdf",
        lambda *, document_instance, actor: document_instance,
    )
    monkeypatch.setattr(
        hahitantsoa_services,
        "generate_document_instance_pdf",
        lambda *, document_instance, actor: document_instance,
    )
    monkeypatch.setattr(document_services, "generate_document_instance_html", generated_result)
    monkeypatch.setattr(payment_services, "generate_document_instance_html", generated_result)

    call_command("seed_realistic_lifecycle_scenarios", verbosity=0)

    titan_prospect = ReservationDraft.objects.get(public_reference="T-001/2026")
    titan_confirmed = ReservationDraft.objects.get(public_reference="T-002/2026")
    titan_closed = ReservationDraft.objects.get(public_reference="T-003/2026")
    titan_damage = ReservationDraft.objects.get(public_reference="T-004/2026")
    hahitantsoa = HahitantsoaEventDraft.objects.get(public_reference="H-001/2026")

    assert titan_prospect.customer.lifecycle_status == "prospect"
    assert titan_prospect.customer.prospect_status == "proforma_sent"
    assert titan_confirmed.status == ReservationDraftStatus.CONFIRMED
    assert titan_confirmed.contract_signed_at is not None
    assert titan_confirmed.required_deposit_received_at is not None
    assert hahitantsoa.status == "confirmed"
    assert titan_closed.closeout_record.status == "closed"
    assert (
        titan_damage.return_operations.get().damage_loss_settlement.execution.status == "executed"
    )

    references = set(DocumentInstance.objects.values_list("document_reference", flat=True))
    assert {
        "T-001/2026-PF",
        "T-002/2026-CT",
        "T-002/2026-REC-01",
        "H-001/2026-DR",
        "T-003/2026-BL",
        "T-003/2026-BR",
        "T-003/2026-FA",
        "T-004/2026-FC",
    } <= references
