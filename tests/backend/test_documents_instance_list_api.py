from datetime import timedelta

import pytest
from django.utils import timezone

from apps.customers.models import Customer
from apps.documents.models import DocumentInstance
from apps.reservations.models import ReservationDraft

pytestmark = pytest.mark.django_db


def test_document_hub_list_exposes_the_canonical_document_reference(
    client, django_user_model
) -> None:
    actor = django_user_model.objects.create_user(
        username="document-hub-user", password="test-pass"
    )
    customer = Customer.objects.create(display_name="Client hub documents")
    start_at = timezone.now().replace(microsecond=0) + timedelta(days=1)
    reservation = ReservationDraft.objects.create(
        customer=customer,
        start_at=start_at,
        end_at=start_at + timedelta(hours=4),
    )
    DocumentInstance.objects.create(
        reservation_draft=reservation,
        customer=customer,
        template_key="titan.proforma.v1",
        template_version="v1",
        template_label="Proforma Titan",
        business_scope="titan",
        document_type="proforma",
        template_status="active",
        template_source_kind="source_html",
        template_source_reference="approved source",
        template_path="templates/proforma.html",
        template_preview_path="",
        template_validated_by_client=True,
        document_reference=f"{reservation.public_reference}-PF",
        reservation_public_reference=reservation.public_reference,
        reservation_status=reservation.status,
        customer_display_name=customer.display_name,
        prepared_by=actor,
    )

    client.force_login(actor)
    response = client.get("/api/v1/documents/instances/")

    assert response.status_code == 200
    assert response.json()[0]["document_reference"] == f"{reservation.public_reference}-PF"
