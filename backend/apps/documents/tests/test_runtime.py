from datetime import timedelta
from decimal import Decimal
from html import unescape

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
        rental_type="bare",
        venue_name="Salle de réception Hahitantsoa",
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
    rendered_html = unescape(result.html_content)

    assert "DATABASE OVERRIDE" not in rendered_html
    assert "PROFORMA Hahitantsoa" in rendered_html
    assert "Location nue de l'espace" in rendered_html
    assert "12 500 000,00" in rendered_html
    assert "Douze millions cinq cent mille Ariary" in rendered_html


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


def test_preview_reservation_draft_document_html_renders_authentic_data() -> None:
    from apps.documents.runtime import (
        DocumentRuntimeGenerationError,
        preview_reservation_draft_document_html,
    )
    from apps.inventory.models import InventoryItem
    from apps.reservations.models import ReservationDraftLine

    customer = Customer.objects.create(
        display_name="Entreprise Test Madagascar",
        lifecycle_status=CustomerLifecycleStatus.CLIENT,
        email="contact@test-mada.mg",
    )
    start_at = timezone.now().replace(microsecond=0) + timedelta(days=10)
    reservation_draft = ReservationDraft.objects.create(
        customer=customer,
        start_at=start_at,
        end_at=start_at + timedelta(hours=5),
        total_amount=Decimal("500000.00"),
    )
    item = InventoryItem.objects.create(
        name="Tente Chapiteau 50m2",
        kind="material",
        rental_price=Decimal("250000.00"),
    )
    ReservationDraftLine.objects.create(
        reservation_draft=reservation_draft,
        inventory_item=item,
        quantity=2,
        unit_rental_price=Decimal("250000.00"),
    )

    html_content = preview_reservation_draft_document_html(
        reservation_draft=reservation_draft,
        template_key="titan.proforma.v1",
    )

    assert "Entreprise Test Madagascar" in html_content
    assert "Tente Chapiteau 50m2" in html_content
    assert "PROFORMA" in html_content

    with pytest.raises(DocumentRuntimeGenerationError):
        preview_reservation_draft_document_html(
            reservation_draft=reservation_draft,
            template_key="unsupported.template.v1",
        )


def test_document_instance_artifact_view_serves_prepared_and_issued(
    client,
    django_user_model,
) -> None:
    from apps.documents.models import DocumentInstanceStatus

    user = django_user_model.objects.create_user(
        username="artifact-test-user",
        password="test-password",
        is_staff=True,
    )
    client.force_login(user)

    customer = Customer.objects.create(
        display_name="Client Artifact Test",
        lifecycle_status=CustomerLifecycleStatus.CLIENT,
    )
    start_at = timezone.now().replace(microsecond=0) + timedelta(days=5)
    reservation_draft = ReservationDraft.objects.create(
        customer=customer,
        start_at=start_at,
        end_at=start_at + timedelta(hours=4),
        total_amount=Decimal("100000.00"),
    )
    instance = create_document_instance_from_reservation_draft(
        reservation_draft=reservation_draft,
        template_key="titan.proforma.v1",
    )
    assert instance.status == DocumentInstanceStatus.PREPARED

    url = f"/api/v1/documents/instances/{instance.id}/artifact/"
    response = client.get(url)
    assert response.status_code == 200
    assert "text/html" in response["Content-Type"]
    assert "Client Artifact Test" in response.content.decode("utf-8")

    instance.refresh_from_db()
    assert instance.status == DocumentInstanceStatus.GENERATED

    # Mark as issued
    instance.status = DocumentInstanceStatus.ISSUED
    instance.save(update_fields=["status"])
    response_issued = client.get(url)
    assert response_issued.status_code == 200

    # Mark as voided with consistent markers
    instance.status = DocumentInstanceStatus.VOIDED
    instance.voided_at = timezone.now()
    instance.voided_by = user
    instance.save(update_fields=["status", "voided_at", "voided_by"])
    response_voided = client.get(url)
    assert response_voided.status_code == 404


def test_reservation_draft_document_preview_api_view(
    client,
    django_user_model,
) -> None:
    user = django_user_model.objects.create_user(
        username="preview-test-user",
        password="test-password",
        is_staff=True,
    )
    client.force_login(user)

    customer = Customer.objects.create(
        display_name="Client Titan Live Preview",
        lifecycle_status=CustomerLifecycleStatus.CLIENT,
    )
    start_at = timezone.now().replace(microsecond=0) + timedelta(days=7)
    draft = ReservationDraft.objects.create(
        customer=customer,
        start_at=start_at,
        end_at=start_at + timedelta(hours=3),
        total_amount=Decimal("300000.00"),
    )

    url = f"/api/v1/reservations/drafts/{draft.id}/document-preview/?template_key=titan.proforma.v1"
    response = client.get(url)
    assert response.status_code == 200
    assert "text/html" in response["Content-Type"]
    assert "Client Titan Live Preview" in response.content.decode("utf-8")

    # Invalid template
    bad_url = (
        f"/api/v1/reservations/drafts/{draft.id}/document-preview/?template_key=invalid.template"
    )
    bad_response = client.get(bad_url)
    assert bad_response.status_code == 400
    assert bad_response.json()["code"] == "titan_document_preview_template_not_supported"


def test_reservation_draft_serializer_auto_creates_proforma_document(
    rf,
    django_user_model,
) -> None:
    from apps.documents.models import DocumentInstance, DocumentInstanceStatus
    from apps.inventory.models import InventoryItem
    from apps.reservations.serializers import ReservationDraftSerializer

    user = django_user_model.objects.create_user(
        username="serializer-test-user",
        password="test-password",
        is_staff=True,
    )
    customer = Customer.objects.create(
        display_name="Client Serializer Test",
        lifecycle_status=CustomerLifecycleStatus.CLIENT,
    )
    item = InventoryItem.objects.create(
        name="Table Ronde",
        kind="material",
        rental_price=Decimal("15000.00"),
        is_active=True,
    )
    start_at = timezone.now().replace(microsecond=0) + timedelta(days=12)
    end_at = start_at + timedelta(hours=8)

    request = rf.post("/api/v1/reservations/drafts/")
    request.user = user

    serializer = ReservationDraftSerializer(
        data={
            "customer_id": customer.id,
            "start_at": start_at.isoformat(),
            "end_at": end_at.isoformat(),
            "lines": [
                {
                    "inventory_item_id": item.id,
                    "quantity": 10,
                }
            ],
        },
        context={"request": request},
    )
    assert serializer.is_valid(), serializer.errors
    draft = serializer.save()

    doc_instances = DocumentInstance.objects.filter(reservation_draft=draft)
    assert doc_instances.count() == 1
    proforma = doc_instances.first()
    assert proforma.template_key == "titan.proforma.v1"
    assert proforma.status == DocumentInstanceStatus.PREPARED
    assert proforma.customer_display_name == "Client Serializer Test"


def test_hahitantsoa_event_draft_serializer_auto_creates_proforma_document(
    rf,
    django_user_model,
) -> None:
    from apps.documents.models import DocumentInstance, DocumentInstanceStatus
    from apps.hahitantsoa.serializers import HahitantsoaEventDraftSerializer

    user = django_user_model.objects.create_user(
        username="h-serializer-user",
        password="test-password",
        is_staff=True,
    )
    customer = Customer.objects.create(
        display_name="Client Hahitantsoa Serializer Test",
        lifecycle_status=CustomerLifecycleStatus.CLIENT,
    )
    start_at = timezone.now().replace(microsecond=0) + timedelta(days=20)
    end_at = start_at + timedelta(hours=10)

    request = rf.post("/api/v1/hahitantsoa/event-drafts/")
    request.user = user

    serializer = HahitantsoaEventDraftSerializer(
        data={
            "customer_id": customer.id,
            "event_name": "Mariage Test",
            "rental_type": "bare",
            "start_at": start_at.isoformat(),
            "end_at": end_at.isoformat(),
            "guest_count": 150,
            "lines": [],
        },
        context={"request": request},
    )
    assert serializer.is_valid(), serializer.errors
    event_draft = serializer.save()

    doc_instances = DocumentInstance.objects.filter(hahitantsoa_event_draft=event_draft)
    assert doc_instances.count() == 1
    proforma = doc_instances.first()
    assert proforma.template_key == "hahitantsoa.proforma.v1"
    assert proforma.status == DocumentInstanceStatus.PREPARED
    assert proforma.customer_display_name == "Client Hahitantsoa Serializer Test"


def test_all_supported_draft_preview_templates_for_hahitantsoa_and_titan(
    client,
    django_user_model,
) -> None:
    from apps.documents.runtime import (
        HAHITANTSOA_EVENT_DRAFT_PREVIEW_TEMPLATE_KEYS,
        TITAN_RESERVATION_DRAFT_PREVIEW_TEMPLATE_KEYS,
    )
    from apps.hahitantsoa.models import HahitantsoaEventDraft

    user = django_user_model.objects.create_user(
        username="preview-all-user",
        password="test-password",
        is_staff=True,
    )
    client.force_login(user)

    customer = Customer.objects.create(
        display_name="Client Multi Preview Test",
        lifecycle_status=CustomerLifecycleStatus.CLIENT,
    )
    start_at = timezone.now().replace(microsecond=0) + timedelta(days=15)
    end_at = start_at + timedelta(hours=6)

    # Test Titan draft preview
    titan_draft = ReservationDraft.objects.create(
        customer=customer,
        start_at=start_at,
        end_at=end_at,
        total_amount=Decimal("450000.00"),
    )
    for template_key in TITAN_RESERVATION_DRAFT_PREVIEW_TEMPLATE_KEYS:
        url = (
            f"/api/v1/reservations/drafts/{titan_draft.id}/document-preview/"
            f"?template_key={template_key}"
        )
        response = client.get(url)
        assert response.status_code == 200, f"Failed for {template_key}: {response.content}"
        assert "text/html" in response["Content-Type"]
        assert len(response.content) > 100

    # Test Hahitantsoa draft preview
    h_draft = HahitantsoaEventDraft.objects.create(
        customer=customer,
        created_by=user,
        event_name="Celebration Preview Test",
        start_at=start_at,
        end_at=end_at,
        total_amount=Decimal("750000.00"),
    )
    for template_key in HAHITANTSOA_EVENT_DRAFT_PREVIEW_TEMPLATE_KEYS:
        url = (
            f"/api/v1/hahitantsoa/event-drafts/{h_draft.id}/documents/preview/"
            f"?template_key={template_key}"
        )
        response = client.get(url)
        assert response.status_code == 200, f"Failed for {template_key}: {response.content}"
        assert "text/html" in response["Content-Type"]
        assert len(response.content) > 100
