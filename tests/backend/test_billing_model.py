from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError
from django.utils import timezone
from tests.backend.test_inventory_damage_loss_settlement_execution_services import (
    _validated_settlement,
)

from apps.billing.models import (
    BillingInvoice,
    BillingInvoiceSettlement,
    BillingInvoiceSourceKind,
    BillingInvoiceStatus,
)
from apps.documents.models import DocumentInstanceStatus
from apps.inventory.services import (
    create_inventory_damage_loss_settlement_execution,
    execute_inventory_damage_loss_settlement_execution,
)
from apps.payments.models import PaymentStatus
from apps.payments.services import create_payment

pytestmark = pytest.mark.django_db


def _issued_invoice(django_user_model):
    from apps.billing.services import issue_billing_invoice_for_excess_receivable

    actor, reservation_draft, settlement = _validated_settlement(
        django_user_model,
        caution_amount=Decimal("10000.00"),
        unit_amount=Decimal("25000.00"),
    )
    execution = create_inventory_damage_loss_settlement_execution(
        actor=actor,
        settlement=settlement,
    )
    result = execute_inventory_damage_loss_settlement_execution(execution=execution, actor=actor)
    invoice = issue_billing_invoice_for_excess_receivable(
        excess_receivable=result.excess_receivable,
        actor=actor,
    )
    return actor, reservation_draft, result.excess_receivable, invoice


def test_billing_invoice_requires_generated_document(django_user_model) -> None:
    actor, reservation_draft, excess_receivable, invoice = _issued_invoice(django_user_model)
    invoice.document_instance.status = DocumentInstanceStatus.PREPARED
    invoice = BillingInvoice(
        excess_receivable=excess_receivable,
        document_instance=invoice.document_instance,
        reservation_draft=reservation_draft,
        source_kind=BillingInvoiceSourceKind.INVENTORY_DAMAGE_LOSS_EXCESS_RECEIVABLE,
        invoice_status=BillingInvoiceStatus.OPEN,
        amount=excess_receivable.amount,
        issued_at=timezone.now(),
        created_by=actor,
        updated_by=actor,
    )

    with pytest.raises(ValidationError) as error_info:
        invoice.full_clean()

    assert "document_instance" in error_info.value.message_dict


def test_billing_settlement_requires_confirmed_payment(django_user_model) -> None:
    actor, reservation_draft, _, invoice = _issued_invoice(django_user_model)
    payment = create_payment(
        actor=actor,
        reservation_draft=reservation_draft,
        payment_kind="other",
        payment_method="cash",
        payment_status=PaymentStatus.PENDING,
        amount=invoice.amount,
        source_label="Pending commercial payment",
    )
    settlement = BillingInvoiceSettlement(
        invoice=invoice,
        payment=payment,
        amount=invoice.amount,
        settled_at=timezone.now(),
        settled_by=actor,
        created_by=actor,
        updated_by=actor,
    )

    with pytest.raises(ValidationError) as error_info:
        settlement.full_clean()

    assert "payment" in error_info.value.message_dict
