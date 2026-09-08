from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from apps.customers.models import Customer
from apps.documents.models import DocumentInstance
from apps.hahitantsoa.models import HahitantsoaEventDraft

User = get_user_model()


@pytest.fixture
def auth_user():
    user = User.objects.create_user(
        username="hah_commercial",
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
        display_name="Paul Rasoa",
    )


@pytest.mark.django_db
def test_create_hahitantsoa_event_with_custom_public_reference(auth_user, test_customer):
    client = APIClient()
    client.force_authenticate(user=auth_user)

    start_at = (timezone.now() + timedelta(days=10)).isoformat()
    end_at = (timezone.now() + timedelta(days=11)).isoformat()

    payload = {
        "customer_id": str(test_customer.id),
        "public_reference": "H-555/2026",
        "event_name": "Mariage Paul & Soa",
        "event_type": "wedding",
        "rental_type": "bare",
        "guest_count": 200,
        "start_at": start_at,
        "end_at": end_at,
        "lines": [],
    }

    resp = client.post("/api/v1/hahitantsoa/event-drafts/", payload, format="json")
    assert resp.status_code == 201, resp.content
    data = resp.json()
    assert data["public_reference"] == "H-555/2026"

    event = HahitantsoaEventDraft.objects.get(id=data["id"])
    assert event.public_reference == "H-555/2026"

    # Verify initial proforma document instance has the custom reference
    proforma = DocumentInstance.objects.filter(
        hahitantsoa_event_draft=event, document_type="proforma"
    ).first()
    assert proforma is not None
    assert proforma.reservation_public_reference == "H-555/2026"
    assert proforma.document_reference == "H-555/2026-PF"


@pytest.mark.django_db
def test_update_hahitantsoa_public_reference_and_cascade_documents(auth_user, test_customer):
    start_at = timezone.now() + timedelta(days=10)
    end_at = timezone.now() + timedelta(days=11)

    event = HahitantsoaEventDraft.objects.create(
        customer=test_customer,
        public_reference="H-001/2026",
        event_name="Mariage Test",
        start_at=start_at,
        end_at=end_at,
        created_by=auth_user,
    )

    from apps.documents.services import create_document_instance_from_hahitantsoa_event_draft

    doc_pf = create_document_instance_from_hahitantsoa_event_draft(
        event_draft=event,
        template_key="hahitantsoa.proforma.v1",
        actor=auth_user,
    )

    assert doc_pf.reservation_public_reference == "H-001/2026"
    assert doc_pf.document_reference == "H-001/2026-PF"

    # Update reference via API
    client = APIClient()
    client.force_authenticate(user=auth_user)

    resp = client.post(
        f"/api/v1/hahitantsoa/event-drafts/{event.id}/update-reference/",
        {"public_reference": "H-777/2026"},
        format="json",
    )
    assert resp.status_code == 200, resp.content
    assert resp.json()["public_reference"] == "H-777/2026"

    event.refresh_from_db()
    assert event.public_reference == "H-777/2026"

    doc_pf.refresh_from_db()
    assert doc_pf.reservation_public_reference == "H-777/2026"
    assert doc_pf.document_reference == "H-777/2026-PF"


@pytest.mark.django_db
def test_update_hahitantsoa_reference_rejects_duplicate(auth_user, test_customer):
    start_at = timezone.now() + timedelta(days=10)
    end_at = timezone.now() + timedelta(days=11)

    HahitantsoaEventDraft.objects.create(
        customer=test_customer,
        public_reference="H-100/2026",
        start_at=start_at,
        end_at=end_at,
    )

    event2 = HahitantsoaEventDraft.objects.create(
        customer=test_customer,
        public_reference="H-200/2026",
        start_at=start_at,
        end_at=end_at,
        created_by=auth_user,
    )

    client = APIClient()
    client.force_authenticate(user=auth_user)

    resp = client.post(
        f"/api/v1/hahitantsoa/event-drafts/{event2.id}/update-reference/",
        {"public_reference": "H-100/2026"},
        format="json",
    )
    assert resp.status_code == 400
    assert "déjà utilisée" in resp.json()["detail"]
