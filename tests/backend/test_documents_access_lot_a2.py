from __future__ import annotations

import uuid

import pytest
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.utils import timezone
from rest_framework.test import APIClient

from apps.customers.models import Customer
from apps.documents.models import (
    DocumentInstance,
    DocumentInstanceStatus,
    UploadedAttachment,
    UploadedAttachmentCategory,
)
from apps.documents.services import (
    COMMERCIAL_RESTRICTED_DOCUMENT_TYPES,
    FINANCIAL_DOCUMENT_TYPES,
    LOGISTICS_DOCUMENT_TYPES,
)
from apps.identity.models import ApplicationRole, UserRoleAssignment
from apps.reservations.models import ReservationDraft

User = get_user_model()
pytestmark = pytest.mark.django_db


def _create_user_with_role(username: str, role_slug: str, *, is_active: bool = True) -> User:
    user = User.objects.create_user(
        username=username,
        email=f"{username}@example.com",
        password="test-password-123",
        is_active=is_active,
    )
    role, _ = ApplicationRole.objects.get_or_create(
        slug=role_slug,
        defaults={"name": role_slug.replace("_", " ").title(), "is_active": True},
    )
    UserRoleAssignment.objects.create(
        user=user,
        role=role,
        is_active=True,
    )
    return user


@pytest.fixture
def commercial_colleague_1() -> User:
    return _create_user_with_role("commercial_colleague_1", "reservation_sensitive_operator")


@pytest.fixture
def commercial_colleague_2() -> User:
    return _create_user_with_role("commercial_colleague_2", "reservation_sensitive_operator")


@pytest.fixture
def accountant() -> User:
    return _create_user_with_role("accountant_a2", "accountant")


@pytest.fixture
def logistics_operator() -> User:
    return _create_user_with_role("logistics_a2", "storekeeper")


@pytest.fixture
def unprivileged_user() -> User:
    return _create_user_with_role("cleaner_a2", "cleaner")


@pytest.fixture
def shared_customer(commercial_colleague_1: User) -> Customer:
    return Customer.objects.create(
        party_type="individual",
        display_name="Jean Dupont",
        phone="+261340000001",
        email="jean.dupont@example.com",
        created_by=commercial_colleague_1,
        updated_by=commercial_colleague_1,
    )


@pytest.fixture
def shared_reservation_draft(
    commercial_colleague_1: User, shared_customer: Customer
) -> ReservationDraft:
    return ReservationDraft.objects.create(
        customer=shared_customer,
        created_by=commercial_colleague_1,
        updated_by=commercial_colleague_1,
        public_reference="RES-A2-SHARED-001",
        status="draft",
        start_at=timezone.now() + timezone.timedelta(days=45),
        end_at=timezone.now() + timezone.timedelta(days=46),
    )


def _create_doc_instance(
    *,
    document_type: str,
    reservation_draft: ReservationDraft,
    customer: Customer,
    status: str = DocumentInstanceStatus.GENERATED,
    prepared_by: User | None = None,
    storage_path: str | None = None,
    pdf_storage_path: str | None = None,
) -> DocumentInstance:
    doc_id = uuid.uuid4()
    if storage_path is None and status in (
        DocumentInstanceStatus.GENERATED,
        DocumentInstanceStatus.ISSUED,
    ):
        storage_path = f"artifacts/documents/instances/{doc_id}.html"
        default_storage.save(
            storage_path, ContentFile(f"<html><body>{document_type} content</body></html>".encode())
        )
    if pdf_storage_path is None and status in (
        DocumentInstanceStatus.GENERATED,
        DocumentInstanceStatus.ISSUED,
    ):
        pdf_storage_path = f"artifacts/documents/instances/{doc_id}.pdf"
        default_storage.save(pdf_storage_path, ContentFile(b"%PDF-1.4 test binary pdf"))

    return DocumentInstance.objects.create(
        id=doc_id,
        reservation_draft=reservation_draft,
        customer=customer,
        document_type=document_type,
        template_key=f"tpl_{document_type}",
        template_version="1.0",
        template_label=f"Label {document_type}",
        business_scope="titan",
        template_status="active",
        template_source_kind="system",
        template_source_reference=f"ref_{document_type}",
        template_path=f"templates/{document_type}.html",
        template_preview_path=f"previews/{document_type}.png",
        status=status,
        prepared_by=prepared_by,
        storage_path=storage_path or "",
        pdf_storage_path=pdf_storage_path or "",
        reservation_public_reference=reservation_draft.public_reference,
        reservation_status=reservation_draft.status,
        customer_display_name=customer.display_name,
    )


# -----------------------------------------------------------------------------
# 1. Exhaustive Document Type Classification Tests
# -----------------------------------------------------------------------------


def test_document_types_registry_completeness():
    from apps.documents.registry import DOCUMENT_TEMPLATE_REGISTRY

    registry_types = {d.document_type for d in DOCUMENT_TEMPLATE_REGISTRY}
    all_categorized = (
        FINANCIAL_DOCUMENT_TYPES | LOGISTICS_DOCUMENT_TYPES | COMMERCIAL_RESTRICTED_DOCUMENT_TYPES
    )

    # Exact equality: every single registered type is partitioned, no overlap, no omissions
    assert registry_types == all_categorized
    assert len(FINANCIAL_DOCUMENT_TYPES) == 6
    assert len(LOGISTICS_DOCUMENT_TYPES) == 6
    assert len(COMMERCIAL_RESTRICTED_DOCUMENT_TYPES) == 4
    assert len(registry_types) == 16
    assert FINANCIAL_DOCUMENT_TYPES.isdisjoint(LOGISTICS_DOCUMENT_TYPES)
    assert FINANCIAL_DOCUMENT_TYPES.isdisjoint(COMMERCIAL_RESTRICTED_DOCUMENT_TYPES)
    assert LOGISTICS_DOCUMENT_TYPES.isdisjoint(COMMERCIAL_RESTRICTED_DOCUMENT_TYPES)


@pytest.mark.parametrize("doc_type", sorted(FINANCIAL_DOCUMENT_TYPES))
def test_financial_documents_accessible_by_accountant_and_commercial(
    doc_type: str,
    commercial_colleague_1: User,
    accountant: User,
    logistics_operator: User,
    unprivileged_user: User,
    shared_reservation_draft: ReservationDraft,
    shared_customer: Customer,
):
    doc = _create_doc_instance(
        document_type=doc_type,
        reservation_draft=shared_reservation_draft,
        customer=shared_customer,
        prepared_by=commercial_colleague_1,
    )

    client_acc = APIClient()
    client_acc.force_authenticate(user=accountant)

    # 1. HTML artifact
    res_artifact = client_acc.get(f"/api/v1/documents/instances/{doc.id}/artifact/")
    assert res_artifact.status_code == 200, f"Accountant must access {doc_type} artifact"
    assert f"{doc_type} content".encode() in res_artifact.content

    # 2. PDF artifact
    res_pdf = client_acc.get(f"/api/v1/documents/instances/{doc.id}/pdf/")
    assert res_pdf.status_code == 200, f"Accountant must access {doc_type} pdf"

    # 3. Direct instance UUID
    res_direct = client_acc.get(f"/api/v1/documents/instances/{doc.id}/")
    assert res_direct.status_code == 200
    assert res_direct.data["id"] == str(doc.id)

    # 4. Dossier instance detail
    res_dossier = client_acc.get(
        f"/api/v1/documents/reservation-drafts/{shared_reservation_draft.id}/instances/{doc.id}/"
    )
    assert res_dossier.status_code == 200
    assert res_dossier.data["id"] == str(doc.id)

    # Logistics operator must be strictly forbidden from financial documents
    client_log = APIClient()
    client_log.force_authenticate(user=logistics_operator)
    assert client_log.get(f"/api/v1/documents/instances/{doc.id}/artifact/").status_code == 403
    assert client_log.get(f"/api/v1/documents/instances/{doc.id}/pdf/").status_code == 403
    assert client_log.get(f"/api/v1/documents/instances/{doc.id}/").status_code == 403
    assert (
        client_log.get(
            f"/api/v1/documents/reservation-drafts/{shared_reservation_draft.id}/instances/{doc.id}/"
        ).status_code
        == 403
    )

    # Unprivileged user must be strictly forbidden
    client_unp = APIClient()
    client_unp.force_authenticate(user=unprivileged_user)
    assert client_unp.get(f"/api/v1/documents/instances/{doc.id}/artifact/").status_code == 403


@pytest.mark.parametrize("doc_type", sorted(LOGISTICS_DOCUMENT_TYPES))
def test_logistics_documents_accessible_by_logistics_and_commercial(
    doc_type: str,
    commercial_colleague_1: User,
    accountant: User,
    logistics_operator: User,
    shared_reservation_draft: ReservationDraft,
    shared_customer: Customer,
):
    doc = _create_doc_instance(
        document_type=doc_type,
        reservation_draft=shared_reservation_draft,
        customer=shared_customer,
        prepared_by=commercial_colleague_1,
    )

    client_log = APIClient()
    client_log.force_authenticate(user=logistics_operator)

    # Logistics operator accesses operational document
    assert client_log.get(f"/api/v1/documents/instances/{doc.id}/artifact/").status_code == 200
    assert client_log.get(f"/api/v1/documents/instances/{doc.id}/pdf/").status_code == 200
    assert client_log.get(f"/api/v1/documents/instances/{doc.id}/").status_code == 200
    assert (
        client_log.get(
            f"/api/v1/documents/reservation-drafts/{shared_reservation_draft.id}/instances/{doc.id}/"
        ).status_code
        == 200
    )

    # Accountant must be strictly forbidden from operational logistics documents
    client_acc = APIClient()
    client_acc.force_authenticate(user=accountant)
    assert client_acc.get(f"/api/v1/documents/instances/{doc.id}/artifact/").status_code == 403
    assert client_acc.get(f"/api/v1/documents/instances/{doc.id}/pdf/").status_code == 403
    assert client_acc.get(f"/api/v1/documents/instances/{doc.id}/").status_code == 403
    assert (
        client_acc.get(
            f"/api/v1/documents/reservation-drafts/{shared_reservation_draft.id}/instances/{doc.id}/"
        ).status_code
        == 403
    )


@pytest.mark.parametrize("doc_type", sorted(COMMERCIAL_RESTRICTED_DOCUMENT_TYPES))
def test_commercial_contracts_restricted_to_sensitive_write(
    doc_type: str,
    commercial_colleague_1: User,
    commercial_colleague_2: User,
    accountant: User,
    logistics_operator: User,
    shared_reservation_draft: ReservationDraft,
    shared_customer: Customer,
):
    doc = _create_doc_instance(
        document_type=doc_type,
        reservation_draft=shared_reservation_draft,
        customer=shared_customer,
        prepared_by=commercial_colleague_1,
    )

    # Colleague 2 (another commercial operator) can access contracts
    client_comm2 = APIClient()
    client_comm2.force_authenticate(user=commercial_colleague_2)
    assert client_comm2.get(f"/api/v1/documents/instances/{doc.id}/artifact/").status_code == 200
    assert client_comm2.get(f"/api/v1/documents/instances/{doc.id}/pdf/").status_code == 200
    assert client_comm2.get(f"/api/v1/documents/instances/{doc.id}/").status_code == 200
    assert (
        client_comm2.get(
            f"/api/v1/documents/reservation-drafts/{shared_reservation_draft.id}/instances/{doc.id}/"
        ).status_code
        == 200
    )

    # Accountant MUST NOT access commercial contracts
    client_acc = APIClient()
    client_acc.force_authenticate(user=accountant)
    assert client_acc.get(f"/api/v1/documents/instances/{doc.id}/artifact/").status_code == 403
    assert client_acc.get(f"/api/v1/documents/instances/{doc.id}/pdf/").status_code == 403
    assert client_acc.get(f"/api/v1/documents/instances/{doc.id}/").status_code == 403
    assert (
        client_acc.get(
            f"/api/v1/documents/reservation-drafts/{shared_reservation_draft.id}/instances/{doc.id}/"
        ).status_code
        == 403
    )

    # Logistics operator MUST NOT access commercial contracts
    client_log = APIClient()
    client_log.force_authenticate(user=logistics_operator)
    assert client_log.get(f"/api/v1/documents/instances/{doc.id}/artifact/").status_code == 403
    assert client_log.get(f"/api/v1/documents/instances/{doc.id}/pdf/").status_code == 403
    assert client_log.get(f"/api/v1/documents/instances/{doc.id}/").status_code == 403


# -----------------------------------------------------------------------------
# 2. Customer Attachments and Identity Isolation
# -----------------------------------------------------------------------------


def test_accountant_and_logistics_cannot_access_customer_id_attachments(
    commercial_colleague_1: User,
    accountant: User,
    logistics_operator: User,
    shared_reservation_draft: ReservationDraft,
    shared_customer: Customer,
):
    attachment = UploadedAttachment.objects.create(
        customer=shared_customer,
        reservation_draft=shared_reservation_draft,
        category=UploadedAttachmentCategory.CIN,
        file=ContentFile(b"fake identity document content", name="cni.pdf"),
        original_name="cni_dupont.pdf",
        content_type="application/pdf",
        size_bytes=28,
        sha256="0" * 64,
        created_by=commercial_colleague_1,
    )

    client_acc = APIClient()
    client_acc.force_authenticate(user=accountant)

    # Accountant cannot list attachments
    res_list = client_acc.get(
        f"/api/v1/documents/attachments/?reservation_draft_id={shared_reservation_draft.id}"
    )
    assert res_list.status_code == 403

    # Accountant cannot download customer ID attachment
    res_download = client_acc.get(f"/api/v1/documents/attachments/{attachment.id}/download/")
    assert res_download.status_code == 403

    # Logistics operator cannot download customer ID attachment
    client_log = APIClient()
    client_log.force_authenticate(user=logistics_operator)
    assert (
        client_log.get(f"/api/v1/documents/attachments/{attachment.id}/download/").status_code
        == 403
    )

    # Commercial operator can download
    client_comm = APIClient()
    client_comm.force_authenticate(user=commercial_colleague_1)
    res_comm = client_comm.get(f"/api/v1/documents/attachments/{attachment.id}/download/")
    assert res_comm.status_code == 200


# -----------------------------------------------------------------------------
# 3. Read-Time Generation Gating on PREPARED Documents
# -----------------------------------------------------------------------------


def test_read_time_generation_rejected_for_unauthorized_actor(
    commercial_colleague_1: User,
    accountant: User,
    shared_reservation_draft: ReservationDraft,
    shared_customer: Customer,
    monkeypatch,
):
    contract_doc = _create_doc_instance(
        document_type="contract",
        reservation_draft=shared_reservation_draft,
        customer=shared_customer,
        status=DocumentInstanceStatus.PREPARED,
        prepared_by=commercial_colleague_1,
        storage_path="",
        pdf_storage_path="",
    )

    generation_called = False

    def fake_generate_document_instance_html(*args, **kwargs):
        nonlocal generation_called
        generation_called = True

    monkeypatch.setattr(
        "apps.documents.runtime.generate_document_instance_html",
        fake_generate_document_instance_html,
    )

    client_acc = APIClient()
    client_acc.force_authenticate(user=accountant)

    # Requesting artifact for an unauthorized contract in PREPARED status
    response = client_acc.get(f"/api/v1/documents/instances/{contract_doc.id}/artifact/")
    assert response.status_code == 403
    # Gating check: generation was NOT triggered!
    assert not generation_called
    contract_doc.refresh_from_db()
    assert contract_doc.status == DocumentInstanceStatus.PREPARED


# -----------------------------------------------------------------------------
# 4. Direct UUID and Dossier Detail Route Access Controls
# -----------------------------------------------------------------------------


def test_direct_and_dossier_instance_access_controls(
    commercial_colleague_1: User,
    accountant: User,
    logistics_operator: User,
    unprivileged_user: User,
    shared_reservation_draft: ReservationDraft,
    shared_customer: Customer,
):
    inv = _create_doc_instance(
        document_type="invoice",
        reservation_draft=shared_reservation_draft,
        customer=shared_customer,
        prepared_by=commercial_colleague_1,
    )
    dn = _create_doc_instance(
        document_type="delivery_note",
        reservation_draft=shared_reservation_draft,
        customer=shared_customer,
        prepared_by=commercial_colleague_1,
    )
    ctr = _create_doc_instance(
        document_type="contract",
        reservation_draft=shared_reservation_draft,
        customer=shared_customer,
        prepared_by=commercial_colleague_1,
    )

    # 1. Commercial can retrieve all 3 via direct UUID and dossier route
    client_comm = APIClient()
    client_comm.force_authenticate(user=commercial_colleague_1)
    for doc in (inv, dn, ctr):
        assert client_comm.get(f"/api/v1/documents/instances/{doc.id}/").status_code == 200
        assert (
            client_comm.get(
                f"/api/v1/documents/reservation-drafts/{shared_reservation_draft.id}/instances/{doc.id}/"
            ).status_code
            == 200
        )

    # 2. Accountant can retrieve invoice, but is strictly forbidden (403)
    # from delivery_note and contract
    client_acc = APIClient()
    client_acc.force_authenticate(user=accountant)
    assert client_acc.get(f"/api/v1/documents/instances/{inv.id}/").status_code == 200
    assert (
        client_comm.get(
            f"/api/v1/documents/reservation-drafts/{shared_reservation_draft.id}/instances/{inv.id}/"
        ).status_code
        == 200
    )
    assert client_acc.get(f"/api/v1/documents/instances/{dn.id}/").status_code == 403
    assert (
        client_acc.get(
            f"/api/v1/documents/reservation-drafts/{shared_reservation_draft.id}/instances/{dn.id}/"
        ).status_code
        == 403
    )
    assert client_acc.get(f"/api/v1/documents/instances/{ctr.id}/").status_code == 403
    assert (
        client_acc.get(
            f"/api/v1/documents/reservation-drafts/{shared_reservation_draft.id}/instances/{ctr.id}/"
        ).status_code
        == 403
    )

    # 3. Logistics can retrieve delivery_note, but is strictly forbidden (403)
    # from invoice and contract
    client_log = APIClient()
    client_log.force_authenticate(user=logistics_operator)
    assert client_log.get(f"/api/v1/documents/instances/{dn.id}/").status_code == 200
    assert (
        client_log.get(
            f"/api/v1/documents/reservation-drafts/{shared_reservation_draft.id}/instances/{dn.id}/"
        ).status_code
        == 200
    )
    assert client_log.get(f"/api/v1/documents/instances/{inv.id}/").status_code == 403
    assert (
        client_log.get(
            f"/api/v1/documents/reservation-drafts/{shared_reservation_draft.id}/instances/{inv.id}/"
        ).status_code
        == 403
    )
    assert client_log.get(f"/api/v1/documents/instances/{ctr.id}/").status_code == 403
    assert (
        client_log.get(
            f"/api/v1/documents/reservation-drafts/{shared_reservation_draft.id}/instances/{ctr.id}/"
        ).status_code
        == 403
    )

    # 4. Unprivileged gets 403 on direct UUID and dossier detail
    client_unp = APIClient()
    client_unp.force_authenticate(user=unprivileged_user)
    for doc in (inv, dn, ctr):
        assert client_unp.get(f"/api/v1/documents/instances/{doc.id}/").status_code == 403
        assert (
            client_unp.get(
                f"/api/v1/documents/reservation-drafts/{shared_reservation_draft.id}/instances/{doc.id}/"
            ).status_code
            == 403
        )


# -----------------------------------------------------------------------------
# 5. Stale In-Memory Actor Revocation & Deactivation
# -----------------------------------------------------------------------------


def test_stale_in_memory_user_deactivation_rejects_document_access(
    accountant: User,
    shared_reservation_draft: ReservationDraft,
    shared_customer: Customer,
):
    inv = _create_doc_instance(
        document_type="invoice",
        reservation_draft=shared_reservation_draft,
        customer=shared_customer,
    )

    client = APIClient()
    client.force_authenticate(user=accountant)

    # Deactivate account directly in database without refreshing in-memory user instance
    User.objects.filter(pk=accountant.pk).update(is_active=False)

    # Must be immediately rejected
    res = client.get(f"/api/v1/documents/instances/{inv.id}/artifact/")
    assert res.status_code == 403

    res_pdf = client.get(f"/api/v1/documents/instances/{inv.id}/pdf/")
    assert res_pdf.status_code == 403

    res_direct = client.get(f"/api/v1/documents/instances/{inv.id}/")
    assert res_direct.status_code == 403


def test_stale_in_memory_user_revoked_staff_superuser_rejects_access(
    shared_reservation_draft: ReservationDraft,
    shared_customer: Customer,
):
    # Staff user with no specific role assigned
    staff_user = User.objects.create_user(
        username="temp_staff_doc",
        email="staff_doc@example.com",
        password="test-password-123",
        is_staff=True,
    )
    contract_doc = _create_doc_instance(
        document_type="contract",
        reservation_draft=shared_reservation_draft,
        customer=shared_customer,
    )

    client = APIClient()
    client.force_authenticate(user=staff_user)

    # Revoke staff and superuser in DB
    User.objects.filter(pk=staff_user.pk).update(is_staff=False, is_superuser=False)

    # Must be immediately rejected using persisted credentials
    res = client.get(f"/api/v1/documents/instances/{contract_doc.id}/artifact/")
    assert res.status_code == 403


# -----------------------------------------------------------------------------
# 6. Distinction: Generation, Modification, and Voiding Forbidden to Accountant
# -----------------------------------------------------------------------------


def test_accountant_forbidden_from_generation_and_mutation(
    accountant: User,
    shared_reservation_draft: ReservationDraft,
    shared_customer: Customer,
):
    client = APIClient()
    client.force_authenticate(user=accountant)

    # 1. Instance creation on draft
    res_create = client.post(
        f"/api/v1/documents/reservation-drafts/{shared_reservation_draft.id}/instances/",
        data={"template_key": "tpl_invoice"},
    )
    assert res_create.status_code == 403

    # 2. Instance generation
    doc = _create_doc_instance(
        document_type="invoice",
        reservation_draft=shared_reservation_draft,
        customer=shared_customer,
        status=DocumentInstanceStatus.PREPARED,
    )
    res_gen = client.post(
        f"/api/v1/documents/reservation-drafts/{shared_reservation_draft.id}/instances/{doc.id}/generate/"
    )
    assert res_gen.status_code == 403

    # 3. PDF generation
    res_pdf_gen = client.post(
        f"/api/v1/documents/reservation-drafts/{shared_reservation_draft.id}/instances/{doc.id}/generate-pdf/"
    )
    assert res_pdf_gen.status_code == 403

    # 4. Voiding
    res_void = client.post(
        f"/api/v1/documents/instances/{doc.id}/void/",
        data={"reason": "Testing unauthorized void"},
    )
    assert res_void.status_code == 403

    # 5. Convert to contract
    res_conv = client.post(f"/api/v1/documents/instances/{doc.id}/convert-to-contract/")
    assert res_conv.status_code == 403

    # 6. Content override
    res_override = client.post(
        f"/api/v1/documents/instances/{doc.id}/override-content/",
        data={"html_content": "<p>Modified</p>"},
    )
    assert res_override.status_code == 403


# -----------------------------------------------------------------------------
# 7. Absence of Private File Path Leaks in 403 and 404 Responses
# -----------------------------------------------------------------------------


def test_no_private_storage_path_leak_on_error(
    accountant: User,
    shared_reservation_draft: ReservationDraft,
    shared_customer: Customer,
):
    secret_storage_path = "artifacts/super_secret_internal_location/contract_001.html"
    contract_doc = _create_doc_instance(
        document_type="contract",
        reservation_draft=shared_reservation_draft,
        customer=shared_customer,
        storage_path=secret_storage_path,
    )

    client = APIClient()
    client.force_authenticate(user=accountant)

    # 403 error on unauthorized document
    res_403 = client.get(f"/api/v1/documents/instances/{contract_doc.id}/artifact/")
    assert res_403.status_code == 403
    assert "super_secret_internal_location" not in str(res_403.content)
    assert secret_storage_path not in str(res_403.content)

    # 404 error on nonexistent document
    nonexistent_id = uuid.uuid4()
    res_404 = client.get(f"/api/v1/documents/instances/{nonexistent_id}/artifact/")
    assert res_404.status_code == 404
    assert "artifacts" not in str(res_404.content)
