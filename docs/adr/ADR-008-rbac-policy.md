# ADR-008: Role-Based Access Control Policy

## Status

Accepted

## Date

2026-07-20

## Context

The Hahitantsoa/Titan ERP needs a clear authorization policy before expanding
write surfaces. The backend already has permission classes on every view, but
the rules were implicit and undocumented.

## Decision

We adopt a two-tier RBAC model built on Django groups and ApplicationRole
assignments, enforced through DRF permission classes.

### Roles

| Role | Slug | Scope |
|------|------|-------|
| Identity Admin | `identity_admin` | Manage roles, users, identity settings |
| Reservation Sensitive Operator | `reservation_sensitive_operator` | All reservation, billing, payment, logistics, inventory write operations |

### Authorization Rules

1. **is_staff = True** bypasses both roles (legacy superuser path).
2. **identity_admin** role allows access to `/api/v1/identity/` endpoints.
3. **reservation_sensitive_operator** role allows access to all write endpoints
   in billing, payments, cashbox, logistics, inventory (stock/returns/damage),
   customers (write), reservations (confirm/cancel), audit (read), and
   Hahitantsoa event drafts (write).
4. **IsAuthenticated** is sufficient for all read-only endpoints (inventory
   catalog, reservation availability, document registry, Hahitantsoa discovery).
5. **IsAuthenticated*Boundary** classes are semantic markers that extend
   `IsAuthenticated` — they exist for future granularity, not current
   enforcement.

### Enforcement

- Permission classes are set on every DRF view (no unprotected endpoints).
- `HasReservationSensitiveAccess` checks `is_staff OR reservation_sensitive_operator`.
- `HasIdentityAdminAccess` checks `is_staff OR identity_admin`.
- Backend services also call `require_reservation_sensitive_actor()` for
  transaction-level authorization.

### Exclusions

- No row-level security (all authenticated users see all data in their scope).
- No per-field permission granularity.
- No API key or token-based auth (session-only for now).
- No anonymous access to any business endpoint.

## Consequences

- Positive: Clear, auditable authorization on every write path.
- Positive: Two roles are sufficient for the current business size.
- Positive: Adding new roles later does not require removing existing ones.
- Risk: `is_staff` bypass means staff accounts have full access — protect
  staff credentials carefully.
- Future: Granular roles (inventory_manager, billing_operator) can be added
  when the team grows without changing the authorization architecture.
