from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from apps.customers.models import Customer, CustomerContactPoint
from apps.documents.commercial import CommercialDocumentContextError
from apps.documents.models import DocumentInstance
from apps.documents.runtime import generate_document_instance_html
from apps.documents.serializers import DocumentInstanceSerializer
from apps.documents.services import (
    build_amendment_document_reference,
    build_document_reference,
    create_document_instance_from_hahitantsoa_event_draft,
    create_document_instance_from_reservation_draft,
    get_reservation_draft_commercial_document_context_service,
    get_titan_proforma_draft_preview_payload_service,
)
from apps.finance.models import FinanceAccountKind, FinanceBusinessScope
from apps.finance.services import create_finance_account, create_finance_bank_profile
from apps.hahitantsoa.models import HahitantsoaEventDraft
from apps.inventory.models import InventoryItem
from apps.reservations.models import ReservationDraft, ReservationDraftLine

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize(
    ("template_key", "expected"),
    (
        ("titan.proforma.v1", "T-001/2026-PF"),
        ("hahitantsoa.proforma.v1", "H-001/2026-PF"),
        ("titan.material_contract.v1", "T-001/2026-CT"),
        ("hahitantsoa.contract.v1", "H-001/2026-CT"),
        ("shared.preparation_sheet.v1", "T-001/2026-FP"),
        ("titan.delivery_note.v1", "T-001/2026-BL"),
        ("hahitantsoa.liability_release.v1", "H-001/2026-DR"),
        ("shared.return_note.v1", "T-001/2026-BR"),
        ("titan.invoice.v1", "T-001/2026-FA"),
        ("hahitantsoa.invoice.v1", "H-001/2026-FA"),
        ("titan.breakage_repair_invoice.v1", "T-001/2026-FC"),
        ("hahitantsoa.breakage_repair_invoice.v1", "H-001/2026-FC"),
    ),
)
def test_build_document_reference_uses_approved_template_suffixes(
    template_key: str,
    expected: str,
) -> None:
    assert (
        build_document_reference(
            public_reference="H-001/2026"
            if template_key.startswith("hahitantsoa")
            else "T-001/2026",
            template_key=template_key,
        )
        == expected
    )


def test_build_document_reference_leaves_unmapped_template_empty() -> None:
    assert (
        build_document_reference(
            public_reference="T-001/2026",
            template_key="shared.supplier_purchase_order.v1",
        )
        == ""
    )


@pytest.mark.parametrize(
    ("public_reference", "amendment_sequence", "expected"),
    (
        ("T-001/2026", 1, "T-001/2026-AV-01"),
        ("H-014/2026", 12, "H-014/2026-AV-12"),
    ),
)
def test_build_amendment_document_reference_uses_approved_sequence(
    public_reference: str,
    amendment_sequence: int,
    expected: str,
) -> None:
    assert (
        build_amendment_document_reference(
            public_reference=public_reference,
            amendment_sequence=amendment_sequence,
        )
        == expected
    )


def _customer() -> Customer:
    return Customer.objects.create(
        display_name="Client service",
        email="service@example.test",
        phone="+261340000010",
        address="Antananarivo",
    )


def _item(*, name: str = "Pack video", kind: str = "material_pack") -> InventoryItem:
    return InventoryItem.objects.create(
        name=name,
        kind=kind,
        description="Description service",
    )


def _draft(*, customer: Customer | None = None) -> ReservationDraft:
    start_at = timezone.now().replace(microsecond=0) + timedelta(days=1)
    end_at = start_at + timedelta(hours=3)
    return ReservationDraft.objects.create(
        customer=customer or _customer(),
        start_at=start_at,
        end_at=end_at,
        notes="Service draft",
    )


def test_get_reservation_draft_commercial_document_context_service_builds_context() -> None:
    draft = _draft()
    item = _item()
    ReservationDraftLine.objects.create(
        reservation_draft=draft,
        inventory_item=item,
        quantity=2,
        notes="Service line",
    )

    context = get_reservation_draft_commercial_document_context_service(
        reservation_draft_id=draft.id,
        template_key="titan.proforma.v1",
    )

    assert context.template.key == "titan.proforma.v1"
    assert context.reservation_draft.reservation_draft_id == draft.id
    assert len(context.reservation_draft.lines) == 1
    assert context.reservation_draft.lines[0].inventory_item_name == item.name


def test_get_reservation_draft_commercial_document_context_service_rejects_soft_deleted_draft() -> (
    None
):
    draft = _draft()
    draft.is_deleted = True
    draft.deleted_at = timezone.now()
    draft.save(update_fields=["is_deleted", "deleted_at"])

    with pytest.raises(ReservationDraft.DoesNotExist):
        get_reservation_draft_commercial_document_context_service(
            reservation_draft_id=draft.id,
            template_key="titan.proforma.v1",
        )


def test_get_reservation_draft_commercial_document_context_service_propagates_unknown_template():
    draft = _draft()

    with pytest.raises(CommercialDocumentContextError):
        get_reservation_draft_commercial_document_context_service(
            reservation_draft_id=draft.id,
            template_key="shared.unknown.v1",
        )


def test_get_titan_proforma_draft_preview_payload_service_preserves_preview_shape() -> None:
    draft = _draft()
    item = _item(name="Camera pack", kind="material")
    ReservationDraftLine.objects.create(
        reservation_draft=draft,
        inventory_item=item,
        quantity=3,
        notes="Preview line",
    )

    payload = get_titan_proforma_draft_preview_payload_service(
        reservation_draft_id=draft.id,
    )

    assert payload["document_type"] == "proforma"
    assert payload["business_scope"] == "titan"
    assert payload["template_key"] == "titan.proforma.v1"
    assert payload["template"]["key"] == "titan.proforma.v1"
    assert payload["reservation_draft"]["public_reference"] == draft.public_reference
    assert payload["reservation_draft"]["customer_display_name"] == draft.customer.display_name
    assert payload["reservation_draft"]["lines"] == [
        {
            "id": draft.lines.get().id,
            "inventory_item_id": item.id,
            "inventory_item_name": item.name,
            "inventory_item_kind": item.kind,
            "quantity": 3,
            "notes": "Preview line",
        }
    ]
    assert payload["scope_flags"] == {
        "pdf_runtime_generated": False,
        "reservation_confirmed": False,
        "inventory_blocked": False,
        "payment_created": False,
        "invoice_created": False,
        "contract_created": False,
    }


def test_get_titan_proforma_draft_preview_payload_service_rejects_missing_draft() -> None:
    with pytest.raises(ReservationDraft.DoesNotExist):
        get_titan_proforma_draft_preview_payload_service(
            reservation_draft_id="00000000-0000-0000-0000-000000000000",
        )


def test_document_preparation_snapshots_the_default_bank(django_user_model) -> None:
    actor = django_user_model.objects.create_user(
        username="document-bank", password="test-pass", is_staff=True
    )
    account = create_finance_account(
        actor=actor,
        business_scope=FinanceBusinessScope.TITAN,
        code="BANK-DOC-01",
        label="Banque documentaire",
        kind=FinanceAccountKind.BANK,
    )
    profile = create_finance_bank_profile(
        account=account,
        actor=actor,
        bank_name="Banque documentaire",
        account_holder="Titan ERP",
        rib="RIB-ORIGINAL",
        is_default_for_documents=True,
    )
    reservation_draft = _draft()
    document = create_document_instance_from_reservation_draft(
        reservation_draft=reservation_draft,
        template_key="titan.proforma.v1",
        actor=actor,
    )

    assert document.document_reference == f"{reservation_draft.public_reference}-PF"
    assert document.bank_profile_id == profile.id
    assert document.bank_name == "Banque documentaire"
    assert document.bank_rib == "RIB-ORIGINAL"

    profile.rib = "RIB-MODIFIE"
    profile.save(update_fields=["rib"])
    document.refresh_from_db()
    assert document.bank_rib == "RIB-ORIGINAL"
    assert DocumentInstance.objects.filter(pk=document.pk).exists()


def test_titan_contract_snapshots_and_renders_all_customer_contacts() -> None:
    customer = _customer()
    CustomerContactPoint.objects.create(
        customer=customer,
        kind="email",
        value="commercial@example.test",
        label="Commercial",
        is_primary=True,
    )
    CustomerContactPoint.objects.create(
        customer=customer,
        kind="email",
        value="accounting@example.test",
        label="Comptabilité",
    )
    CustomerContactPoint.objects.create(
        customer=customer,
        kind="phone",
        value="+261340000011",
        label="WhatsApp",
        is_primary=True,
    )
    reservation_draft = _draft(customer=customer)
    document = create_document_instance_from_reservation_draft(
        reservation_draft=reservation_draft,
        template_key="titan.material_contract.v1",
    )

    assert document.document_reference == f"{reservation_draft.public_reference}-CT"
    assert document.customer_contact_points_snapshot == [
        {"kind": "email", "value": "commercial@example.test", "label": "Commercial"},
        {"kind": "phone", "value": "+261340000011", "label": "WhatsApp"},
        {"kind": "email", "value": "accounting@example.test", "label": "Comptabilité"},
        {"kind": "email", "value": "service@example.test", "label": ""},
        {"kind": "phone", "value": "+261340000010", "label": ""},
    ]

    CustomerContactPoint.objects.filter(
        customer=customer,
        value="commercial@example.test",
    ).update(value="changed@example.test")
    result = generate_document_instance_html(document_instance=document)

    assert "commercial@example.test" in result.html_content
    assert "accounting@example.test" in result.html_content
    assert "+261340000011" in result.html_content
    assert "service@example.test" in result.html_content
    assert "+261340000010" in result.html_content
    assert "changed@example.test" not in result.html_content


def test_hahitantsoa_documents_snapshot_and_render_all_customer_contacts() -> None:
    customer = _customer()
    CustomerContactPoint.objects.create(
        customer=customer,
        kind="email",
        value="commercial-hah@example.test",
        label="Commercial",
        is_primary=True,
    )
    CustomerContactPoint.objects.create(
        customer=customer,
        kind="email",
        value="accounting-hah@example.test",
        label="Comptabilité",
    )
    CustomerContactPoint.objects.create(
        customer=customer,
        kind="phone",
        value="+261340000021",
        label="WhatsApp",
        is_primary=True,
    )
    start_at = timezone.now().replace(microsecond=0) + timedelta(days=14)
    event_draft = HahitantsoaEventDraft.objects.create(
        customer=customer,
        event_name="Réception familiale",
        start_at=start_at,
        end_at=start_at + timedelta(hours=6),
        rental_type="bare",
        venue_name="Salle de réception Hahitantsoa",
        space_rental_amount=Decimal("12500000.00"),
        total_amount=Decimal("12500000.00"),
    )
    document = create_document_instance_from_hahitantsoa_event_draft(
        event_draft=event_draft,
        template_key="hahitantsoa.contract.v1",
    )

    assert document.customer_contact_points_snapshot == [
        {"kind": "email", "value": "commercial-hah@example.test", "label": "Commercial"},
        {"kind": "phone", "value": "+261340000021", "label": "WhatsApp"},
        {"kind": "email", "value": "accounting-hah@example.test", "label": "Comptabilité"},
    ]

    CustomerContactPoint.objects.filter(
        customer=customer,
        value="commercial-hah@example.test",
    ).update(value="changed-hah@example.test")
    result = generate_document_instance_html(document_instance=document)

    assert "commercial-hah@example.test" in result.html_content
    assert "accounting-hah@example.test" in result.html_content
    assert "+261340000021" in result.html_content
    assert "service@example.test" in result.html_content
    assert "+261340000010" in result.html_content
    assert "changed-hah@example.test" not in result.html_content


def test_titan_contract_missing_identity_fields_are_non_blocking_warnings() -> None:
    document = create_document_instance_from_reservation_draft(
        reservation_draft=_draft(),
        template_key="titan.material_contract.v1",
    )

    warnings = DocumentInstanceSerializer(document).data["contract_warnings"]

    assert {warning["field"] for warning in warnings} >= {
        "customer_birth_date",
        "customer_id_number",
        "customer_id_issue_date",
    }
