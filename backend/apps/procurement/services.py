from __future__ import annotations

from typing import Any

from django.db import transaction

from apps.audit.services import record_audit_event_on_commit
from apps.procurement.models import PurchaseOrder, QuickExpense


@transaction.atomic
def create_purchase_order(*, actor: object | None, validated_data: dict[str, Any]) -> PurchaseOrder:
    purchase_order = PurchaseOrder(
        **validated_data,
        created_by=actor,
        updated_by=actor,
    )
    purchase_order.full_clean()
    purchase_order.save()
    record_audit_event_on_commit(
        actor=actor,
        action="procurement.purchase_order_created",
        target_type="purchase_order",
        target_id=str(purchase_order.id),
        metadata={
            "reference": purchase_order.reference,
            "supplier_name": purchase_order.supplier_name,
            "amount": str(purchase_order.amount),
            "status": purchase_order.status,
        },
    )
    return purchase_order


@transaction.atomic
def update_purchase_order(
    *, actor: object | None, instance: PurchaseOrder, validated_data: dict[str, Any]
) -> PurchaseOrder:
    for field, value in validated_data.items():
        setattr(instance, field, value)
    instance.updated_by = actor
    instance.full_clean()
    instance.save()
    record_audit_event_on_commit(
        actor=actor,
        action="procurement.purchase_order_updated",
        target_type="purchase_order",
        target_id=str(instance.id),
        metadata={
            "reference": instance.reference,
            "status": instance.status,
            "amount": str(instance.amount),
        },
    )
    return instance


@transaction.atomic
def delete_purchase_order(*, actor: object | None, instance: PurchaseOrder) -> None:
    order_id = str(instance.id)
    ref = instance.reference
    instance.delete()
    record_audit_event_on_commit(
        actor=actor,
        action="procurement.purchase_order_deleted",
        target_type="purchase_order",
        target_id=order_id,
        metadata={"reference": ref},
    )


@transaction.atomic
def create_quick_expense(*, actor: object | None, validated_data: dict[str, Any]) -> QuickExpense:
    expense = QuickExpense(
        **validated_data,
        recorded_by=actor,
    )
    expense.full_clean()
    expense.save()
    record_audit_event_on_commit(
        actor=actor,
        action="procurement.quick_expense_created",
        target_type="quick_expense",
        target_id=str(expense.id),
        metadata={
            "description": expense.description,
            "category": str(expense.category),
            "amount": str(expense.amount),
        },
    )
    return expense


@transaction.atomic
def delete_quick_expense(*, actor: object | None, instance: QuickExpense) -> None:
    exp_id = str(instance.id)
    desc = instance.description
    instance.delete()
    record_audit_event_on_commit(
        actor=actor,
        action="procurement.quick_expense_deleted",
        target_type="quick_expense",
        target_id=exp_id,
        metadata={"description": desc},
    )
