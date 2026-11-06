from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from uuid import uuid4

import pytest
from django.contrib.auth import get_user_model
from django.db import close_old_connections
from django.test import Client

from apps.audit.models import AuditEvent
from apps.documents.models import DocumentTemplate, DocumentTemplateVersion
from apps.documents.services import activate_document_template_version
from apps.inventory.services import issue_delivery_note_stock

pytestmark = pytest.mark.django_db


def template():
    return DocumentTemplate.objects.create(
        code="security-test",
        name="Test",
        business_scope="titan",
        document_type="proforma",
    )


@pytest.mark.parametrize(
    "path",
    [
        "/api/v1/documents/document-templates/",
        "/api/v1/documents/document-template-versions/",
    ],
)
def test_consultation_user_cannot_create_document_configuration(path):
    client = Client()
    client.force_login(get_user_model().objects.create_user(username="reader"))
    assert client.post(path, {}, content_type="application/json").status_code == 403


def test_pdf_cannot_bypass_sensitive_permission():
    client = Client()
    user = get_user_model().objects.create_user(username="reader")
    client.force_login(user)
    assert client.get(f"/api/v1/documents/instances/{uuid4()}/pdf/").status_code == 403
    path = f"/api/v1/hahitantsoa/event-drafts/{uuid4()}/documents/{uuid4()}/generate-pdf/"
    assert client.post(path).status_code == 403
    with pytest.raises(PermissionError):
        issue_delivery_note_stock(document_instance=None, actor=user)


def test_activation_requires_privilege_and_is_audited(django_capture_on_commit_callbacks):
    t = template()
    a = DocumentTemplateVersion.objects.create(template=t, version="1", status="active")
    b = DocumentTemplateVersion.objects.create(template=t, version="2")
    client = Client()
    reader = get_user_model().objects.create_user(username="reader")
    client.force_login(reader)
    path = f"/api/v1/documents/document-template-versions/{b.pk}/activate/"
    assert client.post(path).status_code == 403
    a.refresh_from_db()
    assert a.status == "active"
    actor = get_user_model().objects.create_user(username="admin", is_staff=True)
    client.force_login(actor)
    with django_capture_on_commit_callbacks(execute=True):
        assert client.post(path).status_code == 200
    a.refresh_from_db()
    b.refresh_from_db()
    assert a.status == "archived" and b.status == "active"
    assert AuditEvent.objects.filter(
        action="documents.template_version_activated", actor=actor
    ).exists()


@pytest.mark.django_db(transaction=True)
def test_competing_activations_leave_one_active_version():
    t = template()
    versions = [DocumentTemplateVersion.objects.create(template=t, version=str(i)) for i in (1, 2)]
    actor = get_user_model().objects.create_user(username="admin", is_staff=True)
    barrier = Barrier(2)

    def activate(version_id):
        close_old_connections()
        user = get_user_model().objects.get(pk=actor.pk)
        barrier.wait(timeout=10)
        try:
            activate_document_template_version(actor=user, version_id=version_id)
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(activate, version.pk) for version in versions]
        for future in futures:
            future.result(timeout=30)
    assert DocumentTemplateVersion.objects.filter(template=t, status="active").count() == 1


@pytest.mark.parametrize(
    "document_type, allowed",
    [("delivery_note", True), ("preparation_sheet", True), ("invoice", False), ("contract", False)],
)
def test_stock_role_sees_only_operational_private_documents(document_type, allowed):
    from types import SimpleNamespace

    from django.core.exceptions import PermissionDenied

    from apps.documents.services import require_private_document_actor
    from apps.identity.models import ApplicationRole, UserRoleAssignment

    user = get_user_model().objects.create_user(username="stock")
    role = ApplicationRole.objects.create(name="Stock", slug="storekeeper")
    UserRoleAssignment.objects.create(user=user, role=role)
    document = SimpleNamespace(document_type=document_type)
    if allowed:
        require_private_document_actor(actor=user, document_instance=document)
    else:
        with pytest.raises(PermissionDenied):
            require_private_document_actor(actor=user, document_instance=document)


def test_creating_active_version_cannot_bypass_activation_policy():
    from apps.documents.services import create_document_template_record

    t = template()
    previous = DocumentTemplateVersion.objects.create(template=t, version="1", status="active")
    actor = get_user_model().objects.create_user(username="admin", is_staff=True)
    created = create_document_template_record(
        actor=actor,
        validated_data={"template": t, "version": "2", "status": "active"},
        version=True,
    )
    previous.refresh_from_db()
    assert previous.status == "archived"
    assert created.status == "active"
    assert DocumentTemplateVersion.objects.filter(template=t, status="active").count() == 1
