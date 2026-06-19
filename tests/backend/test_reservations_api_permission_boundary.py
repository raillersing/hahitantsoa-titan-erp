from datetime import timedelta

import pytest
from django.contrib.auth.models import Group
from django.urls import reverse
from django.utils import timezone

from apps.customers.models import Customer
from apps.identity.roles import IdentityRole
from apps.inventory.models import InventoryItem
from apps.reservations.models import ReservationDraft, ReservationDraftLine

pytestmark = pytest.mark.django_db


@pytest.fixture
def authenticated_client(client, django_user_model):
    user = django_user_model.objects.create_user(
        username="reservation-api-boundary",
        password="test-password",
    )
    client.force_login(user)
    return client


def _period():
    start_at = timezone.now().replace(microsecond=0)
    return start_at, start_at + timedelta(hours=2)


def _query_params():
    start_at, end_at = _period()
    return {
        "start_at": start_at.isoformat(),
        "end_at": end_at.isoformat(),
    }


def _inventory_item() -> InventoryItem:
    return InventoryItem.objects.create(name="Boundary item", kind="material")


def _draft() -> ReservationDraft:
    start_at, end_at = _period()
    draft = ReservationDraft.objects.create(
        customer=Customer.objects.create(display_name="Boundary customer"),
        start_at=start_at,
        end_at=end_at,
    )
    ReservationDraftLine.objects.create(
        reservation_draft=draft,
        inventory_item=_inventory_item(),
        quantity=1,
    )
    return draft


@pytest.mark.parametrize(
    ("url", "data"),
    [
        ("/api/v1/reservations/availability-summary/", _query_params),
        ("/api/v1/reservations/available-item-previews/", _query_params),
        ("/api/v1/reservations/drafts/", lambda: None),
    ],
)
def test_reservations_api_rejects_unauthenticated_access(client, url, data) -> None:
    response = client.get(url, data=data() if callable(data) else data)

    assert response.status_code in {401, 403}


def test_reservation_item_preview_rejects_unauthenticated_access(client) -> None:
    item = _inventory_item()

    response = client.get(
        f"/api/v1/reservations/items/{item.id}/availability-preview/",
        data=_query_params(),
    )

    assert response.status_code in {401, 403}


@pytest.mark.parametrize(
    "method",
    ["post", "put", "patch", "delete"],
)
@pytest.mark.parametrize(
    "url_factory",
    [
        lambda: "/api/v1/reservations/availability-summary/",
        lambda: "/api/v1/reservations/available-item-previews/",
        lambda: f"/api/v1/reservations/items/{_inventory_item().id}/availability-preview/",
    ],
)
def test_read_only_reservation_endpoints_reject_write_methods(
    authenticated_client,
    method: str,
    url_factory,
) -> None:
    response = getattr(authenticated_client, method)(
        url_factory(),
        data=_query_params(),
    )

    assert response.status_code == 405


def test_lifecycle_write_routes_exist() -> None:
    expected_route_names = (
        "reservation-draft-confirm",
        "reservation-draft-cancel",
        "reservation-draft-mark-contract-signed",
        "reservation-draft-mark-required-deposit-received",
    )

    draft = _draft()

    for route_name in expected_route_names:
        assert reverse(route_name, kwargs={"pk": draft.id})

    assert "confirm" in reverse("reservation-draft-confirm", kwargs={"pk": draft.id})
    assert "cancel" in reverse("reservation-draft-cancel", kwargs={"pk": draft.id})
    assert "contract-signed" in reverse(
        "reservation-draft-mark-contract-signed",
        kwargs={"pk": draft.id},
    )
    assert "required-deposit-received" in reverse(
        "reservation-draft-mark-required-deposit-received",
        kwargs={"pk": draft.id},
    )


@pytest.mark.parametrize(
    "route_name",
    (
        "reservation-draft-confirm",
        "reservation-draft-cancel",
        "reservation-draft-mark-contract-signed",
        "reservation-draft-mark-required-deposit-received",
    ),
)
def test_lifecycle_write_routes_reject_unauthenticated_access(client, route_name: str) -> None:
    draft = _draft()

    response = client.post(reverse(route_name, kwargs={"pk": draft.id}))

    assert response.status_code in {401, 403}


@pytest.mark.parametrize(
    "route_name",
    (
        "reservation-draft-confirm",
        "reservation-draft-cancel",
        "reservation-draft-mark-contract-signed",
        "reservation-draft-mark-required-deposit-received",
    ),
)
def test_lifecycle_write_routes_reject_non_staff_authenticated_user(
    authenticated_client,
    route_name: str,
) -> None:
    draft = _draft()

    response = authenticated_client.post(reverse(route_name, kwargs={"pk": draft.id}))

    assert response.status_code == 403


@pytest.mark.parametrize(
    "route_name",
    (
        "reservation-draft-confirm",
        "reservation-draft-cancel",
        "reservation-draft-mark-contract-signed",
        "reservation-draft-mark-required-deposit-received",
    ),
)
def test_lifecycle_write_routes_allow_group_mapped_operator(
    client,
    django_user_model,
    route_name: str,
) -> None:
    user = django_user_model.objects.create_user(
        username=f"mapped-{route_name}",
        password="test-password",
        is_staff=False,
    )
    user.groups.add(Group.objects.create(name=IdentityRole.RESERVATION_SENSITIVE_OPERATOR.value))
    draft = _draft()

    client.force_login(user)
    response = client.post(reverse(route_name, kwargs={"pk": draft.id}))

    assert response.status_code != 403
