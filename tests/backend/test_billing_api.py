from datetime import timedelta
from decimal import Decimal

import pytest
from tests.backend.test_inventory_damage_loss_settlement_execution_services import (
    _validated_settlement,
)

from apps.billing.models import BillingInvoice
from apps.billing.services import settle_billing_invoice
from apps.inventory.services import (
    create_inventory_damage_loss_settlement_execution,
    execute_inventory_damage_loss_settlement_execution,
)
from apps.payments.models import PaymentKind, PaymentMethod, PaymentStatus
from apps.payments.services import confirm_payment, create_payment

pytestmark = pytest.mark.django_db

BILLING_INVOICE_LIST_URL = "/api/v1/billing/invoices/"


@pytest.fixture
def authenticated_client(client, django_user_model):
    user = django_user_model.objects.create_user(
        username="billing-api-user",
        password="test-pass",
    )
    client.force_login(user)
    return client


@pytest.fixture
def sensitive_user(django_user_model):
    return django_user_model.objects.create_user(
        username="billing-sensitive-user",
        password="test-pass",
        is_staff=True,
    )


@pytest.fixture
def sensitive_client(sensitive_user):
    from django.test import Client

    client = Client()
    client.force_login(sensitive_user)
    return client


def _issued_invoice(
    django_user_model,
    *,
    caution_amount=Decimal("10000.00"),
    unit_amount=Decimal("25000.00"),
    quantity=1,
):
    from apps.billing.services import issue_billing_invoice_for_excess_receivable

    actor, reservation_draft, settlement = _validated_settlement(
        django_user_model,
        caution_amount=caution_amount,
        unit_amount=unit_amount,
        quantity=quantity,
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
    return actor, reservation_draft, invoice


def test_billing_invoice_list_requires_authentication(client) -> None:
    response = client.get(BILLING_INVOICE_LIST_URL)

    assert response.status_code in {401, 403}


def test_sensitive_user_can_settle_and_authenticated_user_can_list_retrieve_billing_invoice(
    sensitive_client,
    authenticated_client,
    django_user_model,
) -> None:
    actor, reservation_draft, invoice = _issued_invoice(django_user_model)
    payment = create_payment(
        actor=actor,
        reservation_draft=reservation_draft,
        payment_kind=PaymentKind.BALANCE,
        payment_method=PaymentMethod.MOBILE_MONEY,
        payment_status=PaymentStatus.PENDING,
        amount=invoice.amount,
        source_label="Billing API settlement",
    )

    confirmed_payment = confirm_payment(payment=payment, actor=actor).payment

    list_response = authenticated_client.get(BILLING_INVOICE_LIST_URL)
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1
    assert list_response.json()[0]["invoice_status"] == "open"

    detail_response = authenticated_client.get(f"{BILLING_INVOICE_LIST_URL}{invoice.id}/")
    assert detail_response.status_code == 200
    assert detail_response.json()["id"] == str(invoice.id)

    settle_response = sensitive_client.post(
        f"{BILLING_INVOICE_LIST_URL}{invoice.id}/settle/",
        data={"payment": str(confirmed_payment.id), "notes": "API settlement"},
        content_type="application/json",
    )
    assert settle_response.status_code == 200
    payload = settle_response.json()
    assert payload["invoice_status"] == "settled"
    assert payload["settlement"]["payment"]["id"] == str(confirmed_payment.id)
    assert BillingInvoice.objects.get(pk=invoice.pk).invoice_status == "settled"


def test_billing_invoice_settle_requires_authentication(client) -> None:
    response = client.post(
        f"{BILLING_INVOICE_LIST_URL}00000000-0000-0000-0000-000000000000/settle/",
        data={"payment": "00000000-0000-0000-0000-000000000000"},
        content_type="application/json",
    )

    assert response.status_code in {401, 403}


def test_billing_invoice_settle_requires_sensitive_access(authenticated_client) -> None:
    response = authenticated_client.post(
        f"{BILLING_INVOICE_LIST_URL}00000000-0000-0000-0000-000000000000/settle/",
        data={"payment": "00000000-0000-0000-0000-000000000000"},
        content_type="application/json",
    )

    assert response.status_code == 403


def test_inventory_excess_receivable_generate_invoice_creates_billing_invoice(
    sensitive_client,
    django_user_model,
) -> None:
    actor, _, settlement = _validated_settlement(
        django_user_model,
        caution_amount=Decimal("10000.00"),
        unit_amount=Decimal("25000.00"),
    )
    execution = create_inventory_damage_loss_settlement_execution(
        actor=actor,
        settlement=settlement,
    )
    result = execute_inventory_damage_loss_settlement_execution(execution=execution, actor=actor)

    response = sensitive_client.post(
        f"/api/v1/inventory/excess-receivables/{result.excess_receivable.id}/generate-invoice/",
        content_type="application/json",
    )

    assert response.status_code == 200
    invoice = BillingInvoice.objects.get(excess_receivable=result.excess_receivable)
    assert invoice.document_instance is not None
    assert invoice.document_instance.template_key == "titan.breakage_repair_invoice.v1"

    from django.core.files.storage import default_storage

    content = default_storage.open(invoice.document_instance.storage_path).read().decode("utf-8")
    assert "DETAILS DE CASSE" in content
    assert "25 000,00" in content
    assert "15 000,00" in content
    assert "Quinze mille Ariary" in content


def test_inventory_excess_receivable_generate_invoice_hahitantsoa_event(
    sensitive_client,
    django_user_model,
) -> None:
    from django.core.files.storage import default_storage
    from django.utils import timezone

    from apps.customers.models import Customer
    from apps.hahitantsoa.models import HahitantsoaEventDraft
    from apps.inventory.models import InventoryItem
    from apps.inventory.services import (
        create_inventory_damage_loss_settlement,
        create_inventory_return_operation,
        validate_inventory_damage_loss_settlement,
        validate_inventory_return_operation,
    )

    actor = django_user_model.objects.create_user(
        username="hahi-excess-user",
        password="test-pass",
    )
    customer = Customer.objects.create(
        display_name="Client Hahitantsoa Casse",
        email="hahi-casse@example.com",
        phone="+261340011223",
        address="Antananarivo",
    )
    start_at = timezone.now().replace(microsecond=0) + timedelta(days=3)
    event_draft = HahitantsoaEventDraft.objects.create(
        customer=customer,
        event_name="Mariage Casse Test",
        start_at=start_at,
        end_at=start_at + timedelta(hours=6),
    )
    item = InventoryItem.objects.create(
        name="Assiette cassée test",
        kind="material",
        breakage_price=Decimal("15000.00"),
    )
    return_op = create_inventory_return_operation(
        actor=actor,
        hahitantsoa_event_draft=event_draft,
        lines=[
            {
                "inventory_item": item,
                "expected_quantity": 5,
                "returned_quantity": 3,
                "damaged_quantity": 2,
                "missing_quantity": 0,
                "condition_status": "mixed",
                "notes": "Deux assiettes fêlées",
            }
        ],
    )
    return_result = validate_inventory_return_operation(
        return_operation=return_op,
        actor=actor,
    )
    caution_payment = create_payment(
        actor=actor,
        hahitantsoa_event_draft=event_draft,
        payment_kind=PaymentKind.CAUTION,
        payment_method=PaymentMethod.CASH,
        payment_status=PaymentStatus.PENDING,
        amount=Decimal("10000.00"),
        source_label="Hahi caution",
    )
    confirm_payment(payment=caution_payment, actor=actor)

    settlement = create_inventory_damage_loss_settlement(
        actor=actor,
        return_operation=return_result.return_operation,
        lines=[
            {
                "return_operation_line": return_result.return_operation.lines.get(),
                "settlement_line_kind": "damage",
                "quantity": 2,
                "unit_amount": Decimal("15000.00"),
                "notes": "Deux assiettes fêlées",
            }
        ],
    )
    settlement_result = validate_inventory_damage_loss_settlement(
        settlement=settlement,
        actor=actor,
    )
    assert settlement_result.settlement.damage_loss_total == Decimal("30000.00")
    assert settlement_result.settlement.caution_available == Decimal("10000.00")
    assert settlement_result.settlement.caution_applied == Decimal("10000.00")
    assert settlement_result.settlement.excess_due == Decimal("20000.00")

    execution = create_inventory_damage_loss_settlement_execution(
        actor=actor,
        settlement=settlement_result.settlement,
    )
    exec_result = execute_inventory_damage_loss_settlement_execution(
        execution=execution, actor=actor
    )
    assert exec_result.excess_receivable is not None

    response = sensitive_client.post(
        f"/api/v1/inventory/excess-receivables/{exec_result.excess_receivable.id}/generate-invoice/",
        content_type="application/json",
    )
    assert response.status_code == 200

    invoice = BillingInvoice.objects.get(excess_receivable=exec_result.excess_receivable)
    assert invoice.hahitantsoa_event_draft == event_draft
    assert invoice.reservation_draft is None
    assert invoice.amount == Decimal("20000.00")
    assert invoice.document_instance.template_key == "hahitantsoa.breakage_repair_invoice.v1"

    content = default_storage.open(invoice.document_instance.storage_path).read().decode("utf-8")
    assert "DETAILS DE CASSE" in content
    assert "Client Hahitantsoa Casse" in content
    assert "Assiette cassée test" in content
    assert "30 000,00" in content
    assert "10 000,00" in content
    assert "20 000,00" in content
    assert "Vingt mille Ariary" in content


def test_inventory_excess_receivable_generate_invoice_requires_sensitive_access(
    authenticated_client,
    django_user_model,
) -> None:
    actor, _, settlement = _validated_settlement(
        django_user_model,
        caution_amount=Decimal("10000.00"),
        unit_amount=Decimal("25000.00"),
    )
    execution = create_inventory_damage_loss_settlement_execution(
        actor=actor,
        settlement=settlement,
    )
    result = execute_inventory_damage_loss_settlement_execution(execution=execution, actor=actor)

    response = authenticated_client.post(
        f"/api/v1/inventory/excess-receivables/{result.excess_receivable.id}/generate-invoice/",
        content_type="application/json",
    )

    assert response.status_code == 403


def test_billing_invoice_list_filter_by_status(
    sensitive_client,
    authenticated_client,
    django_user_model,
):
    actor1, rd1, open_invoice = _issued_invoice(django_user_model, quantity=1)
    actor2, rd2, settled_invoice = _issued_invoice(django_user_model, quantity=2)

    payment = create_payment(
        actor=actor2,
        reservation_draft=rd2,
        payment_kind=PaymentKind.BALANCE,
        payment_method=PaymentMethod.MOBILE_MONEY,
        payment_status=PaymentStatus.PENDING,
        amount=settled_invoice.amount,
        source_label="Billing settlement",
    )
    confirmed_payment = confirm_payment(payment=payment, actor=actor2).payment

    sensitive_client.post(
        f"{BILLING_INVOICE_LIST_URL}{settled_invoice.id}/settle/",
        data={"payment": str(confirmed_payment.id)},
        content_type="application/json",
    )

    response = authenticated_client.get(f"{BILLING_INVOICE_LIST_URL}?status=open")
    assert response.status_code == 200
    results = response.json()
    assert len(results) == 1
    assert results[0]["id"] == str(open_invoice.id)
    assert results[0]["invoice_status"] == "open"


def test_billing_invoice_list_filter_by_source_kind(authenticated_client, django_user_model):
    actor, _, invoice = _issued_invoice(django_user_model)

    response = authenticated_client.get(
        f"{BILLING_INVOICE_LIST_URL}?source_kind=inventory_damage_loss_excess_receivable"
    )
    assert response.status_code == 200
    results = response.json()
    assert len(results) == 1
    assert results[0]["id"] == str(invoice.id)


def test_billing_invoice_list_filter_by_reservation_draft_id(
    authenticated_client, django_user_model
):
    actor1, rd1, invoice1 = _issued_invoice(django_user_model, quantity=1)
    actor2, rd2, invoice2 = _issued_invoice(django_user_model, quantity=2)

    response = authenticated_client.get(f"{BILLING_INVOICE_LIST_URL}?reservation_draft_id={rd1.id}")
    assert response.status_code == 200
    results = response.json()
    assert len(results) == 1
    assert results[0]["id"] == str(invoice1.id)


def test_billing_invoice_list_filter_by_amount_range(authenticated_client, django_user_model):
    actor1, _, low_invoice = _issued_invoice(
        django_user_model,
        caution_amount=Decimal("5000.00"),
        unit_amount=Decimal("15000.00"),
    )
    actor2, _, high_invoice = _issued_invoice(
        django_user_model,
        caution_amount=Decimal("10000.00"),
        unit_amount=Decimal("40000.00"),
    )

    assert low_invoice.amount < high_invoice.amount

    mid_amount = (low_invoice.amount + high_invoice.amount) / 2

    response = authenticated_client.get(
        f"{BILLING_INVOICE_LIST_URL}?min_amount={low_invoice.amount}&max_amount={mid_amount}"
    )
    assert response.status_code == 200
    results = response.json()
    assert len(results) == 1
    assert Decimal(results[0]["amount"]) == low_invoice.amount


def test_billing_invoice_list_filter_by_issued_date_range(authenticated_client, django_user_model):
    actor, _, invoice = _issued_invoice(django_user_model)

    past = (invoice.issued_at - timedelta(days=1)).strftime("%Y-%m-%dT%H:%M:%S")
    future = (invoice.issued_at + timedelta(days=1)).strftime("%Y-%m-%dT%H:%M:%S")

    response = authenticated_client.get(
        f"{BILLING_INVOICE_LIST_URL}?issued_after={past}&issued_before={future}"
    )
    assert response.status_code == 200
    results = response.json()
    assert len(results) == 1
    assert results[0]["id"] == str(invoice.id)

    too_past = (invoice.issued_at + timedelta(days=1)).strftime("%Y-%m-%dT%H:%M:%S")
    response = authenticated_client.get(f"{BILLING_INVOICE_LIST_URL}?issued_after={too_past}")
    assert response.status_code == 200
    assert len(response.json()) == 0


def test_billing_invoice_list_search_by_customer_name(authenticated_client, django_user_model):
    actor, _, invoice = _issued_invoice(django_user_model)

    response = authenticated_client.get(f"{BILLING_INVOICE_LIST_URL}?search=Settlement+model")
    assert response.status_code == 200
    results = response.json()
    assert len(results) == 1
    assert results[0]["id"] == str(invoice.id)

    response = authenticated_client.get(f"{BILLING_INVOICE_LIST_URL}?search=NonExistentCustomer")
    assert response.status_code == 200
    assert len(response.json()) == 0


def test_billing_invoice_detail_exposes_outstanding_closeout_summary(
    authenticated_client, django_user_model
) -> None:
    actor, _, invoice = _issued_invoice(django_user_model)

    response = authenticated_client.get(f"{BILLING_INVOICE_LIST_URL}{invoice.id}/")

    assert response.status_code == 200
    payload = response.json()
    assert payload["closeout_status"] == "outstanding"
    assert Decimal(str(payload["amount_settled"])) == Decimal("0.00")
    assert Decimal(str(payload["amount_refunded"])) == Decimal("0.00")
    assert Decimal(str(payload["remaining_balance"])) == invoice.amount


def test_billing_invoice_detail_exposes_settled_closeout_summary(
    sensitive_client, authenticated_client, django_user_model
) -> None:
    actor, reservation_draft, invoice = _issued_invoice(django_user_model)
    payment = create_payment(
        actor=actor,
        reservation_draft=reservation_draft,
        payment_kind=PaymentKind.BALANCE,
        payment_method=PaymentMethod.BANK_TRANSFER,
        payment_status=PaymentStatus.PENDING,
        amount=invoice.amount,
        source_label="Settled closeout summary",
    )
    confirmed_payment = confirm_payment(payment=payment, actor=actor).payment
    settle_response = sensitive_client.post(
        f"{BILLING_INVOICE_LIST_URL}{invoice.id}/settle/",
        data={"payment": str(confirmed_payment.id)},
        content_type="application/json",
    )
    assert settle_response.status_code == 200

    response = authenticated_client.get(f"{BILLING_INVOICE_LIST_URL}{invoice.id}/")

    assert response.status_code == 200
    payload = response.json()
    assert payload["closeout_status"] == "settled"
    assert Decimal(str(payload["amount_settled"])) == invoice.amount
    assert Decimal(str(payload["amount_refunded"])) == Decimal("0.00")
    assert Decimal(str(payload["remaining_balance"])) == Decimal("0.00")


def test_billing_invoice_list_filter_by_closeout_status_outstanding(
    authenticated_client, django_user_model
) -> None:
    actor_open, _, open_invoice = _issued_invoice(django_user_model, quantity=1)
    actor_paid, rd_paid, paid_invoice = _issued_invoice(django_user_model, quantity=2)
    payment = create_payment(
        actor=actor_paid,
        reservation_draft=rd_paid,
        payment_kind=PaymentKind.BALANCE,
        payment_method=PaymentMethod.MOBILE_MONEY,
        payment_status=PaymentStatus.PENDING,
        amount=paid_invoice.amount,
        source_label="Filter settled invoice",
    )
    confirmed_payment = confirm_payment(payment=payment, actor=actor_paid).payment
    settle_billing_invoice(invoice=paid_invoice, payment=confirmed_payment, actor=actor_paid)

    response = authenticated_client.get(f"{BILLING_INVOICE_LIST_URL}?closeout_status=outstanding")

    assert response.status_code == 200
    results = response.json()
    assert [item["id"] for item in results] == [str(open_invoice.id)]
    assert results[0]["closeout_status"] == "outstanding"


def test_billing_invoice_list_filter_by_closeout_status_settled(
    authenticated_client, django_user_model
) -> None:
    actor_open, _, open_invoice = _issued_invoice(django_user_model, quantity=1)
    actor_paid, rd_paid, paid_invoice = _issued_invoice(django_user_model, quantity=2)
    payment = create_payment(
        actor=actor_paid,
        reservation_draft=rd_paid,
        payment_kind=PaymentKind.BALANCE,
        payment_method=PaymentMethod.BANK_TRANSFER,
        payment_status=PaymentStatus.PENDING,
        amount=paid_invoice.amount,
        source_label="Filter settled invoice",
    )
    confirmed_payment = confirm_payment(payment=payment, actor=actor_paid).payment
    settle_billing_invoice(invoice=paid_invoice, payment=confirmed_payment, actor=actor_paid)

    response = authenticated_client.get(f"{BILLING_INVOICE_LIST_URL}?closeout_status=settled")

    assert response.status_code == 200
    results = response.json()
    assert [item["id"] for item in results] == [str(paid_invoice.id)]
    assert results[0]["closeout_status"] == "settled"


def test_billing_invoice_list_filter_by_has_remaining_balance(
    authenticated_client, django_user_model
) -> None:
    actor_open, _, open_invoice = _issued_invoice(django_user_model, quantity=1)
    actor_paid, rd_paid, paid_invoice = _issued_invoice(django_user_model, quantity=2)
    payment = create_payment(
        actor=actor_paid,
        reservation_draft=rd_paid,
        payment_kind=PaymentKind.BALANCE,
        payment_method=PaymentMethod.CASH,
        payment_status=PaymentStatus.PENDING,
        amount=paid_invoice.amount,
        source_label="Remaining balance filter",
    )
    confirmed_payment = confirm_payment(payment=payment, actor=actor_paid).payment
    settle_billing_invoice(invoice=paid_invoice, payment=confirmed_payment, actor=actor_paid)

    true_response = authenticated_client.get(
        f"{BILLING_INVOICE_LIST_URL}?has_remaining_balance=true"
    )
    false_response = authenticated_client.get(
        f"{BILLING_INVOICE_LIST_URL}?has_remaining_balance=false"
    )

    assert true_response.status_code == 200
    assert [item["id"] for item in true_response.json()] == [str(open_invoice.id)]
    assert false_response.status_code == 200
    assert [item["id"] for item in false_response.json()] == [str(paid_invoice.id)]


def test_billing_invoice_cancel_requires_authentication(client) -> None:
    response = client.post(
        f"{BILLING_INVOICE_LIST_URL}00000000-0000-0000-0000-000000000000/cancel/",
        data={},
        content_type="application/json",
    )
    assert response.status_code in {401, 403}


def test_billing_invoice_cancel_requires_sensitive_access(authenticated_client) -> None:
    response = authenticated_client.post(
        f"{BILLING_INVOICE_LIST_URL}00000000-0000-0000-0000-000000000000/cancel/",
        data={},
        content_type="application/json",
    )

    assert response.status_code == 403


def test_sensitive_user_can_cancel_open_billing_invoice(
    sensitive_client, django_user_model
) -> None:
    actor, _, invoice = _issued_invoice(django_user_model)

    response = sensitive_client.post(
        f"{BILLING_INVOICE_LIST_URL}{invoice.id}/cancel/",
        data={"notes": "Cancelled by accountant"},
        content_type="application/json",
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["invoice_status"] == "cancelled"
    assert payload["notes"] == "Cancelled by accountant"
    assert BillingInvoice.objects.get(pk=invoice.pk).invoice_status == "cancelled"


def test_billing_invoice_cancel_fails_when_already_settled(
    sensitive_client, django_user_model
) -> None:
    actor, reservation_draft, invoice = _issued_invoice(django_user_model)
    payment = create_payment(
        actor=actor,
        reservation_draft=reservation_draft,
        payment_kind=PaymentKind.BALANCE,
        payment_method=PaymentMethod.MOBILE_MONEY,
        payment_status=PaymentStatus.PENDING,
        amount=invoice.amount,
        source_label="Billing settlement",
    )
    confirmed_payment = confirm_payment(payment=payment, actor=actor).payment

    settle_response = sensitive_client.post(
        f"{BILLING_INVOICE_LIST_URL}{invoice.id}/settle/",
        data={"payment": str(confirmed_payment.id)},
        content_type="application/json",
    )
    assert settle_response.status_code == 200

    cancel_response = sensitive_client.post(
        f"{BILLING_INVOICE_LIST_URL}{invoice.id}/cancel/",
        data={},
        content_type="application/json",
    )
    assert cancel_response.status_code == 400
    payload = cancel_response.json()
    assert payload["code"] == "invalid_billing_invoice_cancel_state"


def test_billing_invoice_cancel_fails_when_already_cancelled(
    sensitive_client, django_user_model
) -> None:
    actor, _, invoice = _issued_invoice(django_user_model)

    sensitive_client.post(
        f"{BILLING_INVOICE_LIST_URL}{invoice.id}/cancel/",
        data={},
        content_type="application/json",
    )

    cancel_response = sensitive_client.post(
        f"{BILLING_INVOICE_LIST_URL}{invoice.id}/cancel/",
        data={},
        content_type="application/json",
    )
    assert cancel_response.status_code == 400
    payload = cancel_response.json()
    assert payload["code"] == "invalid_billing_invoice_cancel_state"


def test_billing_invoice_settle_rejects_payment_already_used(
    sensitive_client,
    django_user_model,
) -> None:
    actor, reservation_draft_a, invoice_a = _issued_invoice(django_user_model)
    payment = create_payment(
        actor=actor,
        reservation_draft=reservation_draft_a,
        payment_kind=PaymentKind.BALANCE,
        payment_method=PaymentMethod.MOBILE_MONEY,
        payment_status=PaymentStatus.PENDING,
        amount=invoice_a.amount,
        source_label="Settle invoice A via API",
    )
    confirmed_payment = confirm_payment(payment=payment, actor=actor).payment

    settle_a = sensitive_client.post(
        f"{BILLING_INVOICE_LIST_URL}{invoice_a.id}/settle/",
        data={"payment": str(confirmed_payment.id)},
        content_type="application/json",
    )
    assert settle_a.status_code == 200

    _, _, invoice_b = _issued_invoice(
        django_user_model,
        caution_amount=Decimal("20000.00"),
        unit_amount=Decimal("35000.00"),
    )

    settle_b = sensitive_client.post(
        f"{BILLING_INVOICE_LIST_URL}{invoice_b.id}/settle/",
        data={"payment": str(confirmed_payment.id)},
        content_type="application/json",
    )
    assert settle_b.status_code == 400
    payload = settle_b.json()
    assert payload["code"] == "billing_settlement_payment_already_used"
    assert BillingInvoice.objects.get(pk=invoice_b.pk).invoice_status == "open"
