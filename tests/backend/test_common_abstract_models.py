import uuid

from django.apps import apps
from django.db import models

from apps.common.models import AuditableModel, SoftDeleteModel, TimestampedModel, UUIDModel


def test_common_models_are_abstract() -> None:
    assert UUIDModel._meta.abstract is True
    assert TimestampedModel._meta.abstract is True
    assert SoftDeleteModel._meta.abstract is True
    assert AuditableModel._meta.abstract is True


def test_common_app_has_no_concrete_models() -> None:
    assert list(apps.get_app_config("common").get_models()) == []


def test_uuid_model_id_field() -> None:
    field = UUIDModel._meta.get_field("id")

    assert isinstance(field, models.UUIDField)
    assert field.primary_key is True
    assert field.default is uuid.uuid4
    assert field.editable is False


def test_timestamped_model_fields() -> None:
    created_at = TimestampedModel._meta.get_field("created_at")
    updated_at = TimestampedModel._meta.get_field("updated_at")

    assert isinstance(created_at, models.DateTimeField)
    assert created_at.auto_now_add is True
    assert isinstance(updated_at, models.DateTimeField)
    assert updated_at.auto_now is True


def test_soft_delete_model_fields() -> None:
    is_deleted = SoftDeleteModel._meta.get_field("is_deleted")
    deleted_at = SoftDeleteModel._meta.get_field("deleted_at")

    assert isinstance(is_deleted, models.BooleanField)
    assert is_deleted.default is False
    assert isinstance(deleted_at, models.DateTimeField)
    assert deleted_at.null is True
    assert deleted_at.blank is True


def test_auditable_model_fields() -> None:
    created_by = AuditableModel._meta.get_field("created_by")
    updated_by = AuditableModel._meta.get_field("updated_by")

    assert isinstance(created_by, models.ForeignKey)
    assert created_by.null is True
    assert created_by.blank is True
    assert created_by.remote_field.on_delete is models.SET_NULL
    assert created_by.remote_field.related_name == "+"

    assert isinstance(updated_by, models.ForeignKey)
    assert updated_by.null is True
    assert updated_by.blank is True
    assert updated_by.remote_field.on_delete is models.SET_NULL
    assert updated_by.remote_field.related_name == "+"
