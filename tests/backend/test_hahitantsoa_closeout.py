from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier

import pytest
from django.db import close_old_connections
from django.test import Client
from django.utils import timezone

from apps.customers.models import Customer
from apps.documents.models import DocumentInstance, DocumentInstanceStatus
from apps.hahitantsoa.closeout import (
    HahitantsoaCloseoutValidationError,
    closeout_hahitantsoa_event_draft,
    get_hahitantsoa_closeout_summary,
    validate_hahitantsoa_event_closeable,
)
from apps.hahitantsoa.models import (
    HahitantsoaEventCloseout,
    HahitantsoaEventDraft,
    HahitantsoaEventDraftLine,
)
from apps.inventory.models import InventoryItem
from apps.logistics.models import LogisticsEvent
from apps.payments.models import Payment, PaymentMethod, PaymentStatus

pytestmark = pytest.mark.django_db


def _event_draft(*, actor=None, confirmed: bool = True) -> HahitantsoaEventDraft:
    start_at = timezone.now().replace(microsecond=0)
    return HahitantsoaEventDraft.objects.create(
        customer=Customer.objects.create(display_name="Client clôture Hahitantsoa"),
        event_name="Réception de clôture",
        start_at=start_at,
        end_at=start_at + timedelta(hours=4),
        status="confirmed" if confirmed else "draft",
        confirmed_at=start_at if confirmed else None,
        confirmed_by=actor if confirmed else None,
    )


def _actor(django_user_model):
    return django_user_model.objects.create_user(
        username="hahitantsoa-closeout-operator",
        password="test-pass",
        is_staff=True,
    )


def test_confirmed_bare_event_closes_and_replays(django_user_model):
    actor = _actor(django_user_model)
    event_draft = _event_draft(actor=actor)

    result = closeout_hahitantsoa_event_draft(
        event_draft=event_draft,
        actor=actor,
        idempotency_key="hah-closeout-1",
    )

    assert result.event_draft_id == str(event_draft.id)
    assert result.closeout_status == "closed"
    assert HahitantsoaEventCloseout.objects.filter(event_draft=event_draft).count() == 1

    replay = closeout_hahitantsoa_event_draft(
        event_draft=event_draft,
        actor=actor,
        idempotency_key="hah-closeout-1",
    )
    assert replay.replayed is True
    assert replay.closeout_id == result.closeout_id


def test_closeout_rejects_a_different_idempotency_key(django_user_model):
    actor = _actor(django_user_model)
    event_draft = _event_draft(actor=actor)
    closeout_hahitantsoa_event_draft(
        event_draft=event_draft,
        actor=actor,
        idempotency_key="hah-closeout-1",
    )

    with pytest.raises(HahitantsoaCloseoutValidationError) as error:
        closeout_hahitantsoa_event_draft(
            event_draft=event_draft,
            actor=actor,
            idempotency_key="hah-closeout-2",
        )
    assert error.value.code == "closeout_idempotency_key_mismatch"


def test_closeout_blocks_an_unconfirmed_event(django_user_model):
    actor = _actor(django_user_model)
    event_draft = _event_draft(actor=actor, confirmed=False)

    assert "event_draft_not_confirmed" in validate_hahitantsoa_event_closeable(
        event_draft=event_draft
    )
    with pytest.raises(HahitantsoaCloseoutValidationError) as error:
        closeout_hahitantsoa_event_draft(event_draft=event_draft, actor=actor)
    assert error.value.code == "hahitantsoa_event_not_closeable"


def test_summary_reads_the_immutable_closeout_snapshot(django_user_model):
    actor = _actor(django_user_model)
    event_draft = _event_draft(actor=actor)
    result = closeout_hahitantsoa_event_draft(event_draft=event_draft, actor=actor)

    summary = get_hahitantsoa_closeout_summary(event_draft_id=str(event_draft.id))

    assert summary is not None
    assert summary.closeout_id == result.closeout_id
    assert summary.replayed is False


def test_closeout_api_requires_sensitive_access_and_replays(django_user_model):
    operator = _actor(django_user_model)
    event_draft = _event_draft(actor=operator)
    url = f"/api/v1/hahitantsoa/event-drafts/{event_draft.id}/closeout/"
    execute_url = f"{url}execute/"

    anonymous = Client()
    assert anonymous.get(url).status_code in {401, 403}

    client = Client()
    client.force_login(operator)
    summary = client.get(url)
    assert summary.status_code == 200
    assert summary.json()["closeout_status"] == "open"

    first = client.post(execute_url, HTTP_IDEMPOTENCY_KEY="api-closeout-1")
    assert first.status_code == 200
    assert first.json()["closeout_status"] == "closed"

    replay = client.post(execute_url, HTTP_IDEMPOTENCY_KEY="api-closeout-1")
    assert replay.status_code == 200
    assert replay.json()["replayed"] is True

    conflict = client.post(execute_url, HTTP_IDEMPOTENCY_KEY="api-closeout-2")
    assert conflict.status_code == 409


def test_required_handover_signature_needs_a_persisted_closeout_exception(django_user_model):
    actor = _actor(django_user_model)
    event_draft = _event_draft(actor=actor)
    scheduled_at = timezone.now().replace(microsecond=0)
    LogisticsEvent.objects.create(
        hahitantsoa_event_draft=event_draft,
        event_type="handover",
        operation="outbound",
        status="completed",
        scheduled_at=scheduled_at,
        executed_at=scheduled_at,
        signature_required=True,
    )

    assert "handover_signature_or_exception_required" in validate_hahitantsoa_event_closeable(
        event_draft=event_draft
    )
    result = closeout_hahitantsoa_event_draft(
        event_draft=event_draft,
        actor=actor,
        signature_exception_reason="Client indisponible, incident constaté par le responsable.",
    )

    assert result.signature_exception_reason.startswith("Client indisponible")
    assert (
        HahitantsoaEventCloseout.objects.get(event_draft=event_draft).signature_exception_reason
        == result.signature_exception_reason
    )


def test_logistics_event_with_inventory_requires_outbound_return_and_reconciliation(
    django_user_model,
):
    actor = _actor(django_user_model)
    event_draft = _event_draft(actor=actor)
    HahitantsoaEventDraftLine.objects.create(
        event_draft=event_draft,
        inventory_item=InventoryItem.objects.create(name="Table réception", kind="material"),
        quantity=1,
    )

    blockers = validate_hahitantsoa_event_closeable(event_draft=event_draft)

    assert "logistics_outbound_operation_missing" in blockers
    assert "return_operation_missing" in blockers


def test_confirmed_external_payment_blocks_closeout_until_reconciled(django_user_model):
    actor = _actor(django_user_model)
    event_draft = _event_draft(actor=actor)
    receipt = DocumentInstance.objects.create(
        hahitantsoa_event_draft=event_draft,
        customer=event_draft.customer,
        template_key="shared.payment_receipt.v1",
        template_version="v1",
        template_label="Reçu de paiement",
        business_scope="shared",
        document_type="payment_receipt",
        template_status="generated_draft_template",
        template_source_kind="generated_from_brand_style",
        template_source_reference="test",
        template_path="test.html",
        template_preview_path="test.pdf",
        template_validated_by_client=False,
        status=DocumentInstanceStatus.GENERATED,
    )
    Payment.objects.create(
        hahitantsoa_event_draft=event_draft,
        receipt_document=receipt,
        payment_kind="balance",
        payment_method=PaymentMethod.BANK_TRANSFER,
        payment_status=PaymentStatus.CONFIRMED,
        amount="100.00",
        paid_at=timezone.now(),
        confirmed_at=timezone.now(),
        confirmed_by=actor,
    )

    blockers = validate_hahitantsoa_event_closeable(event_draft=event_draft)

    assert "external_payments_unreconciled:1" in blockers


@pytest.mark.django_db(transaction=True)
def test_concurrent_closeout_replay_creates_one_immutable_proof(django_user_model):
    actor = _actor(django_user_model)
    event_draft = _event_draft(actor=actor)
    start_barrier = Barrier(2)

    def execute_closeout():
        close_old_connections()
        try:
            start_barrier.wait(timeout=10)
            result = closeout_hahitantsoa_event_draft(
                event_draft=HahitantsoaEventDraft.objects.get(pk=event_draft.pk),
                actor=django_user_model.objects.get(pk=actor.pk),
                idempotency_key="concurrent-closeout",
            )
            return result.closeout_id
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as executor:
        closeout_ids = list(executor.map(lambda _index: execute_closeout(), range(2)))

    assert closeout_ids[0] == closeout_ids[1]
    assert HahitantsoaEventCloseout.objects.filter(event_draft=event_draft).count() == 1
