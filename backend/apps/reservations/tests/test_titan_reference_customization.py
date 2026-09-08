from datetime import timedelta
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from apps.customers.models import Customer
from apps.documents.models import DocumentInstance
from apps.inventory.models import InventoryItem
from apps.reservations.models import ReservationDraft, ReservationDraftLine

User = get_user_model()


@pytest.fixture
def auth_user():
    user = User.objects.create_user(
        username="commercial_agent",
        password="testpassword",
        is_staff=True,
    )
    user.roles = ["commercial"]
    user.save()
    return user


@pytest.fixture
def test_customer():
    return Customer.objects.create(
        party_type="individual",
        display_name="Alice Martin",
    )


@pytest.fixture
def test_item():
    return InventoryItem.objects.create(
        name="Chaise Napoléon Blanche",
        kind="material",
        rental_price=Decimal("5000.00"),
        is_active=True,
    )


@pytest.mark.django_db
def test_create_reservation_with_custom_public_reference(auth_user, test_customer, test_item):
    client = APIClient()
    client.force_authenticate(user=auth_user)

    start_at = (timezone.now() + timedelta(days=2)).isoformat()
    end_at = (timezone.now() + timedelta(days=4)).isoformat()

    payload = {
        "customer_id": str(test_customer.id),
        "public_reference": "042/2026",
        "start_at": start_at,
        "end_at": end_at,
        "lines": [
            {
                "inventory_item_id": str(test_item.id),
                "quantity": 10,
            }
        ],
    }

    resp = client.post("/api/v1/reservations/drafts/", payload, format="json")
    assert resp.status_code == 201, resp.content
    data = resp.json()
    assert data["public_reference"] == "042/2026"

    draft = ReservationDraft.objects.get(id=data["id"])
    assert draft.public_reference == "042/2026"

    # Verify initial proforma document instance has the custom reference
    proforma = DocumentInstance.objects.filter(
        reservation_draft=draft, document_type="proforma"
    ).first()
    assert proforma is not None
    assert proforma.reservation_public_reference == "042/2026"
    assert proforma.document_reference == "042/2026-PF"


@pytest.mark.django_db
def test_update_reservation_public_reference_and_cascade_documents(
    auth_user, test_customer, test_item
):
    start_at = timezone.now() + timedelta(days=2)
    end_at = timezone.now() + timedelta(days=4)

    draft = ReservationDraft.objects.create(
        customer=test_customer,
        public_reference="T-001/2026",
        start_at=start_at,
        end_at=end_at,
        created_by=auth_user,
    )
    ReservationDraftLine.objects.create(
        reservation_draft=draft,
        inventory_item=test_item,
        quantity=5,
        unit_rental_price=Decimal("5000.00"),
    )

    from apps.documents.services import create_document_instance_from_reservation_draft

    # Create proforma and contract document instances
    doc_pf = create_document_instance_from_reservation_draft(
        reservation_draft=draft,
        template_key="titan.proforma.v1",
        actor=auth_user,
    )
    doc_ct = create_document_instance_from_reservation_draft(
        reservation_draft=draft,
        template_key="titan.material_contract.v1",
        actor=auth_user,
    )

    assert doc_pf.reservation_public_reference == "T-001/2026"
    assert doc_pf.document_reference == "T-001/2026-PF"
    assert doc_ct.document_reference == "T-001/2026-CT"

    # Now update reference via API
    client = APIClient()
    client.force_authenticate(user=auth_user)

    resp = client.post(
        f"/api/v1/reservations/drafts/{draft.id}/update-reference/",
        {"public_reference": "099/2026"},
        format="json",
    )
    assert resp.status_code == 200, resp.content
    assert resp.json()["public_reference"] == "099/2026"

    # Reload draft & documents
    draft.refresh_from_db()
    assert draft.public_reference == "099/2026"

    doc_pf.refresh_from_db()
    assert doc_pf.reservation_public_reference == "099/2026"
    assert doc_pf.document_reference == "099/2026-PF"

    doc_ct.refresh_from_db()
    assert doc_ct.reservation_public_reference == "099/2026"
    assert doc_ct.document_reference == "099/2026-CT"


@pytest.mark.django_db
def test_update_reservation_reference_rejects_duplicate(auth_user, test_customer):
    start_at = timezone.now() + timedelta(days=2)
    end_at = timezone.now() + timedelta(days=4)

    ReservationDraft.objects.create(
        customer=test_customer,
        public_reference="T-100/2026",
        start_at=start_at,
        end_at=end_at,
    )

    draft2 = ReservationDraft.objects.create(
        customer=test_customer,
        public_reference="T-200/2026",
        start_at=start_at,
        end_at=end_at,
    )

    client = APIClient()
    client.force_authenticate(user=auth_user)

    resp = client.post(
        f"/api/v1/reservations/drafts/{draft2.id}/update-reference/",
        {"public_reference": "T-100/2026"},
        format="json",
    )
    assert resp.status_code == 400
    assert "déjà utilisée" in resp.json()["detail"]
