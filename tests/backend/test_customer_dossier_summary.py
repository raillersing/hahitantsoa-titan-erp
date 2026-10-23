"""Customer dossier counters follow persisted lifecycle evidence across both domains."""

from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.customers.models import Customer, CustomerContactPoint
from apps.customers.selectors import active_customers
from apps.customers.serializers import CustomerSerializer
from apps.documents.models import DocumentInstance
from apps.hahitantsoa.models import HahitantsoaEventCloseout, HahitantsoaEventDraft
from apps.reservations.models import ReservationCloseout, ReservationDraft

pytestmark = pytest.mark.django_db

COUNTERS = (
    "current_dossier_count",
    "closed_dossier_count",
    "draft_dossier_count",
    "cancelled_dossier_count",
)


@pytest.fixture
def reader(django_user_model):
    user = django_user_model.objects.create_user(username="customer-summary-reader")
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _dossier(customer, actor, domain, category, *, deleted=False, past=False):
    model = ReservationDraft if domain == "titan" else HahitantsoaEventDraft
    start = timezone.now() + timedelta(days=-30 if past else 30)
    draft = model.objects.create(
        customer=customer,
        created_by=actor,
        status="confirmed" if category in {"current", "closed"} else category,
        start_at=start,
        end_at=start + timedelta(hours=4),
        is_deleted=deleted,
        deleted_at=timezone.now() if deleted else None,
    )
    if category == "closed":
        closeout_model = ReservationCloseout if domain == "titan" else HahitantsoaEventCloseout
        relation = {"reservation_draft" if domain == "titan" else "event_draft": draft}
        closeout_model.objects.create(**relation, closed_at=timezone.now(), closed_by=actor)
    return draft


def test_list_and_detail_use_actual_closeout_not_dates_or_actor_ownership(
    reader, django_user_model
):
    owner = django_user_model.objects.create_user(username="other-dossier-owner")
    customer = Customer.objects.create(display_name="Dossiers mixtes")
    for domain in ("titan", "hahitantsoa"):
        for category in ("current", "closed", "draft", "cancelled"):
            _dossier(customer, owner, domain, category)
            _dossier(customer, owner, domain, category, deleted=True)
        _dossier(customer, owner, domain, "current", past=True)
    for index in range(3):
        DocumentInstance.objects.create(
            customer=customer, template_key=f"test-document-{index}", business_scope="titan"
        )
    for index in range(2):
        CustomerContactPoint.objects.create(
            customer=customer, kind="phone", value=f"034000000{index}"
        )
    other = Customer.objects.create(display_name="Autre client")
    _dossier(other, owner, "hahitantsoa", "draft")

    listing = reader.get("/api/v1/customers/")
    detail = reader.get(f"/api/v1/customers/{customer.pk}/")
    assert listing.status_code == detail.status_code == 200
    row = next(row for row in listing.data if row["id"] == str(customer.pk))
    expected = dict(zip(COUNTERS, (4, 2, 2, 2), strict=True))
    for payload in (row, detail.data):
        assert {field: payload[field] for field in COUNTERS} == expected
        assert payload["reservation_count"] == 5
        assert payload["event_count"] == 5
        assert payload["document_count"] == 3
    other_row = next(row for row in listing.data if row["id"] == str(other.pk))
    assert other_row["draft_dossier_count"] == 1
    assert other_row["current_dossier_count"] == 0


def test_customer_without_dossiers_has_zero_counters_in_list_detail_and_unannotated_serializer(
    reader,
):
    customer = Customer.objects.create(display_name="Aucun dossier")
    listing = reader.get("/api/v1/customers/")
    detail = reader.get(f"/api/v1/customers/{customer.pk}/")
    assert listing.status_code == detail.status_code == 200
    for payload in (listing.data[0], detail.data, CustomerSerializer(customer).data):
        assert {field: payload[field] for field in COUNTERS} == dict.fromkeys(COUNTERS, 0)


def test_summary_serializer_has_constant_query_count(django_assert_num_queries, django_user_model):
    owner = django_user_model.objects.create_user(username="summary-query-owner")
    for index in range(5):
        customer = Customer.objects.create(display_name=f"Client {index}")
        _dossier(customer, owner, "titan", "current")
        _dossier(customer, owner, "hahitantsoa", "closed")
        CustomerContactPoint.objects.create(customer=customer, kind="phone", value="0340000000")
    with django_assert_num_queries(2):
        data = CustomerSerializer(active_customers(), many=True).data
        assert len(data) == 5
        assert all(row["current_dossier_count"] == row["closed_dossier_count"] == 1 for row in data)


def test_derived_summary_fields_are_read_only():
    serializer = CustomerSerializer(
        data={"display_name": "Compteurs protégés", **dict.fromkeys(COUNTERS, 99)}
    )
    assert serializer.is_valid(), serializer.errors
    assert not set(COUNTERS).intersection(serializer.validated_data)
