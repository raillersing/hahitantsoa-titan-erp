from dataclasses import FrozenInstanceError
from datetime import timedelta

import pytest
from django.utils import timezone

from apps.customers.models import Customer
from apps.documents.commercial import (
    UNKNOWN_COMMERCIAL_DOCUMENT_TEMPLATE_KEY,
    CommercialDocumentContextError,
    build_reservation_draft_commercial_document_context,
)
from apps.inventory.models import InventoryAvailability, InventoryItem
from apps.reservations.models import (
    ReservationDraft,
    ReservationDraftLine,
    ReservationDraftStatus,
)

pytestmark = pytest.mark.django_db


def _create_customer() -> Customer:
    return Customer.objects.create(
        display_name="Client Commercial",
        email="client.commercial@example.test",
        phone="+261340000000",
        address="Antananarivo",
    )


def _create_inventory_item(
    *,
    name: str,
    kind: str = "material",
    description: str = "Description commerciale",
) -> InventoryItem:
    return InventoryItem.objects.create(
        name=name,
        kind=kind,
        description=description,
    )


def _create_reservation_draft(*, notes: str = "Commercial note") -> ReservationDraft:
    start_at = timezone.now() + timedelta(days=3)
    end_at = start_at + timedelta(hours=6)

    return ReservationDraft.objects.create(
        customer=_create_customer(),
        start_at=start_at,
        end_at=end_at,
        notes=notes,
    )


def test_builds_stable_commercial_document_context_from_reservation_draft() -> None:
    draft = _create_reservation_draft()
    item = _create_inventory_item(name="Projecteur LED", kind="material")
    line = ReservationDraftLine.objects.create(
        reservation_draft=draft,
        inventory_item=item,
        quantity=2,
        notes="Avec cable",
    )

    context = build_reservation_draft_commercial_document_context(
        reservation_draft=draft,
        template_key="titan.proforma.v1",
    )

    assert context.template.key == "titan.proforma.v1"
    assert context.template.business_scope == "titan"
    assert context.template.document_type == "proforma"
    assert context.template.validated_by_client is True

    reservation = context.reservation_draft
    assert reservation.reservation_draft_id == draft.id
    assert reservation.public_reference == draft.public_reference
    assert reservation.status == ReservationDraftStatus.DRAFT
    assert reservation.customer.customer_id == draft.customer_id
    assert reservation.customer.display_name == "Client Commercial"
    assert reservation.customer.email == "client.commercial@example.test"
    assert reservation.customer.phone == "+261340000000"
    assert reservation.customer.address == "Antananarivo"
    assert reservation.start_at == draft.start_at
    assert reservation.end_at == draft.end_at
    assert reservation.notes == "Commercial note"
    assert reservation.created_at == draft.created_at
    assert reservation.updated_at == draft.updated_at

    assert len(reservation.lines) == 1
    line_context = reservation.lines[0]
    assert line_context.reservation_draft_line_id == line.id
    assert line_context.inventory_item_id == item.id
    assert line_context.inventory_item_name == "Projecteur LED"
    assert line_context.inventory_item_kind == "material"
    assert line_context.inventory_item_description == "Description commerciale"
    assert line_context.quantity == 2
    assert line_context.notes == "Avec cable"

    assert context.runtime_scope_flags.pdf_runtime_generated is False
    assert context.runtime_scope_flags.inventory_blocked is False
    assert context.runtime_scope_flags.payment_created is False
    assert context.runtime_scope_flags.invoice_created is False
    assert context.runtime_scope_flags.contract_created is False
    assert context.reservation_marker_flags.contract_signed_marker_present is False
    assert context.reservation_marker_flags.required_deposit_received_marker_present is False
    assert context.reservation_marker_flags.reservation_confirmed is False
    assert context.reservation_marker_flags.reservation_cancelled is False


def test_commercial_document_context_is_immutable() -> None:
    draft = _create_reservation_draft()
    item = _create_inventory_item(name="Table ronde", kind="article")
    ReservationDraftLine.objects.create(
        reservation_draft=draft,
        inventory_item=item,
        quantity=1,
    )

    context = build_reservation_draft_commercial_document_context(
        reservation_draft=draft,
        template_key="titan.delivery_note.v1",
    )

    assert isinstance(context.reservation_draft.lines, tuple)

    with pytest.raises(FrozenInstanceError):
        context.template = context.template

    with pytest.raises(FrozenInstanceError):
        context.reservation_draft.customer.display_name = "Changed"

    with pytest.raises(FrozenInstanceError):
        context.reservation_draft.lines[0].quantity = 99


def test_commercial_document_context_excludes_soft_deleted_lines() -> None:
    draft = _create_reservation_draft()
    active_item = _create_inventory_item(name="Chaise active", kind="article")
    deleted_item = _create_inventory_item(name="Chaise supprimee", kind="article")

    active_line = ReservationDraftLine.objects.create(
        reservation_draft=draft,
        inventory_item=active_item,
        quantity=4,
    )
    ReservationDraftLine.objects.create(
        reservation_draft=draft,
        inventory_item=deleted_item,
        quantity=10,
        is_deleted=True,
        deleted_at=timezone.now(),
    )

    context = build_reservation_draft_commercial_document_context(
        reservation_draft=draft,
        template_key="titan.proforma.v1",
    )

    assert len(context.reservation_draft.lines) == 1
    assert context.reservation_draft.lines[0].reservation_draft_line_id == active_line.id
    assert context.reservation_draft.lines[0].inventory_item_name == "Chaise active"
    assert context.reservation_draft.lines[0].quantity == 4


def test_commercial_document_context_preserves_line_order() -> None:
    draft = _create_reservation_draft()
    first_item = _create_inventory_item(name="A - Sono", kind="material_pack")
    second_item = _create_inventory_item(name="B - Lumiere", kind="material")

    first_line = ReservationDraftLine.objects.create(
        reservation_draft=draft,
        inventory_item=first_item,
        quantity=1,
    )
    second_line = ReservationDraftLine.objects.create(
        reservation_draft=draft,
        inventory_item=second_item,
        quantity=3,
    )

    context = build_reservation_draft_commercial_document_context(
        reservation_draft=draft,
        template_key="titan.invoice.v1",
    )

    assert tuple(line.reservation_draft_line_id for line in context.reservation_draft.lines) == (
        first_line.id,
        second_line.id,
    )


def test_commercial_document_context_is_side_effect_free() -> None:
    draft = _create_reservation_draft()
    item = _create_inventory_item(name="Sono", kind="material_pack")
    line = ReservationDraftLine.objects.create(
        reservation_draft=draft,
        inventory_item=item,
        quantity=1,
    )

    before = {
        "draft_updated_at": draft.updated_at,
        "draft_status": draft.status,
        "line_updated_at": line.updated_at,
        "availability_count": InventoryAvailability.objects.count(),
        "contract_signed_at": draft.contract_signed_at,
        "required_deposit_received_at": draft.required_deposit_received_at,
        "confirmed_at": draft.confirmed_at,
        "cancelled_at": draft.cancelled_at,
    }

    build_reservation_draft_commercial_document_context(
        reservation_draft=draft,
        template_key="titan.material_contract.v1",
    )

    draft.refresh_from_db()
    line.refresh_from_db()

    assert draft.updated_at == before["draft_updated_at"]
    assert draft.status == before["draft_status"]
    assert line.updated_at == before["line_updated_at"]
    assert InventoryAvailability.objects.count() == before["availability_count"]
    assert draft.contract_signed_at == before["contract_signed_at"]
    assert draft.required_deposit_received_at == before["required_deposit_received_at"]
    assert draft.confirmed_at == before["confirmed_at"]
    assert draft.cancelled_at == before["cancelled_at"]


def test_commercial_document_context_reports_unknown_template_key_cleanly() -> None:
    draft = _create_reservation_draft()

    with pytest.raises(CommercialDocumentContextError) as error_info:
        build_reservation_draft_commercial_document_context(
            reservation_draft=draft,
            template_key="shared.unknown.v1",
        )

    assert error_info.value.code == UNKNOWN_COMMERCIAL_DOCUMENT_TEMPLATE_KEY
    assert "shared.unknown.v1" in str(error_info.value)


def test_commercial_document_context_exposes_reservation_marker_flags(
    django_user_model,
) -> None:
    actor = django_user_model.objects.create_user(username="commercial-marker-actor")
    draft = _create_reservation_draft()
    item = _create_inventory_item(name="Pack lumiere", kind="material_pack")
    ReservationDraftLine.objects.create(
        reservation_draft=draft,
        inventory_item=item,
        quantity=1,
    )

    marker_timestamp = timezone.now()
    draft.contract_signed_at = marker_timestamp
    draft.contract_signed_by = actor
    draft.required_deposit_received_at = marker_timestamp
    draft.required_deposit_received_by = actor
    draft.status = ReservationDraftStatus.CONFIRMED
    draft.confirmed_at = marker_timestamp
    draft.confirmed_by = actor
    draft.save(
        update_fields=[
            "contract_signed_at",
            "contract_signed_by",
            "required_deposit_received_at",
            "required_deposit_received_by",
            "status",
            "confirmed_at",
            "confirmed_by",
        ]
    )

    context = build_reservation_draft_commercial_document_context(
        reservation_draft=draft,
        template_key="titan.material_contract.v1",
    )

    assert context.reservation_marker_flags.contract_signed_marker_present is True
    assert context.reservation_marker_flags.required_deposit_received_marker_present is True
    assert context.reservation_marker_flags.reservation_confirmed is True
    assert context.reservation_marker_flags.reservation_cancelled is False
