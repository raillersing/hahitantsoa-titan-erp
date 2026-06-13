from datetime import timedelta

import pytest
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.customers.models import Customer
from apps.documents.commercial import (
    UNKNOWN_COMMERCIAL_DOCUMENT_TEMPLATE_KEY,
    CommercialDocumentContextError,
)
from apps.documents.models import DocumentInstance, DocumentInstanceStatus
from apps.documents.selectors import (
    get_document_instance_by_id,
    list_active_document_instances_for_reservation_draft,
    list_document_instances_for_reservation_draft,
    list_generated_document_instances_for_reservation_draft,
)
from apps.documents.services import create_document_instance_from_reservation_draft
from apps.inventory.models import InventoryAvailability, InventoryItem
from apps.reservations.models import ReservationDraft, ReservationDraftLine

pytestmark = pytest.mark.django_db


def _customer() -> Customer:
    return Customer.objects.create(
        display_name="Client documents",
        email="docs@example.test",
        phone="+261340000001",
        address="Antananarivo",
    )


def _item(*, name: str = "Projecteur Titan", kind: str = "material") -> InventoryItem:
    return InventoryItem.objects.create(
        name=name,
        kind=kind,
        description="Description inventory",
    )


def _draft(*, customer: Customer | None = None) -> ReservationDraft:
    start_at = timezone.now().replace(microsecond=0) + timedelta(days=2)
    end_at = start_at + timedelta(hours=4)
    return ReservationDraft.objects.create(
        customer=customer or _customer(),
        start_at=start_at,
        end_at=end_at,
        notes="Reservation draft notes",
    )


def _draft_with_line() -> ReservationDraft:
    draft = _draft()
    ReservationDraftLine.objects.create(
        reservation_draft=draft,
        inventory_item=_item(),
        quantity=2,
        notes="Line note",
    )
    return draft


def test_document_instance_can_be_persisted_with_required_foundation_fields(
    django_user_model,
) -> None:
    draft = _draft()
    actor = django_user_model.objects.create_user(username="prepared-actor", password="test-pass")

    instance = DocumentInstance.objects.create(
        reservation_draft=draft,
        customer=draft.customer,
        template_key="titan.proforma.v1",
        template_version="v1",
        template_label="Proforma Titan",
        business_scope="titan",
        document_type="proforma",
        template_status="validated_source_template",
        template_source_kind="source_pdf",
        template_source_reference="docs/references/source/Document_A.pdf",
        template_path="backend/apps/documents/templates_documents/titan/proforma/v1/template.html",
        template_preview_path="backend/apps/documents/templates_documents/titan/proforma/v1/preview.pdf",
        template_validated_by_client=True,
        template_notes="Template notes",
        reservation_public_reference=draft.public_reference,
        reservation_status=draft.status,
        customer_display_name=draft.customer.display_name,
        customer_email=draft.customer.email,
        customer_phone=draft.customer.phone,
        customer_address=draft.customer.address,
        prepared_by=actor,
    )

    assert instance.status == DocumentInstanceStatus.PREPARED
    assert instance.prepared_by_id == actor.pk
    assert instance.voided_at is None
    assert instance.voided_by_id is None
    assert instance.content_checksum is None
    assert instance.storage_path is None


def test_document_instance_rejects_voided_status_without_void_markers_at_db_level() -> None:
    draft = _draft()

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            DocumentInstance.objects.create(
                reservation_draft=draft,
                customer=draft.customer,
                template_key="titan.proforma.v1",
                template_version="v1",
                template_label="Proforma Titan",
                business_scope="titan",
                document_type="proforma",
                template_status="validated_source_template",
                template_source_kind="source_pdf",
                template_source_reference="docs/references/source/Document_A.pdf",
                template_path="backend/apps/documents/templates_documents/titan/proforma/v1/template.html",
                template_preview_path="backend/apps/documents/templates_documents/titan/proforma/v1/preview.pdf",
                template_validated_by_client=True,
                template_notes="Template notes",
                reservation_public_reference=draft.public_reference,
                reservation_status=draft.status,
                customer_display_name=draft.customer.display_name,
                customer_email=draft.customer.email,
                customer_phone=draft.customer.phone,
                customer_address=draft.customer.address,
                status=DocumentInstanceStatus.VOIDED,
            )


def test_create_document_instance_from_reservation_draft_snapshots_template_and_links(
    django_user_model,
) -> None:
    draft = _draft_with_line()
    actor = django_user_model.objects.create_user(username="docs-service", password="test-pass")

    instance = create_document_instance_from_reservation_draft(
        reservation_draft=draft,
        template_key="titan.proforma.v1",
        actor=actor,
        notes="Prepared for review",
    )

    assert instance.reservation_draft_id == draft.id
    assert instance.customer_id == draft.customer_id
    assert instance.template_key == "titan.proforma.v1"
    assert instance.template_version == "v1"
    assert instance.template_label == "Proforma Titan"
    assert instance.business_scope == "titan"
    assert instance.document_type == "proforma"
    assert instance.template_status == "validated_source_template"
    assert instance.template_source_kind == "source_pdf"
    assert instance.template_validated_by_client is True
    assert instance.reservation_public_reference == draft.public_reference
    assert instance.reservation_status == draft.status
    assert instance.customer_display_name == draft.customer.display_name
    assert instance.customer_email == draft.customer.email
    assert instance.customer_phone == draft.customer.phone
    assert instance.customer_address == draft.customer.address
    assert instance.status == DocumentInstanceStatus.PREPARED
    assert instance.prepared_by_id == actor.pk
    assert instance.notes == "Prepared for review"


def test_create_document_instance_from_reservation_draft_is_side_effect_controlled(
    django_user_model,
) -> None:
    draft = _draft_with_line()
    actor = django_user_model.objects.create_user(
        username="side-effect-actor",
        password="test-pass",
    )
    before = {
        "draft_status": draft.status,
        "draft_updated_at": draft.updated_at,
        "availability_count": InventoryAvailability.objects.count(),
        "document_count": DocumentInstance.objects.count(),
        "contract_signed_at": draft.contract_signed_at,
        "required_deposit_received_at": draft.required_deposit_received_at,
        "confirmed_at": draft.confirmed_at,
        "cancelled_at": draft.cancelled_at,
    }

    instance = create_document_instance_from_reservation_draft(
        reservation_draft=draft,
        template_key="titan.proforma.v1",
        actor=actor,
    )

    draft.refresh_from_db()

    assert DocumentInstance.objects.count() == before["document_count"] + 1
    assert instance.storage_path is None
    assert instance.content_checksum is None
    assert draft.status == before["draft_status"]
    assert draft.updated_at == before["draft_updated_at"]
    assert InventoryAvailability.objects.count() == before["availability_count"]
    assert draft.contract_signed_at == before["contract_signed_at"]
    assert draft.required_deposit_received_at == before["required_deposit_received_at"]
    assert draft.confirmed_at == before["confirmed_at"]
    assert draft.cancelled_at == before["cancelled_at"]


def test_create_document_instance_from_reservation_draft_propagates_unknown_template_key() -> None:
    draft = _draft_with_line()

    with pytest.raises(CommercialDocumentContextError) as error_info:
        create_document_instance_from_reservation_draft(
            reservation_draft=draft,
            template_key="shared.unknown.v1",
        )

    assert error_info.value.code == UNKNOWN_COMMERCIAL_DOCUMENT_TEMPLATE_KEY


def test_document_instance_selectors_list_and_filter_voided_instances(
    django_user_model,
) -> None:
    draft = _draft_with_line()
    actor = django_user_model.objects.create_user(username="voided-actor", password="test-pass")
    active_instance = create_document_instance_from_reservation_draft(
        reservation_draft=draft,
        template_key="titan.proforma.v1",
    )
    voided_instance = create_document_instance_from_reservation_draft(
        reservation_draft=draft,
        template_key="titan.invoice.v1",
    )
    voided_instance.status = DocumentInstanceStatus.VOIDED
    voided_instance.voided_at = timezone.now()
    voided_instance.voided_by = actor
    voided_instance.void_reason = "Voided for replacement"
    voided_instance.save(
        update_fields=["status", "voided_at", "voided_by", "void_reason", "updated_at"]
    )

    all_instances = tuple(list_document_instances_for_reservation_draft(reservation_draft=draft))
    active_instances = tuple(
        list_active_document_instances_for_reservation_draft(reservation_draft=draft)
    )
    fetched = get_document_instance_by_id(document_instance_id=active_instance.id)

    assert all_instances == (active_instance, voided_instance)
    assert active_instances == (active_instance,)
    assert fetched == active_instance


def test_document_instance_service_allows_multiple_instances_for_same_template_key() -> None:
    draft = _draft_with_line()

    first = create_document_instance_from_reservation_draft(
        reservation_draft=draft,
        template_key="titan.proforma.v1",
    )
    second = create_document_instance_from_reservation_draft(
        reservation_draft=draft,
        template_key="titan.proforma.v1",
    )

    assert first.id != second.id
    assert (
        DocumentInstance.objects.filter(
            reservation_draft=draft,
            template_key="titan.proforma.v1",
        ).count()
        == 2
    )


def test_list_generated_document_instances_for_reservation_draft(django_user_model) -> None:
    draft_a = _draft_with_line()
    draft_b = _draft_with_line()
    actor = django_user_model.objects.create_user(username="test-actor-gen", password="test-pass")

    def _create_instance(draft, status, template_key):
        instance = create_document_instance_from_reservation_draft(
            reservation_draft=draft,
            template_key=template_key,
        )
        instance.status = status
        if status == DocumentInstanceStatus.VOIDED:
            instance.voided_at = timezone.now()
            instance.voided_by = actor
            instance.void_reason = "Void reasons"
        instance.save()
        return instance

    gen_a = _create_instance(draft_a, DocumentInstanceStatus.GENERATED, "titan.proforma.v1")
    _create_instance(draft_a, DocumentInstanceStatus.PREPARED, "titan.proforma.v1")
    _create_instance(draft_a, DocumentInstanceStatus.VOIDED, "titan.proforma.v1")
    _create_instance(draft_a, DocumentInstanceStatus.ISSUED, "titan.proforma.v1")

    gen_b = _create_instance(draft_b, DocumentInstanceStatus.GENERATED, "titan.proforma.v1")

    result_a = list_generated_document_instances_for_reservation_draft(reservation_draft=draft_a)
    result_b = list_generated_document_instances_for_reservation_draft(reservation_draft=draft_b)

    assert list(result_a) == [gen_a]
    assert list(result_b) == [gen_b]

    draft_a.refresh_from_db()
    gen_a.refresh_from_db()

    status_before = draft_a.status
    updated_at_before = draft_a.updated_at
    gen_status_before = gen_a.status
    gen_updated_at_before = gen_a.updated_at

    list(list_generated_document_instances_for_reservation_draft(reservation_draft=draft_a))

    draft_a.refresh_from_db()
    gen_a.refresh_from_db()

    assert draft_a.status == status_before
    assert draft_a.updated_at == updated_at_before
    assert gen_a.status == gen_status_before
    assert gen_a.updated_at == gen_updated_at_before
