from collections.abc import Mapping

from django.db import transaction

from apps.audit.models import AuditEvent


def record_audit_event_on_commit(
    *,
    actor: object | None,
    action: str,
    target_type: str,
    target_id: str,
    metadata: Mapping[str, object] | None = None,
) -> None:
    event_metadata = dict(metadata or {})
    actor_id = getattr(actor, "pk", None)

    transaction.on_commit(
        lambda: AuditEvent.objects.create(
            actor_id=actor_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            metadata=event_metadata,
        )
    )
