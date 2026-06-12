import pytest
from django.db import transaction

from apps.audit.models import AuditEvent
from apps.audit.services import record_audit_event_on_commit

pytestmark = pytest.mark.django_db


def _schedule_success_event(*, actor=None) -> None:
    record_audit_event_on_commit(
        actor=actor,
        action="reservation.sensitive_write_succeeded",
        target_type="reservation_draft",
        target_id="draft-123",
        metadata={"result": "success"},
    )


def test_success_audit_event_does_not_run_before_commit(django_capture_on_commit_callbacks) -> None:
    with django_capture_on_commit_callbacks(execute=False) as callbacks:
        _schedule_success_event()

        assert AuditEvent.objects.exists() is False

    assert len(callbacks) == 1
    assert AuditEvent.objects.exists() is False


def test_success_audit_event_is_persisted_after_commit(django_capture_on_commit_callbacks) -> None:
    with django_capture_on_commit_callbacks(execute=True):
        _schedule_success_event()

        assert AuditEvent.objects.exists() is False

    event = AuditEvent.objects.get()
    assert event.action == "reservation.sensitive_write_succeeded"
    assert event.target_type == "reservation_draft"
    assert event.target_id == "draft-123"
    assert event.metadata == {"result": "success"}


@pytest.mark.django_db(transaction=True)
def test_success_audit_event_is_not_persisted_after_rollback() -> None:
    with pytest.raises(RuntimeError):
        with transaction.atomic():
            _schedule_success_event()
            raise RuntimeError("rollback")

    assert AuditEvent.objects.exists() is False


def test_success_audit_event_keeps_actor_reference(
    django_capture_on_commit_callbacks,
    django_user_model,
) -> None:
    actor = django_user_model.objects.create_user(username="audit-actor")

    with django_capture_on_commit_callbacks(execute=True):
        _schedule_success_event(actor=actor)

    assert AuditEvent.objects.get().actor == actor
