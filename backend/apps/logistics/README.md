# Logistics

This app hosts backend logistics and delivery/pickup event management.

## Implemented scope

- LogisticsEvent model with UUID, audit, and status tracking.
  - Event types: delivery, pickup, preparation, handover.
  - Preparation (preparation) represents internal sortie/preparation (INV-010).
  - Handover (handover) represents client passation/delivery (INV-011).
  - Status lifecycle: planned ? dispatched ? completed or cancelled.
  - FK to ReservationDraft with PROTECT.
  - Scheduled/executed timestamps, address, contact info, notes.
  - Model-level validation enforcing status/timestamp consistency.
- Service layer (services.py):
  - create_logistics_event
  - update_logistics_event
  - 	ransition_logistics_event_status
  - Explicit status transition rules and reservation-sensitive actor authorization.
- Selector layer (selectors.py):
  - ctive_logistics_events
  - logistics_events_for_reservation_draft
- REST API (iews.py + urls.py):
  - GET /api/v1/logistics/events/ ? list (optionally filter by
eservation_draft_id).
  - GET /api/v1/logistics/events/<id>/ ? retrieve.
  - POST /api/v1/logistics/events/create/ ? create.
  - POST /api/v1/logistics/events/<id>/update/ ? update.
  - POST /api/v1/logistics/events/<id>/transition/ ? status transition.
- All write endpoints require HasReservationSensitiveAccess.
