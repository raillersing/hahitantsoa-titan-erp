"""Batched physical stock and period blocking reads; no stock or alert writes."""

from datetime import timedelta

from django.db.models import Case, Count, Exists, F, IntegerField, OuterRef, Q, Sum, When
from django.utils import timezone

from apps.inventory.availability import (
    UNAVAILABLE_AVAILABILITY_STATUSES,
    validate_availability_period,
)
from apps.inventory.models import (
    InventoryAvailability,
    InventoryReturnOperationLine,
    InventoryStockMovement,
    InventoryStockMovementType,
)


def inventory_stock_summaries(items, *, at=None, start_at=None, end_at=None):
    items = list(items)
    at = at or timezone.now()
    if (start_at is None) != (end_at is None):
        raise ValueError("Both start_at and end_at are required for a stock period.")
    if start_at is not None:
        validate_availability_period(start_at=start_at, end_at=end_at)
    else:
        start_at, end_at = at, at + timedelta(microseconds=1)
    item_ids = [item.pk for item in items if item.pk and not item._state.adding]
    initial = Q(source_label="Initial inventory import")
    signed = Case(
        When(direction="inbound", then=F("quantity")),
        default=-F("quantity"),
        output_field=IntegerField(),
    )
    totals = (
        {
            row["inventory_item_id"]: row
            for row in InventoryStockMovement.objects.filter(
                inventory_item_id__in=item_ids, effective_at__lte=at
            )
            .values("inventory_item_id")
            .annotate(
                initial_count=Count("id", filter=initial),
                initial_quantity=Sum("quantity", filter=initial),
                delta=Sum(signed, filter=~initial),
                outbound=Sum("quantity", filter=Q(movement_type="outbound_delivery") & ~initial),
                returned=Sum("quantity", filter=Q(movement_type="inbound_return") & ~initial),
                damaged=Sum("quantity", filter=Q(movement_type__in=("damage", "loss")) & ~initial),
            )
        }
        if item_ids
        else {}
    )
    legacy_breakage = InventoryStockMovement.objects.filter(
        return_operation_line_id=OuterRef("pk"),
        movement_type__in=(InventoryStockMovementType.DAMAGE, InventoryStockMovementType.LOSS),
        effective_at__lte=at,
    )
    breakage = Case(
        When(
            conforming_quantity=F("expected_quantity") - F("breakage_quantity"),
            then=F("breakage_quantity"),
        ),
        default=F("damaged_quantity") + F("missing_quantity"),
        output_field=IntegerField(),
    )
    returned_rows = (
        InventoryReturnOperationLine.objects.filter(
            inventory_item_id__in=item_ids,
            return_operation__status="validated",
            return_operation__validated_at__lte=at,
        )
        .annotate(has_legacy_breakage=Exists(legacy_breakage))
        .values("inventory_item_id")
        .annotate(
            breakage=Sum(breakage),
            unrecorded_breakage=Sum(breakage, filter=Q(has_legacy_breakage=False)),
        )
        if item_ids
        else []
    )
    return_totals = {row["inventory_item_id"]: row for row in returned_rows}
    blocked = (
        set(
            InventoryAvailability.objects.filter(
                inventory_item_id__in=item_ids,
                is_deleted=False,
                status__in=UNAVAILABLE_AVAILABILITY_STATUSES,
                start_at__lt=end_at,
                end_at__gt=start_at,
            ).values_list("inventory_item_id", flat=True)
        )
        if item_ids
        else set()
    )
    summaries = {}
    for item in items:
        row = totals.get(item.pk, {})
        baseline = (
            (row.get("initial_quantity") or 0)
            if row.get("initial_count")
            else item.reported_inventory_quantity
        )
        ledger_balance = baseline + (row.get("delta") or 0)
        current = max(ledger_balance, 0)
        healthy = max(current - item.reported_damaged_quantity, 0)
        returns = return_totals.get(item.pk, {})
        outstanding = max(
            (row.get("outbound") or 0)
            - (row.get("returned") or 0)
            - (returns.get("breakage") or 0),
            0,
        )
        anomalies = []
        if ledger_balance < 0:
            anomalies.append("negative_ledger_balance")
        if item.reported_damaged_quantity > current:
            anomalies.append("reported_damage_exceeds_on_hand")
        if (row.get("returned") or 0) + (returns.get("breakage") or 0) > (row.get("outbound") or 0):
            anomalies.append("returns_exceed_outbound")
        threshold = item.low_stock_threshold
        physical_status = (
            "inactive"
            if not item.is_active or item.is_deleted
            else "out_of_stock"
            if healthy == 0
            else "low"
            if threshold > 0 and healthy <= threshold
            else "in_stock"
        )
        is_blocked = item.pk in blocked
        summaries[item.pk] = {
            "reported_inventory_quantity": item.reported_inventory_quantity,
            "reported_damaged_quantity": item.reported_damaged_quantity,
            "current_stock": current,
            "ledger_balance": ledger_balance,
            "stock_anomalies": anomalies,
            "healthy_stock": healthy,
            "available_stock": 0 if is_blocked or physical_status == "inactive" else healthy,
            # The accepted allocation model blocks a reference, not a fraction of its units.
            "reserved_stock": healthy if is_blocked else 0,
            "out_stock": outstanding,
            "return_stock": outstanding,
            "damaged_lost_stock": item.reported_damaged_quantity
            + (row.get("damaged") or 0)
            + (returns.get("unrecorded_breakage") or 0),
            "historical_out_stock": row.get("outbound") or 0,
            "historical_return_stock": row.get("returned") or 0,
            "availability_blocked": is_blocked,
            "reservation_basis": "whole_reference",
            "physical_status": physical_status,
            "low_stock_threshold": threshold,
            "as_of": at.isoformat(),
            "period_start_at": start_at.isoformat(),
            "period_end_at": end_at.isoformat(),
        }
    return summaries
