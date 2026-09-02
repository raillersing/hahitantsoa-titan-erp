from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from apps.customers.models import Customer, CustomerLifecycleStatus
from apps.documents.models import DocumentTemplate, DocumentTemplateStatus, DocumentTemplateVersion
from apps.documents.runtime import generate_document_instance_html
from apps.documents.services import (
    create_document_instance_from_hahitantsoa_event_draft,
    create_document_instance_from_reservation_draft,
)
from apps.hahitantsoa.models import HahitantsoaEventDraft
from apps.reservations.models import ReservationDraft

pytestmark = pytest.mark.django_db


def test_hahitantsoa_proforma_uses_official_renderer_over_active_database_version() -> None:
    customer = Customer.objects.create(
        display_name="Rasolo Mireille",
        lifecycle_status=CustomerLifecycleStatus.CLIENT,
    )
    start_at = timezone.now().replace(microsecond=0) + timedelta(days=14)
    event_draft = HahitantsoaEventDraft.objects.create(
        customer=customer,
        event_name="Réception familiale",
        start_at=start_at,
        end_at=start_at + timedelta(hours=6),
        space_rental_amount=Decimal("12500000.00"),
        total_amount=Decimal("12500000.00"),
    )
    template = DocumentTemplate.objects.create(
        code="hahitantsoa.proforma.v1",
        name="Ancienne version concurrente",
        status=DocumentTemplateStatus.ACTIVE,
    )
    DocumentTemplateVersion.objects.create(
        template=template,
        version="legacy",
        status=DocumentTemplateStatus.ACTIVE,
        body_html="<p>DATABASE OVERRIDE</p>",
    )
    document_instance = create_document_instance_from_hahitantsoa_event_draft(
        event_draft=event_draft,
        template_key="hahitantsoa.proforma.v1",
    )

    result = generate_document_instance_html(document_instance=document_instance)

    assert "DATABASE OVERRIDE" not in result.html_content
    assert "PROFORMA Hahitantsoa" in result.html_content
    assert "Douze millions cinq cent mille Ariary" in result.html_content


def test_titan_proforma_uses_official_renderer_over_active_database_version() -> None:
    customer = Customer.objects.create(
        display_name="Rajaonarivelo Solo",
        lifecycle_status=CustomerLifecycleStatus.CLIENT,
    )
    start_at = timezone.now().replace(microsecond=0) + timedelta(days=14)
    reservation_draft = ReservationDraft.objects.create(
        customer=customer,
        start_at=start_at,
        end_at=start_at + timedelta(hours=6),
        total_amount=Decimal("850000.00"),
    )
    template = DocumentTemplate.objects.create(
        code="titan.proforma.v1",
        name="Ancienne version concurrente Titan",
        status=DocumentTemplateStatus.ACTIVE,
    )
    DocumentTemplateVersion.objects.create(
        template=template,
        version="legacy",
        status=DocumentTemplateStatus.ACTIVE,
        body_html="<p>DATABASE OVERRIDE</p>",
    )
    document_instance = create_document_instance_from_reservation_draft(
        reservation_draft=reservation_draft,
        template_key="titan.proforma.v1",
    )

    result = generate_document_instance_html(document_instance=document_instance)

    assert "DATABASE OVERRIDE" not in result.html_content
    assert "PROFORMA" in result.html_content
