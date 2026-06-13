from types import SimpleNamespace
from uuid import uuid4

import pytest
from django.core.files.storage import FileSystemStorage
from rest_framework.test import APIRequestFactory, force_authenticate

import apps.documents.selectors as document_selectors
from apps.documents.models import DocumentInstanceStatus
from apps.documents.views import DocumentInstancePrivateArtifactAPIView

pytestmark = pytest.mark.django_db


@pytest.fixture
def api_factory():
    return APIRequestFactory()


@pytest.fixture
def authenticated_user():
    return SimpleNamespace(is_authenticated=True)


@pytest.fixture(autouse=True)
def isolated_document_storage(tmp_path, monkeypatch):
    """Redirect artifact writes/reads to a pytest-managed temp directory."""
    storage = FileSystemStorage(location=str(tmp_path))
    monkeypatch.setattr("django.core.files.storage.default_storage", storage)
    return storage


def _artifact_url(instance_id) -> str:
    return f"/api/v1/documents/instances/{instance_id}/artifact/"


def _request(api_factory, method: str, path: str, authenticated_user=None):
    request_method = getattr(api_factory, method)
    request = request_method(path)
    if authenticated_user is not None:
        force_authenticate(request, user=authenticated_user)
    return request


def test_private_artifact_api_requires_authentication(api_factory) -> None:
    instance_id = uuid4()
    view = DocumentInstancePrivateArtifactAPIView.as_view()
    request = _request(api_factory, "get", _artifact_url(instance_id))
    response = view(request, id=instance_id)
    assert response.status_code in {401, 403}


def test_private_artifact_api_not_found(api_factory, authenticated_user) -> None:
    instance_id = uuid4()
    view = DocumentInstancePrivateArtifactAPIView.as_view()
    request = _request(api_factory, "get", _artifact_url(instance_id), authenticated_user)
    response = view(request, id=instance_id)
    assert response.status_code == 404


def test_private_artifact_api_not_generated(api_factory, authenticated_user, monkeypatch) -> None:
    instance_id = uuid4()
    fake_instance = SimpleNamespace(
        id=instance_id,
        status=DocumentInstanceStatus.PREPARED,
        storage_path=None,
    )
    monkeypatch.setattr(
        document_selectors,
        "get_document_instance_by_id",
        lambda document_instance_id: fake_instance if document_instance_id == instance_id else None,
    )
    view = DocumentInstancePrivateArtifactAPIView.as_view()
    request = _request(api_factory, "get", _artifact_url(instance_id), authenticated_user)
    response = view(request, id=instance_id)
    assert response.status_code == 404


def test_private_artifact_api_missing_storage_path(
    api_factory, authenticated_user, monkeypatch
) -> None:
    instance_id = uuid4()
    fake_instance = SimpleNamespace(
        id=instance_id,
        status=DocumentInstanceStatus.GENERATED,
        storage_path=None,
    )
    monkeypatch.setattr(
        document_selectors,
        "get_document_instance_by_id",
        lambda document_instance_id: fake_instance if document_instance_id == instance_id else None,
    )
    view = DocumentInstancePrivateArtifactAPIView.as_view()
    request = _request(api_factory, "get", _artifact_url(instance_id), authenticated_user)
    response = view(request, id=instance_id)
    assert response.status_code == 404


def test_private_artifact_api_file_not_found_in_storage(
    api_factory, authenticated_user, monkeypatch
) -> None:
    instance_id = uuid4()
    fake_instance = SimpleNamespace(
        id=instance_id,
        status=DocumentInstanceStatus.GENERATED,
        storage_path="documents/nonexistent/checksum.html",
    )
    monkeypatch.setattr(
        document_selectors,
        "get_document_instance_by_id",
        lambda document_instance_id: fake_instance if document_instance_id == instance_id else None,
    )
    view = DocumentInstancePrivateArtifactAPIView.as_view()
    request = _request(api_factory, "get", _artifact_url(instance_id), authenticated_user)
    response = view(request, id=instance_id)
    assert response.status_code == 404


def test_private_artifact_api_success(
    api_factory, authenticated_user, isolated_document_storage, monkeypatch
) -> None:
    instance_id = uuid4()
    storage_path = f"documents/{instance_id}/checksum.html"
    html_content = "<html><body>Private Document Artifact</body></html>"

    # Write the fake file to our isolated storage
    from django.core.files.base import ContentFile

    isolated_document_storage.save(storage_path, ContentFile(html_content.encode("utf-8")))

    fake_instance = SimpleNamespace(
        id=instance_id,
        status=DocumentInstanceStatus.GENERATED,
        storage_path=storage_path,
    )
    monkeypatch.setattr(
        document_selectors,
        "get_document_instance_by_id",
        lambda document_instance_id: fake_instance if document_instance_id == instance_id else None,
    )

    view = DocumentInstancePrivateArtifactAPIView.as_view()
    request = _request(api_factory, "get", _artifact_url(instance_id), authenticated_user)
    response = view(request, id=instance_id)

    assert response.status_code == 200
    assert response.content.decode("utf-8") == html_content
    assert response.headers["Content-Type"] == "text/html; charset=utf-8"


@pytest.mark.parametrize("method", ["post", "put", "patch", "delete"])
def test_private_artifact_api_get_only(api_factory, authenticated_user, method: str) -> None:
    instance_id = uuid4()
    view = DocumentInstancePrivateArtifactAPIView.as_view()
    request = _request(api_factory, method, _artifact_url(instance_id), authenticated_user)
    response = view(request, id=instance_id)
    assert response.status_code == 405
