"""Reporting domain definitions (Lot 1.4).

This module enumerates report categories, KPIs, and the access matrix used
by the reporting backend and frontend.  It is pure configuration — no
database models, no services.  The actual aggregation queries live in the
respective domain selectors and services.
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import datetime, timedelta
from decimal import Decimal
from enum import StrEnum
from typing import Any

from django.db import models
from django.utils import timezone

from apps.billing.models import (
    BillingCreditNote,
    BillingCreditNoteStatus,
    BillingInstallmentAllocation,
    BillingInstallmentStatus,
    BillingInvoice,
    BillingInvoiceInstallment,
    BillingInvoiceStatus,
    BillingRefundObligation,
    BillingRefundObligationStatus,
)
from apps.customers.models import Customer, CustomerLifecycleStatus, ProspectStatus
from apps.documents.models import DocumentInstance
from apps.hahitantsoa.models import HahitantsoaEventDraft
from apps.inventory.models import (
    InventoryAvailability,
    InventoryAvailabilityStatus,
    InventoryItem,
    InventoryStockMovement,
    InventoryStockMovementType,
)
from apps.logistics.models import (
    HandoverSignatureStatus,
    LogisticsEvent,
    LogisticsEventStatus,
    LogisticsEventType,
)
from apps.payments.models import Payment, PaymentMethod, PaymentStatus
from apps.reservations.models import ReservationDraft, ReservationDraftStatus


class ReportCategory(StrEnum):
    RESERVATIONS = "reservations"
    SALES_BILLING = "sales_billing"
    PAYMENTS = "payments"
    PROSPECTS = "prospects"
    LOGISTICS = "logistics"
    INVENTORY = "inventory"
    DOCUMENTS = "documents"


class ReportKpi(StrEnum):
    # Réservations
    RESERVATION_CREATED = "reservation_created"
    RESERVATION_CONFIRMED = "reservation_confirmed"
    RESERVATION_CANCELLED = "reservation_cancelled"
    RESERVATION_SCOPE_SPLIT = "reservation_scope_split"
    # Ventes / Facturation
    REVENUE_INVOICED = "revenue_invoiced"
    REVENUE_COLLECTED = "revenue_collected"
    REVENUE_OUTSTANDING = "revenue_outstanding"
    CREDIT_NOTE_TOTAL = "credit_note_total"
    REFUND_TOTAL = "refund_total"
    # Paiements
    PAYMENT_METHOD_SPLIT = "payment_method_split"
    PAYMENT_DUE_DATE = "payment_due_date"
    PAYMENT_INTERIM = "payment_interim"
    PAYMENT_RECONCILED = "payment_reconciled"
    # Prospects
    PROSPECT_FUNNEL = "prospect_funnel"
    PROSPECT_CONVERSION_RATE = "prospect_conversion_rate"
    PROSPECT_DELAY = "prospect_delay"
    PROSPECT_OVERDUE_RECALL = "prospect_overdue_recall"
    # Logistique
    LOGISTICS_PREPARED = "logistics_prepared"
    LOGISTICS_DELIVERED = "logistics_delivered"
    LOGISTICS_RETURNED = "logistics_returned"
    LOGISTICS_DELAY = "logistics_delay"
    LOGISTICS_EXCEPTION = "logistics_exception"
    # Inventaire
    INVENTORY_AVAILABLE = "inventory_available"
    INVENTORY_RESERVED = "inventory_reserved"
    INVENTORY_DISPATCHED = "inventory_dispatched"
    INVENTORY_RETURNED = "inventory_returned"
    INVENTORY_UTILIZATION = "inventory_utilization"
    INVENTORY_BREAKAGE = "inventory_breakage"
    INVENTORY_LOSS = "inventory_loss"
    # Documents
    DOC_CONTRACT = "doc_contract"
    DOC_AMENDMENT = "doc_amendment"
    DOC_DELIVERY_NOTE = "doc_delivery_note"
    DOC_MISSING_SIGNATURE = "doc_missing_signature"


# Report access matrix: which roles can view / export which report categories.
# Keys are IdentityRole / CompanyRole slugs.  A role can view a category if
# listed in 'view'.  It can export if listed in 'export'.
# Identity roles (platform capabilities) override company roles.
REPORT_ACCESS_MATRIX: dict[str, dict[str, list[str]]] = {
    "identity_admin": {
        "view": [c.value for c in ReportCategory],
        "export": [c.value for c in ReportCategory],
    },
    "reservation_sensitive_operator": {
        "view": [c.value for c in ReportCategory],
        "export": [c.value for c in ReportCategory],
    },
    "cashbox_supervisor": {
        "view": [
            ReportCategory.PAYMENTS.value,
            ReportCategory.SALES_BILLING.value,
        ],
        "export": [
            ReportCategory.PAYMENTS.value,
            ReportCategory.SALES_BILLING.value,
        ],
    },
    "logistics_manager": {
        "view": [
            ReportCategory.LOGISTICS.value,
            ReportCategory.INVENTORY.value,
        ],
        "export": [
            ReportCategory.LOGISTICS.value,
            ReportCategory.INVENTORY.value,
        ],
    },
    "owner_manager": {
        "view": [c.value for c in ReportCategory],
        "export": [c.value for c in ReportCategory],
    },
    "manager": {
        "view": [c.value for c in ReportCategory],
        "export": [c.value for c in ReportCategory],
    },
    "storekeeper": {
        "view": [
            ReportCategory.INVENTORY.value,
        ],
        "export": [],
    },
    "delivery_driver": {
        "view": [],
        "export": [],
    },
    "cleaner": {
        "view": [],
        "export": [],
    },
    "accountant": {
        "view": [
            ReportCategory.SALES_BILLING.value,
            ReportCategory.PAYMENTS.value,
        ],
        "export": [
            ReportCategory.SALES_BILLING.value,
            ReportCategory.PAYMENTS.value,
        ],
    },
}


def can_role_view_report(*, role_slug: str, category: str) -> bool:
    return category in REPORT_ACCESS_MATRIX.get(role_slug, {}).get("view", [])


def can_role_export_report(*, role_slug: str, category: str) -> bool:
    return category in REPORT_ACCESS_MATRIX.get(role_slug, {}).get("export", [])


# ----------------------------------------------------------------------
# Period helpers
# ----------------------------------------------------------------------
def get_period_bounds(
    *, period: str, now: datetime | None = None
) -> tuple[datetime, datetime, datetime, datetime]:
    """Return (current_start, current_end, previous_start, previous_end)."""
    now = now or timezone.now()
    if period == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end = now
        prev_start = start - timedelta(days=1)
        prev_end = prev_start + (end - start)
    elif period == "week":
        start = now - timedelta(days=7)
        end = now
        prev_start = start - timedelta(days=7)
        prev_end = start
    elif period == "month":
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        end = now
        if start.month == 1:
            prev_start = start.replace(year=start.year - 1, month=12, day=1)
        else:
            prev_start = start.replace(month=start.month - 1, day=1)
        prev_end = prev_start + (end - start)
    elif period == "quarter":
        quarter = (now.month - 1) // 3
        start = now.replace(
            month=quarter * 3 + 1, day=1, hour=0, minute=0, second=0, microsecond=0
        )
        end = now
        if quarter == 0:
            prev_start = start.replace(year=start.year - 1, month=10, day=1)
        else:
            prev_start = start.replace(month=start.month - 3, day=1)
        prev_end = prev_start + (end - start)
    elif period == "year":
        start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        end = now
        prev_start = start.replace(year=start.year - 1)
        prev_end = prev_start + (end - start)
    else:
        start = now - timedelta(days=30)
        end = now
        prev_start = start - timedelta(days=30)
        prev_end = start
    return start, end, prev_start, prev_end


def _trend(current: float | int, previous: float | int) -> float | None:
    if previous == 0 or previous is None:
        return None if current == 0 else 100.0
    return round(((current - previous) / previous) * 100, 2)


# ----------------------------------------------------------------------
# KPI calculators
# ----------------------------------------------------------------------
def calculate_reservation_created(period: str) -> dict[str, Any]:
    start, end, pstart, pend = get_period_bounds(period=period)
    current = ReservationDraft.objects.filter(
        created_at__range=(start, end), is_deleted=False
    ).count()
    previous = ReservationDraft.objects.filter(
        created_at__range=(pstart, pend), is_deleted=False
    ).count()
    return {
        "value": current,
        "previous_period_value": previous,
        "trend_percentage": _trend(current, previous),
    }


def calculate_reservation_confirmed(period: str) -> dict[str, Any]:
    start, end, pstart, pend = get_period_bounds(period=period)
    current = ReservationDraft.objects.filter(
        status=ReservationDraftStatus.CONFIRMED,
        confirmed_at__range=(start, end),
        is_deleted=False,
    ).count()
    previous = ReservationDraft.objects.filter(
        status=ReservationDraftStatus.CONFIRMED,
        confirmed_at__range=(pstart, pend),
        is_deleted=False,
    ).count()
    return {
        "value": current,
        "previous_period_value": previous,
        "trend_percentage": _trend(current, previous),
    }


def calculate_reservation_cancelled(period: str) -> dict[str, Any]:
    start, end, pstart, pend = get_period_bounds(period=period)
    current = ReservationDraft.objects.filter(
        status=ReservationDraftStatus.CANCELLED,
        cancelled_at__range=(start, end),
        is_deleted=False,
    ).count()
    previous = ReservationDraft.objects.filter(
        status=ReservationDraftStatus.CANCELLED,
        cancelled_at__range=(pstart, pend),
        is_deleted=False,
    ).count()
    return {
        "value": current,
        "previous_period_value": previous,
        "trend_percentage": _trend(current, previous),
    }


def calculate_reservation_scope_split(period: str) -> dict[str, Any]:
    start, end, pstart, pend = get_period_bounds(period=period)
    titan_current = ReservationDraft.objects.filter(
        created_at__range=(start, end), is_deleted=False
    ).count()
    hah_current = HahitantsoaEventDraft.objects.filter(
        created_at__range=(start, end), is_deleted=False
    ).count()
    titan_previous = ReservationDraft.objects.filter(
        created_at__range=(pstart, pend), is_deleted=False
    ).count()
    hah_previous = HahitantsoaEventDraft.objects.filter(
        created_at__range=(pstart, pend), is_deleted=False
    ).count()
    current_total = titan_current + hah_current
    previous_total = titan_previous + hah_previous
    return {
        "value": {"titan": titan_current, "hahitantsoa": hah_current},
        "previous_period_value": {"titan": titan_previous, "hahitantsoa": hah_previous},
        "trend_percentage": _trend(current_total, previous_total),
    }


def calculate_revenue_invoiced(period: str) -> dict[str, Any]:
    start, end, pstart, pend = get_period_bounds(period=period)
    current = (
        BillingInvoice.objects.filter(
            issued_at__range=(start, end),
            invoice_status__in=[BillingInvoiceStatus.OPEN, BillingInvoiceStatus.SETTLED],
        ).aggregate(total=models.Sum("amount"))["total"]
        or Decimal("0.00")
    )
    previous = (
        BillingInvoice.objects.filter(
            issued_at__range=(pstart, pend),
            invoice_status__in=[BillingInvoiceStatus.OPEN, BillingInvoiceStatus.SETTLED],
        ).aggregate(total=models.Sum("amount"))["total"]
        or Decimal("0.00")
    )
    return {
        "value": float(current),
        "previous_period_value": float(previous),
        "trend_percentage": _trend(float(current), float(previous)),
    }


def calculate_revenue_collected(period: str) -> dict[str, Any]:
    from apps.billing.models import BillingInvoiceSettlement

    start, end, pstart, pend = get_period_bounds(period=period)
    current = (
        BillingInvoiceSettlement.objects.filter(settled_at__range=(start, end)).aggregate(
            total=models.Sum("amount")
        )["total"]
        or Decimal("0.00")
    )
    previous = (
        BillingInvoiceSettlement.objects.filter(settled_at__range=(pstart, pend)).aggregate(
            total=models.Sum("amount")
        )["total"]
        or Decimal("0.00")
    )
    return {
        "value": float(current),
        "previous_period_value": float(previous),
        "trend_percentage": _trend(float(current), float(previous)),
    }


def calculate_revenue_outstanding(period: str) -> dict[str, Any]:
    _, end, _, prev_end = get_period_bounds(period=period)
    current = (
        BillingInvoice.objects.filter(
            issued_at__lte=end, invoice_status=BillingInvoiceStatus.OPEN
        ).aggregate(total=models.Sum("amount"))["total"]
        or Decimal("0.00")
    )
    previous = (
        BillingInvoice.objects.filter(
            issued_at__lte=prev_end, invoice_status=BillingInvoiceStatus.OPEN
        ).aggregate(total=models.Sum("amount"))["total"]
        or Decimal("0.00")
    )
    return {
        "value": float(current),
        "previous_period_value": float(previous),
        "trend_percentage": _trend(float(current), float(previous)),
    }


def calculate_credit_note_total(period: str) -> dict[str, Any]:
    start, end, pstart, pend = get_period_bounds(period=period)
    current = (
        BillingCreditNote.objects.filter(
            issued_at__range=(start, end),
            status__in=[BillingCreditNoteStatus.ISSUED, BillingCreditNoteStatus.APPLIED],
        ).aggregate(total=models.Sum("amount"))["total"]
        or Decimal("0.00")
    )
    previous = (
        BillingCreditNote.objects.filter(
            issued_at__range=(pstart, pend),
            status__in=[BillingCreditNoteStatus.ISSUED, BillingCreditNoteStatus.APPLIED],
        ).aggregate(total=models.Sum("amount"))["total"]
        or Decimal("0.00")
    )
    return {
        "value": float(current),
        "previous_period_value": float(previous),
        "trend_percentage": _trend(float(current), float(previous)),
    }


def calculate_refund_total(period: str) -> dict[str, Any]:
    start, end, pstart, pend = get_period_bounds(period=period)
    current = (
        BillingRefundObligation.objects.filter(
            executed_at__range=(start, end),
            status=BillingRefundObligationStatus.EXECUTED,
        ).aggregate(total=models.Sum("refund_amount"))["total"]
        or Decimal("0.00")
    )
    previous = (
        BillingRefundObligation.objects.filter(
            executed_at__range=(pstart, pend),
            status=BillingRefundObligationStatus.EXECUTED,
        ).aggregate(total=models.Sum("refund_amount"))["total"]
        or Decimal("0.00")
    )
    return {
        "value": float(current),
        "previous_period_value": float(previous),
        "trend_percentage": _trend(float(current), float(previous)),
    }


def calculate_payment_method_split(period: str) -> dict[str, Any]:
    start, end, pstart, pend = get_period_bounds(period=period)
    current: dict[str, float] = {}
    previous: dict[str, float] = {}
    current_total = Decimal("0.00")
    previous_total = Decimal("0.00")
    confirmed_statuses = [PaymentStatus.CONFIRMED, PaymentStatus.RECONCILED]
    for method, _label in PaymentMethod.choices:
        cur = (
            Payment.objects.filter(
                paid_at__range=(start, end),
                payment_status__in=confirmed_statuses,
                payment_method=method,
            ).aggregate(total=models.Sum("amount"))["total"]
            or Decimal("0.00")
        )
        prev = (
            Payment.objects.filter(
                paid_at__range=(pstart, pend),
                payment_status__in=confirmed_statuses,
                payment_method=method,
            ).aggregate(total=models.Sum("amount"))["total"]
            or Decimal("0.00")
        )
        current[method] = float(cur)
        previous[method] = float(prev)
        current_total += cur
        previous_total += prev
    return {
        "value": current,
        "previous_period_value": previous,
        "trend_percentage": _trend(float(current_total), float(previous_total)),
    }


def calculate_payment_due_date(period: str) -> dict[str, Any]:
    start, end, pstart, pend = get_period_bounds(period=period)
    due_statuses = [BillingInstallmentStatus.UNPAID, BillingInstallmentStatus.PARTIALLY_PAID]
    current = BillingInvoiceInstallment.objects.filter(
        due_at__range=(start, end), status__in=due_statuses
    ).count()
    previous = BillingInvoiceInstallment.objects.filter(
        due_at__range=(pstart, pend), status__in=due_statuses
    ).count()
    return {
        "value": current,
        "previous_period_value": previous,
        "trend_percentage": _trend(current, previous),
    }


def calculate_payment_interim(period: str) -> dict[str, Any]:
    start, end, pstart, pend = get_period_bounds(period=period)
    current = (
        BillingInstallmentAllocation.objects.filter(
            allocated_at__range=(start, end)
        ).aggregate(total=models.Sum("amount"))["total"]
        or Decimal("0.00")
    )
    previous = (
        BillingInstallmentAllocation.objects.filter(
            allocated_at__range=(pstart, pend)
        ).aggregate(total=models.Sum("amount"))["total"]
        or Decimal("0.00")
    )
    return {
        "value": float(current),
        "previous_period_value": float(previous),
        "trend_percentage": _trend(float(current), float(previous)),
    }


def calculate_payment_reconciled(period: str) -> dict[str, Any]:
    start, end, pstart, pend = get_period_bounds(period=period)
    current = (
        Payment.objects.filter(
            payment_status=PaymentStatus.RECONCILED,
            confirmed_at__range=(start, end),
        ).aggregate(total=models.Sum("amount"))["total"]
        or Decimal("0.00")
    )
    previous = (
        Payment.objects.filter(
            payment_status=PaymentStatus.RECONCILED,
            confirmed_at__range=(pstart, pend),
        ).aggregate(total=models.Sum("amount"))["total"]
        or Decimal("0.00")
    )
    return {
        "value": float(current),
        "previous_period_value": float(previous),
        "trend_percentage": _trend(float(current), float(previous)),
    }


def calculate_prospect_funnel(period: str) -> dict[str, Any]:
    start, end, pstart, pend = get_period_bounds(period=period)
    current: dict[str, int] = {}
    previous: dict[str, int] = {}
    current_total = 0
    previous_total = 0
    for status, _label in ProspectStatus.choices:
        cur = Customer.objects.filter(
            lifecycle_status=CustomerLifecycleStatus.PROSPECT,
            prospect_status=status,
            is_active=True,
            is_deleted=False,
        ).count()
        prev = Customer.objects.filter(
            lifecycle_status=CustomerLifecycleStatus.PROSPECT,
            prospect_status=status,
            is_active=True,
            is_deleted=False,
            prospect_status_changed_at__lte=pend,
        ).count()
        current[status] = cur
        previous[status] = prev
        current_total += cur
        previous_total += prev
    return {
        "value": current,
        "previous_period_value": previous,
        "trend_percentage": _trend(current_total, previous_total),
    }


def calculate_prospect_conversion_rate(period: str) -> dict[str, Any]:
    start, end, pstart, pend = get_period_bounds(period=period)
    converted_current = Customer.objects.filter(
        prospect_status=ProspectStatus.CONVERTED,
        prospect_status_changed_at__range=(start, end),
        is_deleted=False,
    ).count()
    total_prospects_current = (
        Customer.objects.filter(
            lifecycle_status=CustomerLifecycleStatus.PROSPECT,
            is_deleted=False,
            created_at__lte=end,
        ).count()
        + converted_current
    )
    rate = (
        (converted_current / total_prospects_current * 100)
        if total_prospects_current > 0
        else 0.0
    )

    converted_previous = Customer.objects.filter(
        prospect_status=ProspectStatus.CONVERTED,
        prospect_status_changed_at__range=(pstart, pend),
        is_deleted=False,
    ).count()
    total_prospects_previous = (
        Customer.objects.filter(
            lifecycle_status=CustomerLifecycleStatus.PROSPECT,
            is_deleted=False,
            created_at__lte=pend,
        ).count()
        + converted_previous
    )
    prev_rate = (
        (converted_previous / total_prospects_previous * 100)
        if total_prospects_previous > 0
        else 0.0
    )
    return {
        "value": round(rate, 2),
        "previous_period_value": round(prev_rate, 2),
        "trend_percentage": _trend(rate, prev_rate),
    }


def calculate_prospect_delay(period: str) -> dict[str, Any]:
    start, end, pstart, pend = get_period_bounds(period=period)
    current_avg = Customer.objects.filter(
        prospect_status=ProspectStatus.CONVERTED,
        prospect_status_changed_at__range=(start, end),
        is_deleted=False,
    ).aggregate(
        avg_delay=models.Avg(
            models.ExpressionWrapper(
                models.F("prospect_status_changed_at") - models.F("created_at"),
                output_field=models.DurationField(),
            )
        )
    )["avg_delay"]
    previous_avg = Customer.objects.filter(
        prospect_status=ProspectStatus.CONVERTED,
        prospect_status_changed_at__range=(pstart, pend),
        is_deleted=False,
    ).aggregate(
        avg_delay=models.Avg(
            models.ExpressionWrapper(
                models.F("prospect_status_changed_at") - models.F("created_at"),
                output_field=models.DurationField(),
            )
        )
    )["avg_delay"]
    current_days = current_avg.total_seconds() / 86400 if current_avg else 0.0
    prev_days = previous_avg.total_seconds() / 86400 if previous_avg else 0.0
    return {
        "value": round(current_days, 2),
        "previous_period_value": round(prev_days, 2),
        "trend_percentage": _trend(current_days, prev_days),
    }


def calculate_prospect_overdue_recall(period: str) -> dict[str, Any]:
    start, end, pstart, pend = get_period_bounds(period=period)
    terminal_statuses = [
        ProspectStatus.CONVERTED.value,
        ProspectStatus.DISQUALIFIED.value,
        ProspectStatus.LOST.value,
    ]
    current = Customer.objects.filter(
        lifecycle_status=CustomerLifecycleStatus.PROSPECT,
        prospect_next_follow_up__lt=end,
        prospect_next_follow_up__isnull=False,
        is_active=True,
        is_deleted=False,
    ).exclude(prospect_status__in=terminal_statuses).count()
    previous = Customer.objects.filter(
        lifecycle_status=CustomerLifecycleStatus.PROSPECT,
        prospect_next_follow_up__lt=pend,
        prospect_next_follow_up__isnull=False,
        is_active=True,
        is_deleted=False,
    ).exclude(prospect_status__in=terminal_statuses).count()
    return {
        "value": current,
        "previous_period_value": previous,
        "trend_percentage": _trend(current, previous),
    }


def calculate_logistics_prepared(period: str) -> dict[str, Any]:
    start, end, pstart, pend = get_period_bounds(period=period)
    current = LogisticsEvent.objects.filter(
        event_type=LogisticsEventType.PREPARATION,
        created_at__range=(start, end),
    ).count()
    previous = LogisticsEvent.objects.filter(
        event_type=LogisticsEventType.PREPARATION,
        created_at__range=(pstart, pend),
    ).count()
    return {
        "value": current,
        "previous_period_value": previous,
        "trend_percentage": _trend(current, previous),
    }


def calculate_logistics_delivered(period: str) -> dict[str, Any]:
    start, end, pstart, pend = get_period_bounds(period=period)
    current = LogisticsEvent.objects.filter(
        event_type=LogisticsEventType.DELIVERY,
        status=LogisticsEventStatus.COMPLETED,
        executed_at__range=(start, end),
    ).count()
    previous = LogisticsEvent.objects.filter(
        event_type=LogisticsEventType.DELIVERY,
        status=LogisticsEventStatus.COMPLETED,
        executed_at__range=(pstart, pend),
    ).count()
    return {
        "value": current,
        "previous_period_value": previous,
        "trend_percentage": _trend(current, previous),
    }


def calculate_logistics_returned(period: str) -> dict[str, Any]:
    start, end, pstart, pend = get_period_bounds(period=period)
    current = LogisticsEvent.objects.filter(
        event_type=LogisticsEventType.PICKUP,
        status=LogisticsEventStatus.COMPLETED,
        executed_at__range=(start, end),
    ).count()
    previous = LogisticsEvent.objects.filter(
        event_type=LogisticsEventType.PICKUP,
        status=LogisticsEventStatus.COMPLETED,
        executed_at__range=(pstart, pend),
    ).count()
    return {
        "value": current,
        "previous_period_value": previous,
        "trend_percentage": _trend(current, previous),
    }


def calculate_logistics_delay(period: str) -> dict[str, Any]:
    start, end, pstart, pend = get_period_bounds(period=period)
    current = LogisticsEvent.objects.filter(
        scheduled_at__range=(start, end),
        executed_at__gt=models.F("scheduled_at"),
    ).count()
    previous = LogisticsEvent.objects.filter(
        scheduled_at__range=(pstart, pend),
        executed_at__gt=models.F("scheduled_at"),
    ).count()
    return {
        "value": current,
        "previous_period_value": previous,
        "trend_percentage": _trend(current, previous),
    }


def calculate_logistics_exception(period: str) -> dict[str, Any]:
    start, end, pstart, pend = get_period_bounds(period=period)
    current = LogisticsEvent.objects.filter(
        signature_status=HandoverSignatureStatus.EXCEPTION,
        created_at__range=(start, end),
    ).count()
    previous = LogisticsEvent.objects.filter(
        signature_status=HandoverSignatureStatus.EXCEPTION,
        created_at__range=(pstart, pend),
    ).count()
    return {
        "value": current,
        "previous_period_value": previous,
        "trend_percentage": _trend(current, previous),
    }


def calculate_inventory_available(period: str) -> dict[str, Any]:
    _, end, _, prev_end = get_period_bounds(period=period)
    current = (
        InventoryItem.objects.filter(
            is_active=True, is_deleted=False, created_at__lte=end
        ).aggregate(total=models.Sum("reported_inventory_quantity"))["total"]
        or 0
    )
    previous = (
        InventoryItem.objects.filter(
            is_active=True, is_deleted=False, created_at__lte=prev_end
        ).aggregate(total=models.Sum("reported_inventory_quantity"))["total"]
        or 0
    )
    return {
        "value": current,
        "previous_period_value": previous,
        "trend_percentage": _trend(current, previous),
    }


def calculate_inventory_reserved(period: str) -> dict[str, Any]:
    start, end, pstart, pend = get_period_bounds(period=period)
    current = InventoryAvailability.objects.filter(
        status=InventoryAvailabilityStatus.RESERVED,
        start_at__lte=end,
        end_at__gte=start,
        is_deleted=False,
    ).count()
    previous = InventoryAvailability.objects.filter(
        status=InventoryAvailabilityStatus.RESERVED,
        start_at__lte=pend,
        end_at__gte=pstart,
        is_deleted=False,
    ).count()
    return {
        "value": current,
        "previous_period_value": previous,
        "trend_percentage": _trend(current, previous),
    }


def calculate_inventory_dispatched(period: str) -> dict[str, Any]:
    start, end, pstart, pend = get_period_bounds(period=period)
    current = (
        InventoryStockMovement.objects.filter(
            movement_type=InventoryStockMovementType.OUTBOUND_DELIVERY,
            effective_at__range=(start, end),
        ).aggregate(total=models.Sum("quantity"))["total"]
        or 0
    )
    previous = (
        InventoryStockMovement.objects.filter(
            movement_type=InventoryStockMovementType.OUTBOUND_DELIVERY,
            effective_at__range=(pstart, pend),
        ).aggregate(total=models.Sum("quantity"))["total"]
        or 0
    )
    return {
        "value": current,
        "previous_period_value": previous,
        "trend_percentage": _trend(current, previous),
    }


def calculate_inventory_returned(period: str) -> dict[str, Any]:
    start, end, pstart, pend = get_period_bounds(period=period)
    current = (
        InventoryStockMovement.objects.filter(
            movement_type=InventoryStockMovementType.INBOUND_RETURN,
            effective_at__range=(start, end),
        ).aggregate(total=models.Sum("quantity"))["total"]
        or 0
    )
    previous = (
        InventoryStockMovement.objects.filter(
            movement_type=InventoryStockMovementType.INBOUND_RETURN,
            effective_at__range=(pstart, pend),
        ).aggregate(total=models.Sum("quantity"))["total"]
        or 0
    )
    return {
        "value": current,
        "previous_period_value": previous,
        "trend_percentage": _trend(current, previous),
    }


def calculate_inventory_utilization(period: str) -> dict[str, Any]:
    start, end, pstart, pend = get_period_bounds(period=period)
    dispatched_current = (
        InventoryStockMovement.objects.filter(
            movement_type=InventoryStockMovementType.OUTBOUND_DELIVERY,
            effective_at__range=(start, end),
        ).aggregate(total=models.Sum("quantity"))["total"]
        or 0
    )
    available = (
        InventoryItem.objects.filter(is_active=True, is_deleted=False).aggregate(
            total=models.Sum("reported_inventory_quantity")
        )["total"]
        or 0
    )
    rate = (dispatched_current / available * 100) if available > 0 else 0.0

    dispatched_previous = (
        InventoryStockMovement.objects.filter(
            movement_type=InventoryStockMovementType.OUTBOUND_DELIVERY,
            effective_at__range=(pstart, pend),
        ).aggregate(total=models.Sum("quantity"))["total"]
        or 0
    )
    prev_rate = (dispatched_previous / available * 100) if available > 0 else 0.0
    return {
        "value": round(rate, 2),
        "previous_period_value": round(prev_rate, 2),
        "trend_percentage": _trend(rate, prev_rate),
    }


def calculate_inventory_breakage(period: str) -> dict[str, Any]:
    start, end, pstart, pend = get_period_bounds(period=period)
    current = (
        InventoryStockMovement.objects.filter(
            movement_type=InventoryStockMovementType.DAMAGE,
            effective_at__range=(start, end),
        ).aggregate(total=models.Sum("quantity"))["total"]
        or 0
    )
    previous = (
        InventoryStockMovement.objects.filter(
            movement_type=InventoryStockMovementType.DAMAGE,
            effective_at__range=(pstart, pend),
        ).aggregate(total=models.Sum("quantity"))["total"]
        or 0
    )
    return {
        "value": current,
        "previous_period_value": previous,
        "trend_percentage": _trend(current, previous),
    }


def calculate_inventory_loss(period: str) -> dict[str, Any]:
    start, end, pstart, pend = get_period_bounds(period=period)
    current = (
        InventoryStockMovement.objects.filter(
            movement_type=InventoryStockMovementType.LOSS,
            effective_at__range=(start, end),
        ).aggregate(total=models.Sum("quantity"))["total"]
        or 0
    )
    previous = (
        InventoryStockMovement.objects.filter(
            movement_type=InventoryStockMovementType.LOSS,
            effective_at__range=(pstart, pend),
        ).aggregate(total=models.Sum("quantity"))["total"]
        or 0
    )
    return {
        "value": current,
        "previous_period_value": previous,
        "trend_percentage": _trend(current, previous),
    }


def calculate_doc_contract(period: str) -> dict[str, Any]:
    start, end, pstart, pend = get_period_bounds(period=period)
    current = DocumentInstance.objects.filter(
        created_at__range=(start, end),
        template_key__icontains="contract",
    ).count()
    previous = DocumentInstance.objects.filter(
        created_at__range=(pstart, pend),
        template_key__icontains="contract",
    ).count()
    return {
        "value": current,
        "previous_period_value": previous,
        "trend_percentage": _trend(current, previous),
    }


def calculate_doc_amendment(period: str) -> dict[str, Any]:
    start, end, pstart, pend = get_period_bounds(period=period)
    current = DocumentInstance.objects.filter(
        created_at__range=(start, end),
        template_key__icontains="amendment",
    ).count()
    previous = DocumentInstance.objects.filter(
        created_at__range=(pstart, pend),
        template_key__icontains="amendment",
    ).count()
    return {
        "value": current,
        "previous_period_value": previous,
        "trend_percentage": _trend(current, previous),
    }


def calculate_doc_delivery_note(period: str) -> dict[str, Any]:
    start, end, pstart, pend = get_period_bounds(period=period)
    current = DocumentInstance.objects.filter(
        created_at__range=(start, end),
        template_key__icontains="delivery",
    ).count()
    previous = DocumentInstance.objects.filter(
        created_at__range=(pstart, pend),
        template_key__icontains="delivery",
    ).count()
    return {
        "value": current,
        "previous_period_value": previous,
        "trend_percentage": _trend(current, previous),
    }


def calculate_doc_missing_signature(period: str) -> dict[str, Any]:
    start, end, pstart, pend = get_period_bounds(period=period)
    current = LogisticsEvent.objects.filter(
        signature_required=True,
        signature_received=False,
        created_at__range=(start, end),
    ).count()
    previous = LogisticsEvent.objects.filter(
        signature_required=True,
        signature_received=False,
        created_at__range=(pstart, pend),
    ).count()
    return {
        "value": current,
        "previous_period_value": previous,
        "trend_percentage": _trend(current, previous),
    }


# ----------------------------------------------------------------------
# KPI dispatcher
# ----------------------------------------------------------------------
CATEGORY_KPIS: dict[str, list[str]] = {
    ReportCategory.RESERVATIONS.value: [
        ReportKpi.RESERVATION_CREATED.value,
        ReportKpi.RESERVATION_CONFIRMED.value,
        ReportKpi.RESERVATION_CANCELLED.value,
        ReportKpi.RESERVATION_SCOPE_SPLIT.value,
    ],
    ReportCategory.SALES_BILLING.value: [
        ReportKpi.REVENUE_INVOICED.value,
        ReportKpi.REVENUE_COLLECTED.value,
        ReportKpi.REVENUE_OUTSTANDING.value,
        ReportKpi.CREDIT_NOTE_TOTAL.value,
        ReportKpi.REFUND_TOTAL.value,
    ],
    ReportCategory.PAYMENTS.value: [
        ReportKpi.PAYMENT_METHOD_SPLIT.value,
        ReportKpi.PAYMENT_DUE_DATE.value,
        ReportKpi.PAYMENT_INTERIM.value,
        ReportKpi.PAYMENT_RECONCILED.value,
    ],
    ReportCategory.PROSPECTS.value: [
        ReportKpi.PROSPECT_FUNNEL.value,
        ReportKpi.PROSPECT_CONVERSION_RATE.value,
        ReportKpi.PROSPECT_DELAY.value,
        ReportKpi.PROSPECT_OVERDUE_RECALL.value,
    ],
    ReportCategory.LOGISTICS.value: [
        ReportKpi.LOGISTICS_PREPARED.value,
        ReportKpi.LOGISTICS_DELIVERED.value,
        ReportKpi.LOGISTICS_RETURNED.value,
        ReportKpi.LOGISTICS_DELAY.value,
        ReportKpi.LOGISTICS_EXCEPTION.value,
    ],
    ReportCategory.INVENTORY.value: [
        ReportKpi.INVENTORY_AVAILABLE.value,
        ReportKpi.INVENTORY_RESERVED.value,
        ReportKpi.INVENTORY_DISPATCHED.value,
        ReportKpi.INVENTORY_RETURNED.value,
        ReportKpi.INVENTORY_UTILIZATION.value,
        ReportKpi.INVENTORY_BREAKAGE.value,
        ReportKpi.INVENTORY_LOSS.value,
    ],
    ReportCategory.DOCUMENTS.value: [
        ReportKpi.DOC_CONTRACT.value,
        ReportKpi.DOC_AMENDMENT.value,
        ReportKpi.DOC_DELIVERY_NOTE.value,
        ReportKpi.DOC_MISSING_SIGNATURE.value,
    ],
}

KPI_CALCULATORS: dict[str, Callable[[str], dict[str, Any]]] = {
    ReportKpi.RESERVATION_CREATED.value: calculate_reservation_created,
    ReportKpi.RESERVATION_CONFIRMED.value: calculate_reservation_confirmed,
    ReportKpi.RESERVATION_CANCELLED.value: calculate_reservation_cancelled,
    ReportKpi.RESERVATION_SCOPE_SPLIT.value: calculate_reservation_scope_split,
    ReportKpi.REVENUE_INVOICED.value: calculate_revenue_invoiced,
    ReportKpi.REVENUE_COLLECTED.value: calculate_revenue_collected,
    ReportKpi.REVENUE_OUTSTANDING.value: calculate_revenue_outstanding,
    ReportKpi.CREDIT_NOTE_TOTAL.value: calculate_credit_note_total,
    ReportKpi.REFUND_TOTAL.value: calculate_refund_total,
    ReportKpi.PAYMENT_METHOD_SPLIT.value: calculate_payment_method_split,
    ReportKpi.PAYMENT_DUE_DATE.value: calculate_payment_due_date,
    ReportKpi.PAYMENT_INTERIM.value: calculate_payment_interim,
    ReportKpi.PAYMENT_RECONCILED.value: calculate_payment_reconciled,
    ReportKpi.PROSPECT_FUNNEL.value: calculate_prospect_funnel,
    ReportKpi.PROSPECT_CONVERSION_RATE.value: calculate_prospect_conversion_rate,
    ReportKpi.PROSPECT_DELAY.value: calculate_prospect_delay,
    ReportKpi.PROSPECT_OVERDUE_RECALL.value: calculate_prospect_overdue_recall,
    ReportKpi.LOGISTICS_PREPARED.value: calculate_logistics_prepared,
    ReportKpi.LOGISTICS_DELIVERED.value: calculate_logistics_delivered,
    ReportKpi.LOGISTICS_RETURNED.value: calculate_logistics_returned,
    ReportKpi.LOGISTICS_DELAY.value: calculate_logistics_delay,
    ReportKpi.LOGISTICS_EXCEPTION.value: calculate_logistics_exception,
    ReportKpi.INVENTORY_AVAILABLE.value: calculate_inventory_available,
    ReportKpi.INVENTORY_RESERVED.value: calculate_inventory_reserved,
    ReportKpi.INVENTORY_DISPATCHED.value: calculate_inventory_dispatched,
    ReportKpi.INVENTORY_RETURNED.value: calculate_inventory_returned,
    ReportKpi.INVENTORY_UTILIZATION.value: calculate_inventory_utilization,
    ReportKpi.INVENTORY_BREAKAGE.value: calculate_inventory_breakage,
    ReportKpi.INVENTORY_LOSS.value: calculate_inventory_loss,
    ReportKpi.DOC_CONTRACT.value: calculate_doc_contract,
    ReportKpi.DOC_AMENDMENT.value: calculate_doc_amendment,
    ReportKpi.DOC_DELIVERY_NOTE.value: calculate_doc_delivery_note,
    ReportKpi.DOC_MISSING_SIGNATURE.value: calculate_doc_missing_signature,
}
