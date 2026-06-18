# Audit

This app hosts backend audit event recording and read-only retrieval.

## Implemented scope

- `AuditEvent` model with actor, action, target_type, target_id, metadata, and timestamps.
- `record_audit_event_on_commit` service for fire-and-forget audit recording via `transaction.on_commit`.
- Read-only REST API (`views.py` + `urls.py`):
  - `GET /api/v1/audit/events/` ? list audit events, filterable by `action`, `target_type`, and `actor_id`.
  - `GET /api/v1/audit/events/<id>/` ? retrieve a single audit event.
- All endpoints require `HasReservationSensitiveAccess`.
- Selectors (`selectors.py`) provide filtered queryset helpers.

## Still out of scope

- No write endpoints for audit events (events are only created via service layer internally).
- No bulk export or external streaming.
