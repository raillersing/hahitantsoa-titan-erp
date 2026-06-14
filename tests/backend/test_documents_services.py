from datetime import timedelta

import pytest
from django.utils import timezone

from apps.customers.models import Customer
from apps.documents.commercial import CommercialDocumentContextError
from apps.documents.services import (
    get_reservation_draft_commercial_document_context_service,
)
from apps.inventory.models import InventoryItem
from apps.reservations.models import ReservationDraft, ReservationDraftLine

pytestmark = pytest.mark.django_db


def _customer() -> Customer:
    return Customer.objects.create(
        display_name="Client service",
        email="service@example.test",
        phone="+261340000010",
        address="Antananarivo",
    )


def _item(*, name: str = "Pack video", kind: str = "material_pack") -> InventoryItem:
    return InventoryItem.objects.create(
        name=name,
        kind=kind,
        description="Description service",
    )


def _draft() -> ReservationDraft:
    start_at = timezone.now().replace(microsecond=0) + timedelta(days=1)
    end_at = start_at + timedelta(hours=3)
    return ReservationDraft.objects.create(
        customer=_customer(),
        start_at=start_at,
        end_at=end_at,
        notes="Service draft",
    )


def test_get_reservation_draft_commercial_document_context_service_builds_context() -> None:
    draft = _draft()
    item = _item()
    ReservationDraftLine.objects.create(
        reservation_draft=draft,
        inventory_item=item,
        quantity=2,
        notes="Service line",
    )

    context = get_reservation_draft_commercial_document_context_service(
        reservation_draft_id=draft.id,
        template_key="titan.proforma.v1",
    )

    assert context.template.key == "titan.proforma.v1"
    assert context.reservation_draft.reservation_draft_id == draft.id
    assert len(context.reservation_draft.lines) == 1
    assert context.reservation_draft.lines[0].inventory_item_name == item.name


def test_get_reservation_draft_commercial_document_context_service_rejects_soft_deleted_draft() -> (
    None
):
    draft = _draft()
    draft.is_deleted = True
    draft.deleted_at = timezone.now()
    draft.save(update_fields=["is_deleted", "deleted_at"])

    with pytest.raises(ReservationDraft.DoesNotExist):
        get_reservation_draft_commercial_document_context_service(
            reservation_draft_id=draft.id,
            template_key="titan.proforma.v1",
        )


def test_get_reservation_draft_commercial_document_context_service_propagates_unknown_template():
    draft = _draft()

    with pytest.raises(CommercialDocumentContextError):
        get_reservation_draft_commercial_document_context_service(
            reservation_draft_id=draft.id,
            template_key="shared.unknown.v1",
        )
