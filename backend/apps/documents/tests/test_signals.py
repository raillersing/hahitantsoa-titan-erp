"""Tests signal auto proforma_sent sur création DocumentInstance."""

from datetime import timedelta

import pytest
from django.utils import timezone

from apps.customers.models import Customer, CustomerLifecycleStatus, ProspectStatus
from apps.documents.models import DocumentInstance
from apps.reservations.models import ReservationDraft

pytestmark = pytest.mark.django_db


def _customer() -> Customer:
    return Customer.objects.create(
        display_name="Signal Test",
        lifecycle_status=CustomerLifecycleStatus.PROSPECT,
        prospect_status=ProspectStatus.QUALIFIED,
    )


def _draft(customer: Customer) -> ReservationDraft:
    start_at = timezone.now().replace(microsecond=0) + timedelta(days=2)
    end_at = start_at + timedelta(hours=4)
    return ReservationDraft.objects.create(
        customer=customer,
        start_at=start_at,
        end_at=end_at,
    )


def _proforma_instance(draft: ReservationDraft) -> DocumentInstance:
    return DocumentInstance.objects.create(
        reservation_draft=draft,
        customer=draft.customer,
        template_key="titan.proforma.v1",
        template_version="v1",
        template_label="Proforma Titan",
        business_scope="titan",
        document_type="proforma",
        template_status="validated_source_template",
        template_source_kind="source_pdf",
        template_source_reference="ref",
        template_path="path",
        template_preview_path="preview",
        reservation_public_reference=draft.public_reference,
        reservation_status=draft.status,
        customer_display_name=draft.customer.display_name,
        customer_email=draft.customer.email,
        customer_phone=draft.customer.phone,
        customer_address=draft.customer.address,
    )


class TestProformaAutoPipelineSignal:
    def test_creating_proforma_sets_prospect_status_to_proforma_sent(self):
        customer = _customer()
        draft = _draft(customer)
        assert customer.prospect_status == ProspectStatus.QUALIFIED
        _proforma_instance(draft)
        customer.refresh_from_db()
        assert customer.prospect_status == ProspectStatus.PROFORMA_SENT

    def test_non_proforma_document_does_not_change_status(self):
        customer = _customer()
        draft = _draft(customer)
        DocumentInstance.objects.create(
            reservation_draft=draft,
            customer=draft.customer,
            template_key="titan.delivery_note.v1",
            template_version="v1",
            template_label="Delivery Note",
            business_scope="titan",
            document_type="delivery_note",
            template_status="validated_source_template",
            template_source_kind="source_pdf",
            template_source_reference="ref",
            template_path="path",
            template_preview_path="preview",
            reservation_public_reference=draft.public_reference,
            reservation_status=draft.status,
            customer_display_name=draft.customer.display_name,
            customer_email=draft.customer.email,
            customer_phone=draft.customer.phone,
            customer_address=draft.customer.address,
        )
        customer.refresh_from_db()
        assert customer.prospect_status == ProspectStatus.QUALIFIED

    def test_proforma_for_client_does_not_change_status(self):
        customer = Customer.objects.create(
            display_name="Client Signal",
            lifecycle_status=CustomerLifecycleStatus.CLIENT,
        )
        draft = _draft(customer)
        _proforma_instance(draft)
        customer.refresh_from_db()
        assert customer.prospect_status == ProspectStatus.NEW
        assert customer.lifecycle_status == CustomerLifecycleStatus.CLIENT

    def test_second_proforma_does_not_revert_status(self):
        customer = _customer()
        draft = _draft(customer)
        _proforma_instance(draft)
        customer.refresh_from_db()
        assert customer.prospect_status == ProspectStatus.PROFORMA_SENT
        # Second proforma
        _proforma_instance(draft)
        customer.refresh_from_db()
        assert customer.prospect_status == ProspectStatus.PROFORMA_SENT
