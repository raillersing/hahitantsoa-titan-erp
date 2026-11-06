# ADR-011: Role-Based Access Control Policy

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

## Accepted amendment — 2026-11-06 user-access audit

The client explicitly approved the user-access audit and its implementation on
2026-11-06. This amendment supersedes the original two-role restrictions where
specified below; all confirmation and financial lifecycle prerequisites remain.

- Company dossiers are shared across authorized employees. Creator attribution
  is audit information, not dossier ownership. Existing authenticated draft
  consultation/editing remains; private notifications and import jobs retain
  their separate user scopes.
- `owner_manager` grants full business management: commercial actions, inventory,
  finance, logistics, cashbox supervision/overrides and collaborator management.
  It never sets Django `is_staff` or `is_superuser`, grants technical cleanup, or
  permits takeover of platform accounts. Only staff may manage staff targets;
  only a superuser may manage superuser targets. Delegated identity administrators
  cannot reset or suspend a more privileged administrator.
- `manager` grants commercial operations, inventory and finance, with no identity
  administration or implicit cashbox supervision/override.
- `storekeeper` and `logistics_manager` grant physical stock and logistics actions
  without granting payment, contract confirmation or financial damage settlement.
  Other company roles do not inherit these rights merely by their descriptions.
- Cashbox operators and supervisors may reach their relevant routes without the
  commercial role; operator/supervisor service checks and peer-cashbox boundaries
  remain mandatory. Supported legacy groups and active application assignments
  use the same effective-role source.
- Reserved platform roles, `owner_manager`, `manager` and `logistics_override` cannot be
  created or renamed by a delegated identity administrator. The owner may assign
  existing business capabilities through audited services, subject to protected
  account checks. Role descriptions and custom role names grant nothing by themselves.
- Revoking an effective supported role removes both the application assignment
  and its supported legacy group grant. The administration shows effective roles
  and their source. Suspension invalidates existing database sessions durably;
  subsequent reactivation requires login again.
- The server exposes computed capabilities in session, user and role responses.
  Frontend labels, summaries and navigation consume them; they are presentation
  hints, never authorization. Inactive users have no effective capabilities.
- Private document access must be consistent across HTML/PDF. Generating an
  outbound delivery note checks physical-operation authority in its service.
  Document configuration writes require explicit authorization, attribution,
  transactions and an audited activation serialized by parent template.

No bulk role reassignment or production data migration is authorized by this
amendment. Existing records are preserved. Passwords must not be described as
expiring unless the backend actually implements expiration. Deployment and merge
remain separate human-controlled operations.
