# Identity

This app hosts backend identity and role management.

## Implemented scope

- ApplicationRole model with UUID, audit timestamps, soft-description, system-managed flag, and active state.
- UserRoleAssignment model linking users to roles with attribution (ssigned_by, ssigned_at), revocation tracking (
evoked_at, is_active), notes, and database-level unique constraint on active assignments.
- Service-layer helpers (services.py):
  - sync_system_roles - seeds ApplicationRole records from the IdentityRole enum.
  - ssign_role - atomic role assignment with duplicate-prevention via select_for_update.
  -
evoke_role - soft revocation with system-role protection.
- Selector helpers (selectors.py):
  - ctive_roles, user_active_assignments, user_has_application_role, user_effective_role_slugs.
- REST API (iews.py + urls.py):
  - GET /api/v1/identity/roles/ - list active roles.
  - POST /api/v1/identity/roles/sync-system/ - seed system roles.
  - GET /api/v1/identity/assignments/ - list assignments (filterable by user_id and is_active).
  - POST /api/v1/identity/assignments/assign/ - assign a role to a user.
  - POST /api/v1/identity/assignments/<id>/revoke/ - revoke an assignment.
- Django admin registrations for both models.
- All endpoints require HasReservationSensitiveAccess (staff or reservation-sensitive operator).
- Backward-compatible with the narrow #279 foundation:
  - existing
oles.py, uthorization.py, permissions.py, and HasReservationSensitiveAccess remain unchanged.
  - new ctor_has_application_role and DB-backed assignment selectors complement the legacy group-based checks.

## Still out of scope

- Custom authentication backends or JWT/token auth (DRF session auth remains the standard).
- Frontend role-management UI.
- Broad RBAC outside the reservation-sensitive boundary.
