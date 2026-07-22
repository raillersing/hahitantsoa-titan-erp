from __future__ import annotations

from datetime import timedelta

import pytest
from django.contrib.auth.models import Group
from django.utils import timezone

import apps.documents.services as document_services
from apps.audit.models import AuditEvent
from apps.customers.models import Customer
from apps.documents.models import DocumentInstance, DocumentInstanceStatus
from apps.documents.services import (
    create_document_instance_from_reservation_draft,
    hahitantsoa_event_draft_document_instance_kwargs,
    prepare_contract_from_proforma,
)
from apps.hahitantsoa.models import HahitantsoaEventDraft, HahitantsoaEventDraftLine
from apps.identity.roles import IdentityRole
from apps.inventory.models import InventoryItem
from apps.reservations.models import ReservationDraft, ReservationDraftLine

pytestmark = pytest.mark.django_db


def _customer() -> Customer:
    return Customer.objects.create(
        display_name="Proforma customer",
        email="proforma@example.test",
        phone="+261340000220",
        address="Antananarivo",
    )


def _item(*, kind: str = "material") -> InventoryItem:
    return InventoryItem.objects.create(
        name="Proforma item",
        kind=kind,
        description="Document action test item",
    )


def _titan_draft() -> ReservationDraft:
    start_at = timezone.now().replace(microsecond=0) + timedelta(days=2)
    draft = ReservationDraft.objects.create(
        customer=_customer(),
        start_at=start_at,
        end_at=start_at + timedelta(hours=4),
        notes="Titan proforma draft",
    )
    ReservationDraftLine.objects.create(
        reservation_draft=draft,
        inventory_item=_item(),
        quantity=1,
        notes="Line",
    )
    return draft


def _hahitantsoa_draft() -> HahitantsoaEventDraft:
    start_at = timezone.now().replace(microsecond=0) + timedelta(days=2)
    draft = HahitantsoaEventDraft.objects.create(
        customer=_customer(),
        event_name="Proforma event",
        start_at=start_at,
        end_at=start_at + timedelta(hours=4),
        notes="Hahitantsoa proforma draft",
    )
    HahitantsoaEventDraftLine.objects.create(
        event_draft=draft,
        inventory_item=_item(kind="article"),
        quantity=1,
        notes="Line",
    )
    return draft


def _titan_proforma(*, actor=None) -> tuple[DocumentInstance, ReservationDraft]:
    draft = _titan_draft()
    return (
        create_document_instance_from_reservation_draft(
            reservation_draft=draft,
            template_key="titan.proforma.v1",
            actor=actor,
        ),
        draft,
    )


def _hahitantsoa_proforma(*, actor=None) -> tuple[DocumentInstance, HahitantsoaEventDraft]:
    draft = _hahitantsoa_draft()
    instance = DocumentInstance.objects.create(
        **hahitantsoa_event_draft_document_instance_kwargs(
            event_draft=draft,
            template_key="hahitantsoa.proforma.v1",
            actor_id=getattr(actor, "pk", None),
            notes="",
        )
    )
    return instance, draft


def _convert_url(instance_id) -> str:
    return f"/api/v1/documents/instances/{instance_id}/convert-to-contract/"


def _void_url(instance_id) -> str:
    return f"/api/v1/documents/instances/{instance_id}/void/"


@pytest.fixture
def regular_client(client, django_user_model):
    user = django_user_model.objects.create_user(username="regular-proforma", password="test-pass")
    client.force_login(user)
    return client


@pytest.fixture
def sensitive_client(client, django_user_model):
    user = django_user_model.objects.create_user(
        username="sensitive-proforma",
        password="test-pass",
        is_staff=True,
    )
    client.force_login(user)
    return client, user


@pytest.mark.parametrize("endpoint", (_convert_url, _void_url))
def test_proforma_actions_require_sensitive_permission(regular_client, endpoint) -> None:
    instance, _ = _titan_proforma()

    response = regular_client.post(endpoint(instance.id), data={}, content_type="application/json")

    assert response.status_code == 403


@pytest.mark.parametrize(
    ("factory", "expected_template_key", "expected_document_type"),
    (
        (_titan_proforma, "titan.material_contract.v1", "material_contract"),
        (_hahitantsoa_proforma, "hahitantsoa.contract.v1", "contract"),
    ),
)
def test_sensitive_actor_converts_registered_proforma_without_confirming_source(
    sensitive_client,
    django_capture_on_commit_callbacks,
    factory,
    expected_template_key,
    expected_document_type,
) -> None:
    client, actor = sensitive_client
    proforma, source_draft = factory(actor=actor)
    source_status = source_draft.status

    with django_capture_on_commit_callbacks(execute=True):
        response = client.post(_convert_url(proforma.id), data={}, content_type="application/json")

    assert response.status_code == 201
    payload = response.json()
    assert payload["template_key"] == expected_template_key
    assert payload["document_type"] == expected_document_type
    assert payload["notes"] == f"Converted from proforma {proforma.id}"
    source_draft.refresh_from_db()
    assert source_draft.status == source_status
    assert DocumentInstance.objects.get(id=proforma.id).document_type == "proforma"
    assert AuditEvent.objects.filter(
        action="document.proforma_converted_to_contract",
        target_id=str(proforma.id),
    ).exists()


def test_group_mapped_sensitive_actor_can_convert_proforma(client, django_user_model) -> None:
    actor = django_user_model.objects.create_user(
        username="group-proforma",
        password="test-pass",
    )
    actor.groups.add(Group.objects.create(name=IdentityRole.RESERVATION_SENSITIVE_OPERATOR.value))
    client.force_login(actor)
    proforma, _ = _titan_proforma(actor=actor)

    response = client.post(_convert_url(proforma.id), data={}, content_type="application/json")

    assert response.status_code == 201


def test_repeat_conversion_is_idempotent(sensitive_client) -> None:
    client, actor = sensitive_client
    proforma, source_draft = _titan_proforma(actor=actor)

    first = client.post(_convert_url(proforma.id), data={}, content_type="application/json")
    second = client.post(_convert_url(proforma.id), data={}, content_type="application/json")

    assert first.status_code == 201
    assert second.status_code == 200
    assert first.json()["id"] == second.json()["id"]
    assert (
        DocumentInstance.objects.filter(
            reservation_draft=source_draft,
            template_key="titan.material_contract.v1",
            notes=f"Converted from proforma {proforma.id}",
        ).count()
        == 1
    )


@pytest.mark.parametrize("state", ("expired", "voided"))
def test_conversion_rejects_expired_or_voided_proforma(sensitive_client, state) -> None:
    client, actor = sensitive_client
    proforma, _ = _titan_proforma(actor=actor)
    if state == "expired":
        proforma.valid_until = timezone.now() - timedelta(seconds=1)
        proforma.save(update_fields=["valid_until", "updated_at"])
    else:
        proforma.status = DocumentInstanceStatus.VOIDED
        proforma.voided_at = timezone.now()
        proforma.voided_by = actor
        proforma.save(update_fields=["status", "voided_at", "voided_by", "updated_at"])

    response = client.post(_convert_url(proforma.id), data={}, content_type="application/json")

    assert response.status_code == 400
    assert (
        DocumentInstance.objects.filter(notes=f"Converted from proforma {proforma.id}").count() == 0
    )


def test_void_proforma_uses_semantic_registry_and_records_actor(
    sensitive_client,
    django_capture_on_commit_callbacks,
) -> None:
    client, actor = sensitive_client
    proforma, _ = _titan_proforma(actor=actor)

    with django_capture_on_commit_callbacks(execute=True):
        response = client.post(
            _void_url(proforma.id),
            data={"reason": "Commercial correction"},
            content_type="application/json",
        )

    assert response.status_code == 200
    proforma.refresh_from_db()
    assert proforma.status == DocumentInstanceStatus.VOIDED
    assert proforma.voided_by_id == actor.id
    assert proforma.void_reason == "Commercial correction"
    assert AuditEvent.objects.filter(
        action="document.proforma_voided",
        target_id=str(proforma.id),
    ).exists()


def test_conversion_rolls_back_contract_when_conversion_audit_cannot_be_scheduled(
    sensitive_client,
    monkeypatch,
) -> None:
    _, actor = sensitive_client
    proforma, source_draft = _titan_proforma(actor=actor)
    original_record_audit_event_on_commit = document_services.record_audit_event_on_commit

    def fail_conversion_audit(**kwargs):
        if kwargs["action"] == "document.proforma_converted_to_contract":
            raise RuntimeError("audit scheduling failure")
        return original_record_audit_event_on_commit(**kwargs)

    monkeypatch.setattr(document_services, "record_audit_event_on_commit", fail_conversion_audit)

    with pytest.raises(RuntimeError, match="audit scheduling failure"):
        prepare_contract_from_proforma(document_instance_id=proforma.id, actor=actor)

    assert (
        DocumentInstance.objects.filter(
            reservation_draft=source_draft,
            template_key="titan.material_contract.v1",
            notes=f"Converted from proforma {proforma.id}",
        ).exists()
        is False
    )
