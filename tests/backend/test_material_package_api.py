"""Tests for the material package API endpoints.

Covers list, create, retrieve, update, and delete (soft-delete) operations on
material packages, plus unauthenticated access denial.
"""

from __future__ import annotations

from decimal import Decimal

import pytest

from apps.inventory.models import InventoryItem
from apps.material_package.models import MaterialPackage, MaterialPackageLine
from apps.material_package.services import save_material_package

pytestmark = pytest.mark.django_db

MATERIAL_PACKAGE_LIST_URL = "/api/v1/material-packages/"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def authenticated_client(client, django_user_model):
    user = django_user_model.objects.create_user(
        username="material-package-tester",
        password="test-password",
        is_staff=True,
    )
    client.force_login(user)
    return client


@pytest.fixture
def regular_authenticated_client(client, django_user_model):
    user = django_user_model.objects.create_user(
        username="regular-material-package-user", password="test-password"
    )
    client.force_login(user)
    return client


def _create_package(
    name: str,
    *,
    description: str = "",
    price: Decimal | float | str = Decimal("0.00"),
    is_active: bool = True,
) -> MaterialPackage:
    return MaterialPackage.objects.create(
        name=name,
        description=description,
        price=price,
        is_active=is_active,
    )


# ---------------------------------------------------------------------------
# Unauthenticated access
# ---------------------------------------------------------------------------


def test_unauthenticated_list_returns_403(client):
    response = client.get(MATERIAL_PACKAGE_LIST_URL)
    assert response.status_code == 403


def test_unauthenticated_create_returns_403(client):
    response = client.post(
        MATERIAL_PACKAGE_LIST_URL,
        {"name": "Test Package"},
        content_type="application/json",
    )
    assert response.status_code == 403


def test_unauthenticated_detail_returns_403(client):
    pkg = _create_package("Detail Package")
    response = client.get(f"{MATERIAL_PACKAGE_LIST_URL}{pkg.id}/")
    assert response.status_code == 403


def test_unauthenticated_update_returns_403(client):
    pkg = _create_package("Update Package")
    response = client.put(
        f"{MATERIAL_PACKAGE_LIST_URL}{pkg.id}/",
        {"name": "Updated"},
        content_type="application/json",
    )
    assert response.status_code == 403


def test_unauthenticated_delete_returns_403(client):
    pkg = _create_package("Delete Package")
    response = client.delete(f"{MATERIAL_PACKAGE_LIST_URL}{pkg.id}/")
    assert response.status_code == 403


@pytest.mark.parametrize("method", ["post", "patch", "delete"])
def test_regular_authenticated_user_cannot_mutate_packages(regular_authenticated_client, method):
    package = _create_package("Protected Package")
    if method == "post":
        response = regular_authenticated_client.post(
            MATERIAL_PACKAGE_LIST_URL, {"name": "Not allowed"}, content_type="application/json"
        )
    elif method == "patch":
        response = regular_authenticated_client.patch(
            f"{MATERIAL_PACKAGE_LIST_URL}{package.id}/",
            {"name": "Not allowed"},
            content_type="application/json",
        )
    else:
        response = regular_authenticated_client.delete(f"{MATERIAL_PACKAGE_LIST_URL}{package.id}/")
    assert response.status_code == 403


# ---------------------------------------------------------------------------
# List — only active packages
# ---------------------------------------------------------------------------


def test_list_returns_only_active_packages(authenticated_client):
    active = _create_package("Active Package")
    _create_package("Inactive Package", is_active=False)

    response = authenticated_client.get(MATERIAL_PACKAGE_LIST_URL)
    assert response.status_code == 200

    payload = response.json()
    assert len(payload) == 1
    assert payload[0]["id"] == str(active.id)
    assert payload[0]["name"] == "Active Package"
    assert payload[0]["is_active"] is True


def test_list_include_inactive_returns_both_active_and_inactive_packages(authenticated_client):
    active = _create_package("Active Package")
    inactive = _create_package("Inactive Package", is_active=False)

    response = authenticated_client.get(f"{MATERIAL_PACKAGE_LIST_URL}?include_inactive=true")
    assert response.status_code == 200

    payload = response.json()
    assert len(payload) == 2
    ids = {p["id"] for p in payload}
    assert ids == {str(active.id), str(inactive.id)}


def test_list_filter_is_active_returns_filtered_packages(authenticated_client):
    active = _create_package("Active Package")
    inactive = _create_package("Inactive Package", is_active=False)

    # is_active=false returns only inactive packages
    response_inactive = authenticated_client.get(f"{MATERIAL_PACKAGE_LIST_URL}?is_active=false")
    assert response_inactive.status_code == 200
    payload_inactive = response_inactive.json()
    assert len(payload_inactive) == 1
    assert payload_inactive[0]["id"] == str(inactive.id)
    assert payload_inactive[0]["is_active"] is False

    # is_active=true returns only active packages
    response_active = authenticated_client.get(f"{MATERIAL_PACKAGE_LIST_URL}?is_active=true")
    assert response_active.status_code == 200
    payload_active = response_active.json()
    assert len(payload_active) == 1
    assert payload_active[0]["id"] == str(active.id)
    assert payload_active[0]["is_active"] is True


def test_list_returns_empty_when_no_active_packages(authenticated_client):
    _create_package("Gone Package", is_active=False)

    response = authenticated_client.get(MATERIAL_PACKAGE_LIST_URL)
    assert response.status_code == 200
    assert response.json() == []


def test_list_returns_multiple_active_packages_ordered_by_name(authenticated_client):
    _create_package("Zoe Kit")
    _create_package("Alpha Bundle")
    _create_package("Midrange Set")

    response = authenticated_client.get(MATERIAL_PACKAGE_LIST_URL)
    assert response.status_code == 200

    names = [item["name"] for item in response.json()]
    assert names == ["Alpha Bundle", "Midrange Set", "Zoe Kit"]


def test_list_includes_lines_in_response(authenticated_client):
    """List serializer nests lines (empty by default)."""
    pkg = _create_package("With Lines")

    response = authenticated_client.get(MATERIAL_PACKAGE_LIST_URL)
    assert response.status_code == 200

    data = response.json()[0]
    assert data["id"] == str(pkg.id)
    assert "lines" in data
    assert isinstance(data["lines"], list)


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------


def test_create_package(authenticated_client):
    payload = {
        "name": "New Package",
        "description": "A test bundle",
        "price": "250.00",
    }
    response = authenticated_client.post(
        MATERIAL_PACKAGE_LIST_URL, payload, content_type="application/json"
    )
    assert response.status_code == 201

    data = response.json()
    assert data["name"] == "New Package"
    assert data["description"] == "A test bundle"
    assert Decimal(data["price"]) == Decimal("250.00")
    assert data["is_active"] is True
    assert "id" in data

    assert MaterialPackage.objects.filter(name="New Package").exists()


def test_create_package_default_values(authenticated_client):
    response = authenticated_client.post(
        MATERIAL_PACKAGE_LIST_URL,
        {"name": "Minimal Package"},
        content_type="application/json",
    )
    assert response.status_code == 201
    data = response.json()
    assert data["description"] == ""
    assert Decimal(data["price"]) == Decimal("0.00")
    assert data["image_url"] == ""
    assert data["is_active"] is True


def test_create_and_retrieve_package_with_image_url(authenticated_client):
    data_url = "data:image/png;base64," + ("B" * 1500)
    payload = {
        "name": "Pack avec photo",
        "description": "Pack complet avec image",
        "price": "450000.00",
        "image_url": data_url,
    }
    response = authenticated_client.post(
        MATERIAL_PACKAGE_LIST_URL, payload, content_type="application/json"
    )
    assert response.status_code == 201
    pkg_id = response.json()["id"]

    # Verify detail retrieval
    get_res = authenticated_client.get(f"{MATERIAL_PACKAGE_LIST_URL}{pkg_id}/")
    assert get_res.status_code == 200
    assert get_res.json()["image_url"] == data_url


@pytest.mark.parametrize(
    "image_url",
    [
        "/brand/packages/ceremonie.webp",
        "https://cdn.example.test/packages/ceremonie.webp",
        "data:image/svg+xml;base64,PHN2Zy8+",
    ],
)
def test_create_package_preserves_supported_image_forms(authenticated_client, image_url):
    response = authenticated_client.post(
        MATERIAL_PACKAGE_LIST_URL,
        {"name": "Pack image compatible", "image_url": image_url},
        content_type="application/json",
    )
    assert response.status_code == 201
    assert response.json()["image_url"] == image_url


@pytest.mark.parametrize(
    "image_url", ["javascript:alert(1)", "data:text/html;base64,PGgxPk5vPC9oMT4="]
)
def test_create_package_rejects_unsupported_image_url(authenticated_client, image_url):
    response = authenticated_client.post(
        MATERIAL_PACKAGE_LIST_URL,
        {"name": "Pack image invalide", "image_url": image_url},
        content_type="application/json",
    )
    assert response.status_code == 400


def test_create_package_missing_name_returns_400(authenticated_client):
    response = authenticated_client.post(
        MATERIAL_PACKAGE_LIST_URL,
        {"description": "No name"},
        content_type="application/json",
    )
    assert response.status_code == 400


# ---------------------------------------------------------------------------
# Retrieve detail
# ---------------------------------------------------------------------------


def test_retrieve_package_detail(authenticated_client):
    pkg = _create_package("Detail Package", description="Some desc", price="99.50")

    response = authenticated_client.get(f"{MATERIAL_PACKAGE_LIST_URL}{pkg.id}/")
    assert response.status_code == 200

    data = response.json()
    assert data["id"] == str(pkg.id)
    assert data["name"] == "Detail Package"
    assert data["description"] == "Some desc"
    assert Decimal(data["price"]) == Decimal("99.50")
    assert data["is_active"] is True
    assert "lines" in data
    assert isinstance(data["lines"], list)
    assert "created_at" in data
    assert "updated_at" in data


def test_retrieve_inactive_package_detail(authenticated_client):
    pkg = _create_package("Inactive Package", is_active=False)

    response = authenticated_client.get(f"{MATERIAL_PACKAGE_LIST_URL}{pkg.id}/")
    assert response.status_code == 200
    assert response.json()["is_active"] is False


def test_retrieve_nonexistent_returns_404(authenticated_client):
    from uuid import uuid4

    response = authenticated_client.get(f"{MATERIAL_PACKAGE_LIST_URL}{uuid4()}/")
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------


def test_update_package_name(authenticated_client):
    pkg = _create_package("Old Name")

    response = authenticated_client.patch(
        f"{MATERIAL_PACKAGE_LIST_URL}{pkg.id}/",
        {"name": "Updated Name"},
        content_type="application/json",
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Updated Name"

    pkg.refresh_from_db()
    assert pkg.name == "Updated Name"


def test_update_package_price(authenticated_client):
    pkg = _create_package("Price Package", price="100.00")

    response = authenticated_client.put(
        f"{MATERIAL_PACKAGE_LIST_URL}{pkg.id}/",
        {"name": "Price Package", "price": "199.99"},
        content_type="application/json",
    )
    assert response.status_code == 200
    assert Decimal(response.json()["price"]) == Decimal("199.99")

    pkg.refresh_from_db()
    assert pkg.price == Decimal("199.99")


def test_update_package_description(authenticated_client):
    pkg = _create_package("Desc Package", description="Old")

    response = authenticated_client.patch(
        f"{MATERIAL_PACKAGE_LIST_URL}{pkg.id}/",
        {"description": "New description"},
        content_type="application/json",
    )
    assert response.status_code == 200
    assert response.json()["description"] == "New description"


def test_update_nonexistent_returns_404(authenticated_client):
    from uuid import uuid4

    response = authenticated_client.put(
        f"{MATERIAL_PACKAGE_LIST_URL}{uuid4()}/",
        {"name": "Ghost"},
        content_type="application/json",
    )
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# Delete (soft-delete)
# ---------------------------------------------------------------------------


def test_delete_package_soft_deletes(authenticated_client):
    pkg = _create_package("Delete Me", is_active=True)

    response = authenticated_client.delete(f"{MATERIAL_PACKAGE_LIST_URL}{pkg.id}/")
    assert response.status_code == 204

    pkg.refresh_from_db()
    assert pkg.is_active is False

    # Should no longer appear in list
    list_response = authenticated_client.get(MATERIAL_PACKAGE_LIST_URL)
    assert len(list_response.json()) == 0


def test_delete_package_still_accessible_via_detail(authenticated_client):
    pkg = _create_package("Soft Deleted")

    delete_response = authenticated_client.delete(f"{MATERIAL_PACKAGE_LIST_URL}{pkg.id}/")
    assert delete_response.status_code == 204

    detail_response = authenticated_client.get(f"{MATERIAL_PACKAGE_LIST_URL}{pkg.id}/")
    assert detail_response.status_code == 200
    assert detail_response.json()["is_active"] is False


def test_delete_nonexistent_returns_404(authenticated_client):
    from uuid import uuid4

    response = authenticated_client.delete(f"{MATERIAL_PACKAGE_LIST_URL}{uuid4()}/")
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# Lot 4A / R3: Composition Constraints & Validation
# ---------------------------------------------------------------------------


def test_create_package_with_valid_composition(authenticated_client):
    item1 = InventoryItem.objects.create(name="Table ronde 150cm", kind="material")
    item2 = InventoryItem.objects.create(name="Chaise Napoléon", kind="material")

    payload = {
        "name": "Pack Banquet",
        "description": "Tables et chaises",
        "price": "500000.00",
        "lines": [
            {"inventory_item": str(item1.id), "quantity": 5},
            {"inventory_item": str(item2.id), "quantity": 40},
        ],
    }
    response = authenticated_client.post(
        MATERIAL_PACKAGE_LIST_URL, payload, content_type="application/json"
    )
    assert response.status_code == 201
    data = response.json()
    assert len(data["lines"]) == 2
    assert {line["inventory_item"] for line in data["lines"]} == {str(item1.id), str(item2.id)}


def test_create_package_rejects_duplicate_items_in_composition(authenticated_client):
    item = InventoryItem.objects.create(name="Chaise Chiavari", kind="material")

    payload = {
        "name": "Pack Doublon",
        "lines": [
            {"inventory_item": str(item.id), "quantity": 10},
            {"inventory_item": str(item.id), "quantity": 5},
        ],
    }
    response = authenticated_client.post(
        MATERIAL_PACKAGE_LIST_URL, payload, content_type="application/json"
    )
    assert response.status_code == 400
    assert "lines" in response.json()


def test_create_package_rejects_nonpositive_quantity(authenticated_client):
    item = InventoryItem.objects.create(name="Nappe blanche", kind="material")

    payload = {
        "name": "Pack Quantité Nulle",
        "lines": [
            {"inventory_item": str(item.id), "quantity": 0},
        ],
    }
    response = authenticated_client.post(
        MATERIAL_PACKAGE_LIST_URL, payload, content_type="application/json"
    )
    assert response.status_code == 400


def test_create_package_rejects_inactive_item(authenticated_client):
    item = InventoryItem.objects.create(name="Article Déclassé", kind="material", is_active=False)

    payload = {
        "name": "Pack Article Inactif",
        "lines": [
            {"inventory_item": str(item.id), "quantity": 2},
        ],
    }
    response = authenticated_client.post(
        MATERIAL_PACKAGE_LIST_URL, payload, content_type="application/json"
    )
    assert response.status_code == 400


@pytest.mark.parametrize("change", [{"description": "Historique corrigé"}, {"is_active": False}])
def test_maintain_historical_composition_with_inactive_item(authenticated_client, change):
    item = InventoryItem.objects.create(name="Chaise retirée", kind="material", is_active=False)
    package = _create_package("Ancien pack")
    line = MaterialPackageLine.objects.create(package=package, inventory_item=item, quantity=3)

    response = authenticated_client.patch(
        f"{MATERIAL_PACKAGE_LIST_URL}{package.id}/", change, content_type="application/json"
    )

    assert response.status_code == 200
    package.refresh_from_db()
    line.refresh_from_db()
    assert package.description == change.get("description", "")
    assert package.is_active is change.get("is_active", True)
    assert line.inventory_item_id == item.pk
    assert line.quantity == 3


def test_reactivate_historical_composition_rejects_inactive_item(authenticated_client):
    item = InventoryItem.objects.create(name="Ancien article", kind="material", is_active=False)
    package = _create_package("Pack inactif", is_active=False)
    line = MaterialPackageLine.objects.create(package=package, inventory_item=item, quantity=2)

    response = authenticated_client.patch(
        f"{MATERIAL_PACKAGE_LIST_URL}{package.id}/",
        {"is_active": True, "name": "Ne doit pas changer"},
        content_type="application/json",
    )

    assert response.status_code == 400
    package.refresh_from_db()
    assert package.is_active is False
    assert package.name == "Pack inactif"
    assert package.lines.get().pk == line.pk


@pytest.mark.parametrize("method", ["post", "patch"])
def test_composition_quantity_defaults_to_one(authenticated_client, method):
    item = InventoryItem.objects.create(name="Article à l'unité", kind="material")
    url = MATERIAL_PACKAGE_LIST_URL
    payload = {"name": "Pack quantité implicite", "lines": [{"inventory_item": str(item.pk)}]}
    if method == "patch":
        package = _create_package("Pack existant")
        url += f"{package.pk}/"

    response = getattr(authenticated_client, method)(url, payload, content_type="application/json")

    assert response.status_code == (201 if method == "post" else 200)
    assert response.json()["lines"][0]["quantity"] == 1


@pytest.mark.parametrize("kind", ["deleted", "missing"])
def test_composition_rejects_deleted_or_missing_reference(authenticated_client, kind):
    from uuid import uuid4

    item_id = uuid4()
    if kind == "deleted":
        item_id = InventoryItem.objects.create(
            name="Supprimé", kind="material", is_active=True, is_deleted=True
        ).pk

    response = authenticated_client.post(
        MATERIAL_PACKAGE_LIST_URL,
        {"name": "Pack invalide", "lines": [{"inventory_item": str(item_id), "quantity": 1}]},
        content_type="application/json",
    )

    assert response.status_code == 400
    assert not MaterialPackage.objects.filter(name="Pack invalide").exists()


def test_replace_composition_rolls_back_attributes_and_lines_on_write_failure(
    authenticated_client, monkeypatch
):
    item = InventoryItem.objects.create(name="Article conservé", kind="material")
    replacement = InventoryItem.objects.create(name="Article nouveau", kind="article")
    package = _create_package("Pack conservé")
    original = MaterialPackageLine.objects.create(package=package, inventory_item=item, quantity=4)

    def fail_after_delete(*args, **kwargs):
        raise RuntimeError("Synthetic composition write failure")

    monkeypatch.setattr(MaterialPackageLine.objects, "bulk_create", fail_after_delete)
    with pytest.raises(RuntimeError, match="Synthetic composition write failure"):
        authenticated_client.patch(
            f"{MATERIAL_PACKAGE_LIST_URL}{package.pk}/",
            {
                "name": "Ne doit pas persister",
                "lines": [{"inventory_item": str(replacement.pk), "quantity": 2}],
            },
            content_type="application/json",
        )

    package.refresh_from_db()
    assert package.name == "Pack conservé"
    assert package.lines.get().pk == original.pk
    assert package.lines.get().quantity == 4


def test_package_write_attributes_actor(authenticated_client, django_user_model):
    actor = django_user_model.objects.get(username="material-package-tester")
    response = authenticated_client.post(
        MATERIAL_PACKAGE_LIST_URL, {"name": "Pack attribué"}, content_type="application/json"
    )
    assert response.status_code == 201
    package = MaterialPackage.objects.get(pk=response.json()["id"])
    assert package.created_by_id == actor.pk
    assert package.updated_by_id == actor.pk

    package.updated_by = None
    package.save(update_fields=["updated_by"])
    response = authenticated_client.patch(
        f"{MATERIAL_PACKAGE_LIST_URL}{package.pk}/",
        {"description": "Modification attribuée"},
        content_type="application/json",
    )
    assert response.status_code == 200
    package.refresh_from_db()
    assert package.updated_by_id == actor.pk
    assert package.created_by_id == actor.pk


@pytest.mark.parametrize("quantity", [0, -1, True])
def test_package_service_enforces_positive_integer_quantity(quantity):
    from rest_framework.exceptions import ValidationError

    item = InventoryItem.objects.create(name="Article direct", kind="material")
    with pytest.raises(ValidationError):
        save_material_package(
            attributes={"name": "Pack service invalide"},
            lines=[{"inventory_item": item, "quantity": quantity}],
        )
    assert not MaterialPackage.objects.filter(name="Pack service invalide").exists()


def test_package_service_revalidates_inventory_after_serializer_check():
    from rest_framework.exceptions import ValidationError

    from apps.material_package.serializers import MaterialPackageCreateSerializer

    item = InventoryItem.objects.create(name="Article devenu inactif", kind="material")
    serializer = MaterialPackageCreateSerializer(
        data={"name": "Pack concurrent", "lines": [{"inventory_item": str(item.pk)}]}
    )
    assert serializer.is_valid(), serializer.errors
    InventoryItem.objects.filter(pk=item.pk).update(is_active=False)

    with pytest.raises(ValidationError):
        serializer.save()
    assert not MaterialPackage.objects.filter(name="Pack concurrent").exists()


def test_package_service_rejects_duplicate_composition():
    from rest_framework.exceptions import ValidationError

    item = InventoryItem.objects.create(name="Article en double", kind="material")
    with pytest.raises(ValidationError):
        save_material_package(
            attributes={"name": "Doublon direct"},
            lines=[{"inventory_item": item, "quantity": 1}] * 2,
        )
    assert not MaterialPackage.objects.filter(name="Doublon direct").exists()


def test_reactivate_package_after_inventory_reference_is_restored(authenticated_client):
    item = InventoryItem.objects.create(name="Article rétabli", kind="material")
    package = _create_package("Pack à réactiver", is_active=False)
    line = MaterialPackageLine.objects.create(package=package, inventory_item=item, quantity=2)

    response = authenticated_client.patch(
        f"{MATERIAL_PACKAGE_LIST_URL}{package.pk}/",
        {"is_active": True},
        content_type="application/json",
    )

    assert response.status_code == 200
    package.refresh_from_db()
    assert package.is_active is True
    assert package.lines.get().pk == line.pk


@pytest.mark.parametrize("violation", ["quantity", "duplicate"])
def test_composition_database_constraints(violation):
    from django.db import IntegrityError, transaction

    item = InventoryItem.objects.create(name="Article contraint", kind="material")
    package = _create_package("Pack contraint")
    MaterialPackageLine.objects.create(package=package, inventory_item=item, quantity=1)

    with pytest.raises(IntegrityError), transaction.atomic():
        MaterialPackageLine.objects.create(
            package=package,
            inventory_item=(
                item
                if violation == "duplicate"
                else InventoryItem.objects.create(name="Autre article", kind="article")
            ),
            quantity=0 if violation == "quantity" else 1,
        )
    assert package.lines.count() == 1


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("violation", ["quantity", "duplicate"])
def test_composition_migration_rejects_invalid_history_without_modifying_it(violation):
    from django.db import connection
    from django.db.migrations.executor import MigrationExecutor

    old_target = ("material_package", "0002_add_materialpackage_image_url")
    new_target = ("material_package", "0003_composition_constraints")
    executor = MigrationExecutor(connection)
    executor.migrate([old_target])
    state = executor.loader.project_state([old_target]).apps
    HistoricalLine = state.get_model("material_package", "MaterialPackageLine")
    package = _create_package("Historique à examiner")
    item = InventoryItem.objects.create(name="Article historique", kind="material")
    try:
        HistoricalLine.objects.create(
            package_id=package.pk,
            inventory_item_id=item.pk,
            quantity=0 if violation == "quantity" else 1,
        )
        if violation == "duplicate":
            HistoricalLine.objects.create(
                package_id=package.pk, inventory_item_id=item.pk, quantity=2
            )
        before = list(
            HistoricalLine.objects.filter(package_id=package.pk)
            .order_by("pk")
            .values_list("id", "inventory_item_id", "quantity")
        )

        with pytest.raises(RuntimeError, match="No historical composition has been modified"):
            MigrationExecutor(connection).migrate([new_target])

        after = list(
            HistoricalLine.objects.filter(package_id=package.pk)
            .order_by("pk")
            .values_list("id", "inventory_item_id", "quantity")
        )
        assert after == before
    finally:
        # Only disposable records created by this test are removed to restore the
        # schema for subsequent tests; the migration itself never repairs rows.
        HistoricalLine.objects.filter(package_id=package.pk).delete()
        MigrationExecutor(connection).migrate([new_target])
