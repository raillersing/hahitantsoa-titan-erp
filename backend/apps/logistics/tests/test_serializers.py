from datetime import UTC, datetime

import pytest

from apps.customers.models import Customer
from apps.documents.models import DocumentInstance
from apps.logistics.models import LogisticsEvent, LogisticsEventType, LogisticsOperationKind
from apps.logistics.serializers import LogisticsEventSerializer
from apps.reservations.models import ReservationDraft


@pytest.mark.django_db
def test_logistics_event_serializer_enriches_dossier_and_bl():
    customer = Customer.objects.create(
        display_name="Entreprise Test Logistics",
        phone="+261340000001",
    )
    draft = ReservationDraft.objects.create(
        customer=customer,
        public_reference="LOC-2026-9999",
        start_at=datetime(2026, 10, 1, 8, 0, tzinfo=UTC),
        end_at=datetime(2026, 10, 2, 18, 0, tzinfo=UTC),
    )
    DocumentInstance.objects.create(
        reservation_draft=draft,
        template_key="titan.delivery_note.v1",
        document_type="delivery_note",
        document_reference="BL-TIT-2026-0099",
        status="issued",
    )
    event = LogisticsEvent.objects.create(
        reservation_draft=draft,
        event_type=LogisticsEventType.DELIVERY,
        operation=LogisticsOperationKind.OUTBOUND,
    )

    data = LogisticsEventSerializer(event).data
    assert data["dossier_reference"] == "LOC-2026-9999"
    assert data["customer_name"] == "Entreprise Test Logistics"
    assert data["delivery_note_reference"] == "BL-TIT-2026-0099"
    assert data["delivery_note_status"] == "issued"
    assert data["domain"] == "titan"
