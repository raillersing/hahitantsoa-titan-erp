import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.common.sequences import (
    configure_numbering_sequence,
    generate_next_public_reference,
    get_or_create_numbering_sequence,
    peek_next_public_reference,
)

User = get_user_model()


@pytest.mark.django_db
def test_default_sequence_creation():
    seq_t = get_or_create_numbering_sequence(brand="titan", year=2026)
    assert seq_t.prefix == "T-"
    assert seq_t.next_number == 1
    assert seq_t.padding == 3
    assert seq_t.format_reference(1) == "T-001/2026"

    seq_h = get_or_create_numbering_sequence(brand="hahitantsoa", year=2026)
    assert seq_h.prefix == "H-"
    assert seq_h.next_number == 1
    assert seq_h.format_reference(1) == "H-001/2026"


@pytest.mark.django_db
def test_sequence_custom_start_number():
    configure_numbering_sequence(brand="titan", year=2026, next_number=100)
    assert peek_next_public_reference(brand="titan", year=2026) == "T-100/2026"

    ref1 = generate_next_public_reference(brand="titan", year=2026)
    assert ref1 == "T-100/2026"

    ref2 = generate_next_public_reference(brand="titan", year=2026)
    assert ref2 == "T-101/2026"

    ref3 = generate_next_public_reference(brand="titan", year=2026)
    assert ref3 == "T-102/2026"


@pytest.mark.django_db
def test_sequence_skips_existing_references():
    from datetime import timedelta

    from django.utils import timezone

    from apps.customers.models import Customer
    from apps.reservations.models import ReservationDraft

    customer = Customer.objects.create(
        party_type="individual",
        display_name="Jean Dupont",
    )
    start_at = timezone.now() + timedelta(days=1)
    end_at = timezone.now() + timedelta(days=3)

    # Manually create a draft with T-105/2026
    ReservationDraft.objects.create(
        customer=customer,
        public_reference="T-105/2026",
        start_at=start_at,
        end_at=end_at,
    )

    configure_numbering_sequence(brand="titan", year=2026, next_number=104)

    ref1 = generate_next_public_reference(brand="titan", year=2026)
    assert ref1 == "T-104/2026"

    # Should skip T-105/2026 since it exists and assign T-106/2026
    ref2 = generate_next_public_reference(brand="titan", year=2026)
    assert ref2 == "T-106/2026"


@pytest.mark.django_db
def test_numbering_sequence_api_endpoints():
    user = User.objects.create_user(
        username="manager",
        password="secretpassword",
        is_staff=True,
    )
    user.roles = ["manager"]
    user.save()

    client = APIClient()
    client.force_authenticate(user=user)

    # 1. GET list
    resp = client.get("/api/v1/numbering/sequences/")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 2

    # 2. Configure sequence
    post_data = {
        "brand": "titan",
        "year": 2026,
        "next_number": 500,
        "prefix": "LOC-",
    }
    resp = client.post("/api/v1/numbering/sequences/", post_data, format="json")
    assert resp.status_code == 200
    assert resp.json()["next_number"] == 500
    assert resp.json()["prefix"] == "LOC-"
    assert resp.json()["preview_next"] == "LOC-500/2026"

    # 3. Preview next endpoint
    resp = client.get("/api/v1/numbering/sequences/preview-next/?brand=titan&year=2026")
    assert resp.status_code == 200
    assert resp.json()["next_reference"] == "LOC-500/2026"
