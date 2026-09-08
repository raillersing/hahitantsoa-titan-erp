from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from apps.customers.models import Customer
from apps.documents.pdf import DocumentPDFGenerationError
from apps.documents.runtime import DocumentRuntimeGenerationError
from apps.documents.services import (
    create_document_instance_from_hahitantsoa_event_draft,
    create_document_instance_from_reservation_draft,
    generate_document_instance_pdf,
    generate_hahitantsoa_event_draft_document_instance_html,
    generate_reservation_draft_document_instance_html,
)
from apps.hahitantsoa.models import (
    HahitantsoaEventDraft,
    HahitantsoaEventDraftAmendmentRequest,
    HahitantsoaEventDraftLine,
)
from apps.inventory.models import InventoryItem
from apps.reservations.models import ReservationDraft, ReservationDraftLine


@pytest.fixture
def api_user():
    return get_user_model().objects.create_user(
        username="amendment-tester",
        password="test-password-123",
        is_staff=True,
    )


@pytest.fixture
def auth_client(api_user):
    client = APIClient()
    client.force_authenticate(user=api_user)
    return client


@pytest.mark.django_db
def test_hahitantsoa_bare_amendment_on_confirmed_event(auth_client, api_user):
    customer = Customer.objects.create(display_name="Client Test", created_by=api_user)
    start_at = timezone.now() + timedelta(days=10)
    end_at = start_at + timedelta(hours=8)

    draft = HahitantsoaEventDraft.objects.create(
        customer=customer,
        event_name="Mariage Bare Test",
        event_type="wedding",
        rental_type="bare",
        guest_count=200,
        space_rental_amount=Decimal("1000000.00"),
        total_amount=Decimal("1000000.00"),
        start_at=start_at,
        end_at=end_at,
        status="confirmed",
        confirmed_at=timezone.now(),
        confirmed_by=api_user,
        created_by=api_user,
    )

    # Generate initial contract
    contract = create_document_instance_from_hahitantsoa_event_draft(
        event_draft=draft,
        template_key="hahitantsoa.contract.v1",
        actor=api_user,
    )
    contract = generate_hahitantsoa_event_draft_document_instance_html(
        event_draft=draft,
        document_instance_id=contract.id,
        actor=api_user,
    )
    generate_document_instance_pdf(document_instance=contract, actor=api_user)

    # Create amendment request
    resp = auth_client.post(
        f"/api/v1/hahitantsoa/event-drafts/{draft.id}/amendment-requests/",
        {
            "reason": "Ajout convives",
            "notes": "Passage à 308 convives",
            "changed_guest_count": 308,
            "changed_space_rental_amount": "1250000.00",
            "changed_rental_type": "bare",
        },
        format="json",
    )
    assert resp.status_code == 201, resp.data
    amend_id = resp.data["amendment_request"]["id"]

    # Apply amendment request
    apply_resp = auth_client.post(
        f"/api/v1/hahitantsoa/event-drafts/{draft.id}/amendment-requests/{amend_id}/apply/",
        format="json",
    )
    assert apply_resp.status_code == 200, apply_resp.data


@pytest.mark.django_db
def test_hahitantsoa_logistics_amendment_on_confirmed_event(auth_client, api_user):
    customer = Customer.objects.create(display_name="Client Test 2", created_by=api_user)
    item = InventoryItem.objects.create(
        name="Chaise Napoléon",
        kind="material",
        rental_price=Decimal("2500.00"),
        created_by=api_user,
    )
    start_at = timezone.now() + timedelta(days=10)
    end_at = start_at + timedelta(hours=8)

    draft = HahitantsoaEventDraft.objects.create(
        customer=customer,
        event_name="Mariage Logistics Test",
        event_type="wedding",
        rental_type="logistics",
        guest_count=200,
        space_rental_amount=Decimal("1500000.00"),
        logistics_amount=Decimal("500000.00"),
        total_amount=Decimal("2000000.00"),
        start_at=start_at,
        end_at=end_at,
        status="confirmed",
        confirmed_at=timezone.now(),
        confirmed_by=api_user,
        created_by=api_user,
    )
    HahitantsoaEventDraftLine.objects.create(
        event_draft=draft,
        inventory_item=item,
        quantity=200,
        unit_rental_price=Decimal("2500.00"),
        created_by=api_user,
    )

    # Generate initial contract
    contract = create_document_instance_from_hahitantsoa_event_draft(
        event_draft=draft,
        template_key="hahitantsoa.contract.v1",
        actor=api_user,
    )
    contract = generate_hahitantsoa_event_draft_document_instance_html(
        event_draft=draft,
        document_instance_id=contract.id,
        actor=api_user,
    )
    generate_document_instance_pdf(document_instance=contract, actor=api_user)

    # Create amendment request
    resp = auth_client.post(
        f"/api/v1/hahitantsoa/event-drafts/{draft.id}/amendment-requests/",
        {
            "reason": "Augmentation chaises",
            "notes": "Passage à 308 chaises",
            "changed_guest_count": 308,
            "changed_space_rental_amount": "1750000.00",
            "changed_rental_type": "logistics",
        },
        format="json",
    )
    assert resp.status_code == 201, resp.data
    amend_id = resp.data["amendment_request"]["id"]

    # Add line to amendment request
    line_resp = auth_client.post(
        f"/api/v1/hahitantsoa/event-drafts/{draft.id}/amendment-requests/{amend_id}/lines/",
        {
            "inventory_item_id": str(item.id),
            "quantity": 308,
            "notes": "Chaises supplémentaires",
        },
        format="json",
    )
    assert line_resp.status_code == 201, line_resp.data

    # Apply amendment request
    apply_resp = auth_client.post(
        f"/api/v1/hahitantsoa/event-drafts/{draft.id}/amendment-requests/{amend_id}/apply/",
        format="json",
    )
    assert apply_resp.status_code == 200, apply_resp.data


@pytest.mark.django_db
def test_hahitantsoa_unconfirmed_draft_patch_update(auth_client, api_user):
    customer = Customer.objects.create(display_name="Client Test 3", created_by=api_user)
    item = InventoryItem.objects.create(
        name="Table Ronde",
        kind="material",
        rental_price=Decimal("15000.00"),
        created_by=api_user,
    )
    start_at = timezone.now() + timedelta(days=10)
    end_at = start_at + timedelta(hours=8)

    draft = HahitantsoaEventDraft.objects.create(
        customer=customer,
        event_name="Brouillon Hahitantsoa",
        event_type="wedding",
        rental_type="logistics",
        guest_count=200,
        space_rental_amount=Decimal("1500000.00"),
        logistics_amount=Decimal("300000.00"),
        total_amount=Decimal("1800000.00"),
        start_at=start_at,
        end_at=end_at,
        status="draft",
        created_by=api_user,
    )
    HahitantsoaEventDraftLine.objects.create(
        event_draft=draft,
        inventory_item=item,
        quantity=20,
        unit_rental_price=Decimal("15000.00"),
        created_by=api_user,
    )

    # PATCH draft directly as done in unconfirmed mode
    resp = auth_client.patch(
        f"/api/v1/hahitantsoa/event-drafts/{draft.id}/",
        {
            "rental_type": "logistics",
            "guest_count": 308,
            "space_rental_amount": 1750000,
            "venue_name": "Grande Salle Hahitantsoa",
            "location_details": "Disposition en U",
            "service_notes": "Piste de danse",
            "notes": "Notes avenant",
            "lines": [
                {
                    "inventory_item_id": str(item.id),
                    "quantity": 30,
                    "notes": "30 tables",
                }
            ],
        },
        format="json",
    )
    assert resp.status_code == 200, resp.data


@pytest.mark.django_db
def test_titan_amendment_on_confirmed_reservation(auth_client, api_user):
    customer = Customer.objects.create(display_name="Client Titan", created_by=api_user)
    item = InventoryItem.objects.create(
        name="Tente 10x10",
        kind="material",
        rental_price=Decimal("500000.00"),
        created_by=api_user,
    )
    start_at = timezone.now() + timedelta(days=10)
    end_at = start_at + timedelta(hours=8)

    draft = ReservationDraft.objects.create(
        customer=customer,
        start_at=start_at,
        end_at=end_at,
        status="confirmed",
        confirmed_at=timezone.now(),
        confirmed_by=api_user,
        subtotal_amount=Decimal("500000.00"),
        total_amount=Decimal("500000.00"),
        created_by=api_user,
    )
    ReservationDraftLine.objects.create(
        reservation_draft=draft,
        inventory_item=item,
        quantity=1,
        unit_rental_price=Decimal("500000.00"),
        created_by=api_user,
    )

    # Generate contract
    contract = create_document_instance_from_reservation_draft(
        reservation_draft=draft,
        template_key="titan.material_contract.v1",
        actor=api_user,
    )
    contract = generate_reservation_draft_document_instance_html(
        reservation_draft=draft,
        document_instance_id=contract.id,
        actor=api_user,
    )
    generate_document_instance_pdf(document_instance=contract, actor=api_user)

    # POST amendment
    resp = auth_client.post(
        f"/api/v1/reservations/drafts/{draft.id}/amendments/",
        {
            "reason": "Ajout d'une tente",
            "notes": "2 tentes requises",
            "changed_lines": [
                {
                    "inventory_item_id": str(item.id),
                    "quantity": 2,
                    "notes": "2 tentes",
                }
            ],
        },
        format="json",
    )
    assert resp.status_code == 201, resp.data


@pytest.mark.django_db
def test_hahitantsoa_amendment_document_failure_is_controlled_and_rolls_back(auth_client, api_user):
    customer = Customer.objects.create(display_name="Client Hahitantsoa", created_by=api_user)
    start_at = timezone.now() + timedelta(days=10)
    end_at = start_at + timedelta(hours=8)
    draft = HahitantsoaEventDraft.objects.create(
        customer=customer,
        event_name="Mariage Hahitantsoa",
        event_type="wedding",
        rental_type="bare",
        guest_count=200,
        space_rental_amount=Decimal("1000000.00"),
        total_amount=Decimal("1000000.00"),
        start_at=start_at,
        end_at=end_at,
        status="confirmed",
        confirmed_at=timezone.now(),
        confirmed_by=api_user,
        created_by=api_user,
    )
    contract = create_document_instance_from_hahitantsoa_event_draft(
        event_draft=draft, template_key="hahitantsoa.contract.v1", actor=api_user
    )
    contract = generate_hahitantsoa_event_draft_document_instance_html(
        event_draft=draft, document_instance_id=contract.id, actor=api_user
    )
    generate_document_instance_pdf(document_instance=contract, actor=api_user)
    response = auth_client.post(
        f"/api/v1/hahitantsoa/event-drafts/{draft.id}/amendment-requests/",
        {"reason": "Changement", "changed_guest_count": 250},
        format="json",
    )
    assert response.status_code == 201, response.data
    amendment_id = response.data["amendment_request"]["id"]

    with patch(
        "apps.hahitantsoa.services.generate_hahitantsoa_event_draft_document_instance_html",
        side_effect=DocumentRuntimeGenerationError(
            "Rendu impossible.", code="document_generation_failed"
        ),
    ):
        response = auth_client.post(
            f"/api/v1/hahitantsoa/event-drafts/{draft.id}/amendment-requests/{amendment_id}/apply/",
            format="json",
        )

    assert response.status_code == 400, response.data
    assert response.data["code"] == "document_generation_failed"
    draft.refresh_from_db()
    assert draft.guest_count == 200
    assert HahitantsoaEventDraftAmendmentRequest.objects.get(pk=amendment_id).status == "pending"


@pytest.mark.django_db
def test_titan_amendment_pdf_failure_is_controlled_and_rolls_back(auth_client, api_user):
    customer = Customer.objects.create(display_name="Client Titan PDF", created_by=api_user)
    item = InventoryItem.objects.create(
        name="Tente PDF", kind="material", rental_price=Decimal("500000.00"), created_by=api_user
    )
    start_at = timezone.now() + timedelta(days=10)
    end_at = start_at + timedelta(hours=8)
    draft = ReservationDraft.objects.create(
        customer=customer,
        start_at=start_at,
        end_at=end_at,
        status="confirmed",
        confirmed_at=timezone.now(),
        confirmed_by=api_user,
        subtotal_amount=Decimal("500000.00"),
        total_amount=Decimal("500000.00"),
        created_by=api_user,
    )
    ReservationDraftLine.objects.create(
        reservation_draft=draft,
        inventory_item=item,
        quantity=1,
        unit_rental_price=Decimal("500000.00"),
        created_by=api_user,
    )
    contract = create_document_instance_from_reservation_draft(
        reservation_draft=draft, template_key="titan.material_contract.v1", actor=api_user
    )
    contract = generate_reservation_draft_document_instance_html(
        reservation_draft=draft, document_instance_id=contract.id, actor=api_user
    )
    generate_document_instance_pdf(document_instance=contract, actor=api_user)

    with patch(
        "apps.reservations.amendments.generate_document_instance_pdf",
        side_effect=DocumentPDFGenerationError(
            "PDF indisponible.", code="pdf_generation_unavailable"
        ),
    ):
        response = auth_client.post(
            f"/api/v1/reservations/drafts/{draft.id}/amendments/",
            {
                "reason": "Changement de quantité",
                "changed_lines": [
                    {"inventory_item_id": str(item.id), "quantity": 2, "notes": "Deux tentes"}
                ],
            },
            format="json",
        )

    assert response.status_code == 400, response.data
    assert response.data["code"] == "pdf_generation_unavailable"
    line = ReservationDraftLine.objects.get(reservation_draft=draft, inventory_item=item)
    assert line.quantity == 1
