from datetime import timedelta
from html import unescape

import pytest
from django.utils import timezone

from apps.customers.models import Customer
from apps.documents.runtime import (
    generate_document_instance_html,
    preview_hahitantsoa_event_draft_document_html,
)
from apps.documents.services import create_document_instance_from_hahitantsoa_event_draft
from apps.hahitantsoa.commercial_terms import get_hahitantsoa_commercial_terms
from apps.hahitantsoa.composition import default_bare_rental_composition
from apps.hahitantsoa.models import HahitantsoaCommercialTerms, HahitantsoaEventDraft
from apps.hahitantsoa.serializers import (
    HahitantsoaCommercialTermsSerializer,
    HahitantsoaEventDraftSerializer,
)

pytestmark = pytest.mark.django_db


@pytest.fixture
def draft():
    start = timezone.now() + timedelta(days=30)
    return HahitantsoaEventDraft.objects.create(
        customer=Customer.objects.create(display_name="Composition client"),
        event_name="Composition event",
        start_at=start,
        end_at=start + timedelta(hours=8),
    )


@pytest.mark.parametrize(
    "value",
    [
        None,
        {},
        [],
        [{}],
        [{"label": " ", "quantity": 1}],
        [{"label": "x" * 201, "quantity": 1}],
        [{"label": 1, "quantity": 1}],
        *[[{"label": "Salle", "quantity": q}] for q in (True, 1.0, "1", 0, -1, 10000)],
        [{"label": "Salle", "quantity": 1}] * 51,
    ],
)
def test_composition_rejects_invalid_values(value):
    serializer = HahitantsoaCommercialTermsSerializer(
        data={"bare_rental_composition": value}, partial=True
    )
    assert not serializer.is_valid()
    assert "bare_rental_composition" in serializer.errors


def test_terms_defaults_and_event_copy_are_isolated(draft):
    terms = get_hahitantsoa_commercial_terms()
    assert terms.bare_rental_composition == default_bare_rental_composition()
    serializer = HahitantsoaCommercialTermsSerializer(
        terms,
        data={"bare_rental_composition": [{"label": " Salle annexe ", "quantity": 2}]},
        partial=True,
    )
    assert serializer.is_valid(), serializer.errors
    serializer.save()
    assert serializer.data["bare_rental_composition"] == [{"label": "Salle annexe", "quantity": 2}]
    data = {
        "customer_id": str(draft.customer_id),
        "event_name": "New event",
        "start_at": draft.start_at + timedelta(days=1),
        "end_at": draft.end_at + timedelta(days=1),
        "lines": [],
    }
    event_serializer = HahitantsoaEventDraftSerializer(data=data)
    assert event_serializer.is_valid(), event_serializer.errors
    created = event_serializer.save()
    assert created.bare_rental_composition == terms.bare_rental_composition
    terms.bare_rental_composition = [{"label": "Changed default", "quantity": 1}]
    terms.save()
    created.refresh_from_db()
    draft.refresh_from_db()
    assert created.bare_rental_composition == [{"label": "Salle annexe", "quantity": 2}]
    assert draft.bare_rental_composition == default_bare_rental_composition()


@pytest.mark.parametrize(
    "template_key",
    ["hahitantsoa.proforma.v1", "hahitantsoa.invoice.v1", "hahitantsoa.delivery_note.v1"],
)
def test_composition_document_preview_and_first_generation_snapshot(draft, template_key):
    document = create_document_instance_from_hahitantsoa_event_draft(
        event_draft=draft, template_key=template_key
    )
    document = type(document).objects.select_related("hahitantsoa_event_draft").get(pk=document.pk)
    draft.bare_rental_composition = [
        {"label": "Salle personnalisée", "quantity": 1},
        {"label": "Chaises pliables", "quantity": 10},
    ]
    draft.save()
    preview = unescape(
        preview_hahitantsoa_event_draft_document_html(event_draft=draft, template_key=template_key)
    )
    assert "Salle personnalisée" in preview
    assert "010 Chaises pliables" in preview
    assert "Location nue de l'espace" not in preview
    first = generate_document_instance_html(document_instance=document)
    first_html = unescape(first.html_content)
    assert "Salle personnalisée" in first_html
    assert "010 Chaises pliables" in first_html
    draft.bare_rental_composition = [{"label": "Nouvelle composition", "quantity": 1}]
    draft.save()
    document.refresh_from_db()
    second = generate_document_instance_html(document_instance=document, force=True)
    assert "Salle personnalisée" in unescape(second.html_content)
    assert "Nouvelle composition" not in second.html_content


def test_terms_update_requires_superadmin(client, django_user_model):
    actor = django_user_model.objects.create_user(username="composition-reader")
    client.force_login(actor)
    response = client.patch(
        "/api/v1/hahitantsoa/commercial-terms/",
        data={"bare_rental_composition": default_bare_rental_composition()},
        content_type="application/json",
    )
    assert response.status_code == 403


def test_failed_document_generation_does_not_freeze_composition(draft, monkeypatch):
    document = create_document_instance_from_hahitantsoa_event_draft(
        event_draft=draft, template_key="hahitantsoa.proforma.v1"
    )

    def fail_storage(*args, **kwargs):
        raise OSError("Simulated storage failure")

    monkeypatch.setattr("apps.documents.runtime.store_document_html_artifact", fail_storage)
    with pytest.raises(OSError):
        generate_document_instance_html(document_instance=document)
    document.refresh_from_db()
    assert document.bare_rental_composition_snapshot is None
    assert document.status == "prepared"


def test_legacy_document_regeneration_preserves_original_label_and_contents(draft):
    document = create_document_instance_from_hahitantsoa_event_draft(
        event_draft=draft, template_key="hahitantsoa.proforma.v1"
    )
    document.bare_rental_composition_snapshot = {
        "legacy": True,
        "label": "Location nue de l'espace",
        "items": [
            "Salle",
            "Espace vert",
            "Estrade mariés",
            "Estrade animation",
            "Table mariés",
            "Table DJ",
            "10 Chaises pliables",
        ],
    }
    document.save()
    draft.bare_rental_composition = [{"label": "Future composition", "quantity": 1}]
    draft.save()
    html = unescape(
        generate_document_instance_html(document_instance=document, force=True).html_content
    )
    assert "Location nue de l'espace" in html
    assert "Espace vert" in html
    assert "Estrade animation" in html
    assert "10 Chaises pliables" in html
    assert "Future composition" not in html


def test_superadmin_terms_and_event_composition_api_persist(client, django_user_model, draft):
    actor = django_user_model.objects.create_superuser(
        username="composition-admin", password="test-password"
    )
    draft.created_by = actor
    draft.save(update_fields=["created_by"])
    client.force_login(actor)
    composition = [{"label": "Salle API", "quantity": 1}, {"label": "Chaises API", "quantity": 12}]
    terms_url = "/api/v1/hahitantsoa/commercial-terms/"
    response = client.patch(
        terms_url, data={"bare_rental_composition": composition}, content_type="application/json"
    )
    assert response.status_code == 200
    assert client.get(terms_url).json()["bare_rental_composition"] == composition
    draft_url = f"/api/v1/hahitantsoa/event-drafts/{draft.pk}/"
    response = client.patch(
        draft_url, data={"bare_rental_composition": composition}, content_type="application/json"
    )
    assert response.status_code == 200
    assert client.get(draft_url).json()["bare_rental_composition"] == composition
    draft.refresh_from_db()
    assert draft.bare_rental_composition == composition
    assert draft.updated_by == actor
    draft.contract_signed_at = timezone.now()
    draft.contract_signed_by = actor
    draft.save()
    response = client.patch(
        draft_url,
        data={"bare_rental_composition": default_bare_rental_composition()},
        content_type="application/json",
    )
    assert response.status_code == 400
    draft.refresh_from_db()
    assert draft.bare_rental_composition == composition


@pytest.mark.parametrize("state", ["confirmed", "signed"])
def test_event_composition_cannot_change_after_confirmation(draft, state):
    if state == "signed":
        draft.contract_signed_at = timezone.now()
    else:
        draft.status = "confirmed"
    serializer = HahitantsoaEventDraftSerializer(
        draft, data={"bare_rental_composition": [{"label": "Changed", "quantity": 1}]}, partial=True
    )
    assert not serializer.is_valid()
    assert "bare_rental_composition" in serializer.errors


def test_first_event_initializes_missing_commercial_terms(client, django_user_model):
    HahitantsoaCommercialTerms.objects.all().delete()
    actor = django_user_model.objects.create_superuser(
        username="first-composition-event", password="test-password"
    )
    client.force_login(actor)
    customer = Customer.objects.create(display_name="First event client")
    start = timezone.now() + timedelta(days=30)
    response = client.post(
        "/api/v1/hahitantsoa/event-drafts/",
        data={
            "customer_id": str(customer.pk),
            "event_name": "First composition event",
            "rental_type": "bare",
            "start_at": start.isoformat(),
            "end_at": (start + timedelta(hours=8)).isoformat(),
            "lines": [],
        },
        content_type="application/json",
    )
    assert response.status_code == 201, response.json()
    assert response.json()["bare_rental_composition"] == default_bare_rental_composition()
