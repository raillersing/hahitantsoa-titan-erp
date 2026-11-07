from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from io import StringIO
from threading import Barrier
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.db import close_old_connections, connection
from django.test import Client
from django.utils import timezone

from apps.customers.models import Customer
from apps.hahitantsoa.models import HahitantsoaEventDraft
from apps.identity.models import ApplicationRole, UserRoleAssignment
from apps.inventory.models import (
    InventoryAvailability,
    InventoryItem,
    InventoryReturnOperation,
    InventoryReturnOperationLine,
    InventoryStockAlert,
    InventoryStockMovement,
)
from apps.inventory.serializers import InventoryItemSerializer
from apps.inventory.services import create_inventory_stock_movement, save_inventory_catalog_item
from apps.inventory.stock_alerts import reconcile_inventory_stock_alerts
from apps.inventory.stock_selectors import inventory_stock_summaries
from apps.notifications.models import SystemNotification
from apps.reservations.models import ReservationDraft

pytestmark = pytest.mark.django_db


def item(**kwargs):
    return InventoryItem.objects.create(
        **({"name": "Chaise", "kind": "material", "reported_inventory_quantity": 10} | kwargs)
    )


def movement(stock_item, kind, quantity, **kwargs):
    return InventoryStockMovement.objects.create(
        inventory_item=stock_item,
        movement_type=kind,
        quantity=quantity,
        direction="inbound" if kind in {"inbound_return", "adjustment_in"} else "outbound",
        **({"source_label": "test", "notes": "Stock truth fixture"} | kwargs),
    )


def summary(stock_item, **kwargs):
    return inventory_stock_summaries([stock_item], **kwargs)[stock_item.pk]


def manager(username="stock-manager"):
    actor = get_user_model().objects.create_user(username=username)
    role, _ = ApplicationRole.objects.get_or_create(
        slug="storekeeper", defaults={"name": "Magasinier"}
    )
    UserRoleAssignment.objects.create(user=actor, role=role)
    return actor


def test_import_baseline_and_damage_are_counted_once():
    stock_item = item(reported_damaged_quantity=2)
    movement(stock_item, "adjustment_in", 20, source_label="Initial inventory import")
    movement(stock_item, "damage", 3)
    result = summary(stock_item)
    assert result["current_stock"] == 17
    assert result["healthy_stock"] == result["available_stock"] == 15
    assert result["damaged_lost_stock"] == 5


def test_future_movements_do_not_change_stock_until_effective():
    stock_item = item()
    now = timezone.now()
    movement(stock_item, "outbound_delivery", 10, effective_at=now + timedelta(hours=2))
    assert summary(stock_item, at=now)["available_stock"] == 10
    assert summary(stock_item, at=now + timedelta(hours=3))["current_stock"] == 0


def test_outstanding_stock_does_not_show_historical_total_returns():
    stock_item = item()
    movement(stock_item, "outbound_delivery", 5)
    movement(stock_item, "inbound_return", 5)
    movement(stock_item, "outbound_delivery", 3)
    result = summary(stock_item)
    assert result["out_stock"] == result["return_stock"] == 3
    assert result["historical_out_stock"] == 8
    assert result["historical_return_stock"] == 5
    assert result["available_stock"] == 7


@pytest.mark.parametrize("legacy_damage", [False, True])
def test_classified_breakage_closes_return_expectation_without_double_deduction(legacy_damage):
    stock_item = item()
    now = timezone.now()
    customer = Customer.objects.create(display_name="Stock return customer")
    draft = ReservationDraft.objects.create(
        customer=customer, start_at=now, end_at=now + timedelta(hours=1)
    )
    movement(stock_item, "outbound_delivery", 5, reservation_draft=draft)
    returned = InventoryReturnOperation.objects.create(
        reservation_draft=draft, status="validated", validated_at=now
    )
    line = InventoryReturnOperationLine.objects.create(
        return_operation=returned,
        inventory_item=stock_item,
        expected_quantity=5,
        conforming_quantity=3,
        breakage_quantity=2,
    )
    movement(stock_item, "inbound_return", 3, return_operation_line=line)
    if legacy_damage:
        movement(stock_item, "damage", 2, return_operation_line=line)
    result = summary(stock_item)
    assert result["out_stock"] == result["return_stock"] == 0
    assert result["healthy_stock"] == (6 if legacy_damage else 8)
    assert result["damaged_lost_stock"] == 2


@pytest.mark.parametrize("domain", ["titan", "hahitantsoa", "manual"])
def test_period_blocks_reference_only_in_requested_half_open_period(domain):
    stock_item = item()
    now = timezone.now()
    start = now + timedelta(days=1)
    end = start + timedelta(hours=2)
    source = {}
    customer = Customer.objects.create(display_name="Stock period customer")
    if domain == "titan":
        source["reservation_draft"] = ReservationDraft.objects.create(
            customer=customer, start_at=start, end_at=end
        )
    elif domain == "hahitantsoa":
        source["hahitantsoa_event_draft"] = HahitantsoaEventDraft.objects.create(
            customer=customer, event_name="Stock event", start_at=start, end_at=end
        )
    block = InventoryAvailability.objects.create(
        inventory_item=stock_item, status="reserved", start_at=start, end_at=end, **source
    )
    assert summary(stock_item, at=now)["available_stock"] == 10
    result = summary(stock_item, at=now, start_at=start, end_at=end)
    assert result["available_stock"] == 0
    assert result["reserved_stock"] == 10
    assert result["reservation_basis"] == "whole_reference"
    assert result["physical_status"] == "in_stock"
    assert (
        summary(stock_item, at=now, start_at=end, end_at=end + timedelta(hours=1))[
            "availability_blocked"
        ]
        is False
    )
    block.is_deleted = True
    block.save(update_fields=["is_deleted"])
    assert summary(stock_item, at=now, start_at=start, end_at=end)["available_stock"] == 10


def test_stock_status_separates_inactive_low_and_empty():
    stock_item = item()
    stock_item.is_active = False
    assert summary(stock_item)["physical_status"] == "inactive"
    assert summary(stock_item)["healthy_stock"] == 10
    assert summary(stock_item)["available_stock"] == 0
    stock_item.is_active = True
    stock_item.low_stock_threshold = 10
    assert summary(stock_item)["physical_status"] == "low"
    stock_item.low_stock_threshold = 0
    assert summary(stock_item)["physical_status"] == "in_stock"
    stock_item.reported_damaged_quantity = 10
    assert summary(stock_item)["physical_status"] == "out_of_stock"


def test_stock_list_batches_queries_independent_of_item_count(django_assert_num_queries):
    items = [item(name=f"Chaise {number}") for number in range(12)]
    with django_assert_num_queries(3):
        result = InventoryItemSerializer(items, many=True).data
    assert len(result) == 12


@pytest.mark.parametrize(
    "query",
    [
        {"start_at": "no-date", "end_at": "no-date"},
        {"start_at": "2026-11-07T12:00:00Z"},
        {"start_at": "2026-11-07T12:00:00Z", "end_at": "2026-11-07T11:00:00Z"},
    ],
)
def test_stock_api_rejects_incomplete_or_invalid_period(query):
    actor = manager()
    client = Client()
    client.force_login(actor)
    assert client.get("/api/v1/inventory/items/", query).status_code == 400


def test_name_search_finds_chair_and_fork_without_case_loss():
    actor = manager()
    client = Client()
    client.force_login(actor)
    item(name="Chaise")
    item(name="Fourchette")
    item(name="Table")
    for search in ("ch", "CH"):
        data = client.get("/api/v1/inventory/items/", {"name": search}).json()
        assert {row["name"] for row in data} == {"Chaise", "Fourchette"}


def test_alert_episode_deduplication_ack_resolution_and_reopening():
    actor = manager()
    stock_item = item(low_stock_threshold=10)
    reconcile_inventory_stock_alerts(item_ids=[stock_item.pk])
    first = SystemNotification.objects.get(recipient=actor)
    client = Client()
    client.force_login(actor)
    assert client.post("/api/v1/notifications/mark-all-read/").json()["marked_read"] == 1
    reconcile_inventory_stock_alerts(item_ids=[stock_item.pk])
    assert SystemNotification.objects.count() == 1
    first.refresh_from_db()
    assert first.is_read is True
    stock_item.low_stock_threshold = 0
    stock_item.save()
    reconcile_inventory_stock_alerts(item_ids=[stock_item.pk])
    assert InventoryStockAlert.objects.get().resolved_at is not None
    assert client.get("/api/v1/notifications/").json() == []
    stock_item.low_stock_threshold = 10
    stock_item.save()
    reconcile_inventory_stock_alerts(item_ids=[stock_item.pk])
    assert InventoryStockAlert.objects.filter(resolved_at__isnull=True).count() == 1
    assert SystemNotification.objects.count() == 2


def test_alerts_only_reach_inventory_roles_and_revalidate_revocation():
    actor = manager()
    other = get_user_model().objects.create_user(username="stock-regular")
    stock_item = item(low_stock_threshold=10)
    reconcile_inventory_stock_alerts(item_ids=[stock_item.pk])
    notification = SystemNotification.objects.get()
    assert notification.recipient_id == actor.pk
    client = Client()
    client.force_login(other)
    assert client.get("/api/v1/notifications/").json() == []
    client.force_login(actor)
    assert len(client.get("/api/v1/notifications/").json()) == 1
    UserRoleAssignment.objects.filter(user=actor).update(is_active=False, revoked_at=timezone.now())
    assert client.get("/api/v1/notifications/").json() == []
    assert (
        client.patch(
            f"/api/v1/notifications/{notification.pk}/read/",
            {"is_read": True},
            content_type="application/json",
        ).status_code
        == 404
    )
    assert client.post("/api/v1/notifications/mark-all-read/").json()["marked_read"] == 0


def test_catalogue_writes_resolve_alerts_and_restock_updates_same_transaction():
    actor = manager()
    stock_item = save_inventory_catalog_item(
        actor=actor,
        attributes={"name": "Stock item", "kind": "article", "reported_inventory_quantity": 0},
    )
    assert InventoryStockAlert.objects.filter(resolved_at__isnull=True).count() == 1
    create_inventory_stock_movement(
        actor=actor,
        inventory_item=stock_item,
        movement_type="adjustment_in",
        quantity=4,
        source_label="test",
        notes="Restock",
    )
    assert InventoryStockAlert.objects.filter(resolved_at__isnull=True).count() == 0
    save_inventory_catalog_item(
        actor=actor, instance=stock_item, attributes={"low_stock_threshold": 5}
    )
    assert InventoryStockAlert.objects.filter(resolved_at__isnull=True).count() == 1
    save_inventory_catalog_item(actor=actor, instance=stock_item, attributes={"is_active": False})
    assert InventoryStockAlert.objects.filter(resolved_at__isnull=True).count() == 0


def test_alert_failure_rolls_back_stock_write():
    actor = manager()
    stock_item = item()
    with patch(
        "apps.inventory.stock_alerts.SystemNotification.objects.create",
        side_effect=RuntimeError("notification failure"),
    ):
        with pytest.raises(RuntimeError):
            create_inventory_stock_movement(
                actor=actor,
                inventory_item=stock_item,
                movement_type="adjustment_out",
                quantity=10,
                source_label="test",
                notes="Rollback",
            )
    assert stock_item.stock_movements.count() == 0
    assert summary(stock_item)["healthy_stock"] == 10
    assert InventoryStockAlert.objects.count() == 0


def test_reconciliation_is_explicit_and_handles_new_recipients_and_effective_time():
    stock_item = item()
    future = timezone.now() + timedelta(hours=1)
    movement(stock_item, "outbound_delivery", 10, effective_at=future)
    manager()
    output = StringIO()
    call_command("reconcile_inventory_stock_alerts", stdout=output)
    assert "Dry run" in output.getvalue()
    assert SystemNotification.objects.count() == 0
    with patch(
        "apps.inventory.stock_selectors.timezone.now", return_value=future + timedelta(seconds=1)
    ):
        call_command("reconcile_inventory_stock_alerts", apply=True, stdout=output)
    assert SystemNotification.objects.count() == 1
    new_recipient = manager("stock-second-manager")
    with patch(
        "apps.inventory.stock_selectors.timezone.now", return_value=future + timedelta(seconds=1)
    ):
        call_command("reconcile_inventory_stock_alerts", apply=True, stdout=output)
    assert SystemNotification.objects.filter(recipient=new_recipient).count() == 1


@pytest.mark.django_db(transaction=True)
def test_concurrent_reconciliation_creates_one_episode_per_recipient():
    assert connection.vendor == "postgresql"
    actor = manager()
    stock_item = item(low_stock_threshold=10)
    barrier = Barrier(2)

    def reconcile():
        close_old_connections()
        try:
            barrier.wait(timeout=10)
            reconcile_inventory_stock_alerts(item_ids=[stock_item.pk])
        finally:
            connection.close()

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = [executor.submit(reconcile) for _ in range(2)]
        for result in results:
            result.result(timeout=20)
    assert (
        InventoryStockAlert.objects.filter(recipient=actor, resolved_at__isnull=True).count() == 1
    )
    assert SystemNotification.objects.filter(recipient=actor).count() == 1


@pytest.mark.parametrize("field", ["reported_inventory_quantity", "reported_damaged_quantity"])
def test_catalogue_update_cannot_rewrite_initial_count(field):
    actor = manager()
    stock_item = item()
    client = Client()
    client.force_login(actor)
    response = client.patch(
        f"/api/v1/inventory/items/{stock_item.pk}/",
        {field: 20, "name": "Changed"},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert field in response.json()
    stock_item.refresh_from_db()
    assert stock_item.name == "Chaise"
    assert stock_item.reported_inventory_quantity == 10
    assert stock_item.reported_damaged_quantity == 0
    assert stock_item.stock_movements.count() == 0


def test_expected_stock_conflict_has_no_stock_or_notification_side_effect():
    actor = manager()
    stock_item = item()
    client = Client()
    client.force_login(actor)
    payload = {
        "inventory_item": str(stock_item.pk),
        "movement_type": "adjustment_out",
        "quantity": 2,
        "source_label": "Count correction",
        "notes": "Authorized physical count",
        "expected_current_stock": 10,
    }
    first = client.post(
        "/api/v1/inventory/stock-movements/", payload, content_type="application/json"
    )
    assert first.status_code == 201
    conflict = client.post(
        "/api/v1/inventory/stock-movements/", payload, content_type="application/json"
    )
    assert conflict.status_code == 409
    assert conflict.json()["code"] == "inventory_stock_conflict"
    assert stock_item.stock_movements.count() == 1
    assert summary(stock_item)["current_stock"] == 8


@pytest.mark.django_db(transaction=True)
def test_concurrent_adjustments_revalidate_expected_stock_under_item_lock():
    from apps.inventory.services import InventoryStockMovementError

    actor = manager()
    stock_item = item()
    barrier = Barrier(2)

    def adjust():
        close_old_connections()
        try:
            barrier.wait(timeout=10)
            try:
                create_inventory_stock_movement(
                    actor=actor,
                    inventory_item=stock_item,
                    movement_type="adjustment_out",
                    quantity=2,
                    source_label="Count",
                    notes="Concurrent guarded count",
                    expected_current_stock=10,
                )
            except InventoryStockMovementError as error:
                return error.code
            return "created"
        finally:
            connection.close()

    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = [executor.submit(adjust) for _ in range(2)]
        results = [future.result(timeout=20) for future in futures]
    assert sorted(results) == ["created", "inventory_stock_conflict"]
    assert stock_item.stock_movements.count() == 1
    assert summary(stock_item)["current_stock"] == 8


def test_validating_a_return_resolves_alert_after_classification_and_stock_are_saved():
    from apps.inventory.services import validate_inventory_return_operation

    actor = manager()
    stock_item = item(reported_inventory_quantity=1)
    start = timezone.now()
    customer = Customer.objects.create(display_name="Return alert fixture")
    draft = ReservationDraft.objects.create(
        customer=customer, start_at=start, end_at=start + timedelta(hours=2)
    )
    create_inventory_stock_movement(
        actor=actor,
        inventory_item=stock_item,
        movement_type="outbound_delivery",
        quantity=1,
        reservation_draft=draft,
        notes="Delivery",
    )
    assert InventoryStockAlert.objects.filter(resolved_at__isnull=True).count() == 1
    returned = InventoryReturnOperation.objects.create(reservation_draft=draft)
    InventoryReturnOperationLine.objects.create(
        return_operation=returned,
        inventory_item=stock_item,
        expected_quantity=1,
        conforming_quantity=1,
        breakage_quantity=0,
    )
    validate_inventory_return_operation(return_operation=returned, actor=actor)
    assert summary(stock_item)["healthy_stock"] == 1
    assert summary(stock_item)["return_stock"] == 0
    assert InventoryStockAlert.objects.filter(resolved_at__isnull=True).count() == 0


def test_negative_ledger_is_reported_without_rewriting_history():
    stock_item = item()
    original = movement(stock_item, "adjustment_out", 12)
    result = summary(stock_item)
    assert result["current_stock"] == 0
    assert result["ledger_balance"] == -2
    assert result["stock_anomalies"] == ["negative_ledger_balance"]
    output = StringIO()
    call_command("reconcile_inventory_stock_alerts", stdout=output)
    assert "negative_ledger_balance" in output.getvalue()
    original.refresh_from_db()
    assert original.quantity == 12
    assert stock_item.stock_movements.count() == 1
