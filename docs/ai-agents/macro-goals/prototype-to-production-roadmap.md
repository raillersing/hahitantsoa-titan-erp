# ERP Prototype-to-Production Roadmap

## Purpose

This document is the durable program roadmap for transforming the validated React
prototype into a persistent, secure, multi-user, commercially operable ERP. It records
the sequence and proof gates; it does not authorize implementation by itself.

The validated UI in `frontend/src/prototype/` remains the visual and interaction target.
Historically connected React panels may provide contracts, types, hooks, error handling,
and tests, but must not replace the approved interface.

## Authority and live-state rule

- Accepted decisions, ADRs, source references, business rules, and architecture remain
  authoritative in the order defined by `AGENTS.md`.
- The live task-start baseline wins over static status in this document.
- Detailed executable work belongs in `orchestrator-task-queue.md`, one medium bundle,
  branch, worktree, and PR at a time.
- A phase changes status only after its evidence is linked below or in the task queue.
- `Non confirmé` means that the required proof was not available; it must not be
  interpreted as either success or failure.

## Execution order and phase closeout

Agents follow this order and must not start a later phase before the preceding phase has
its required evidence and human acceptance:

1. Phase 1 — authentication, session, and RBAC;
2. Phase 2 — customers and prospects read-only;
3. Phase 3 — customers and prospects writes;
4. Phase 4 — catalog, offers, and inventory;
5. Phase 5 — reservations and availability;
6. Phase 6 — documents and templates;
7. Phase 7 — billing, payments, and cashbox;
8. Phase 8 — logistics, returns, and incidents;
9. Phase 9 — audit, administration, and reports;
10. Phase 10 — removal of production mocks;
11. Phase 11 — production readiness;
12. Phase 12 — commercial acceptance.

For every phase, execute its approved medium bundles sequentially. Each bundle retains
proportional local evidence and mandatory PR/exact-SHA `main` CI. After all bundles are
merged, run one read-only phase integration checkpoint covering the complete affected
stacks and journeys, then implement one consolidated corrective bundle for ordinary
findings. Security, authorization, data-integrity, migration, financial, concurrency,
CI, and release-blocking findings remain immediate corrective work.

Current next bundle: **Phase 2 — customers and prospects read-only**. Phase 1F-E
consolidated authentication evidence is integrated with exact-SHA evidence and
human acceptance. Phase 1F-B/C
strict real-backend session acceptance and Phase 1F-D real admin/operator audit
authorization are integrated with exact-SHA evidence. Phase 1F-A automated role
acceptance is also integrated with exact-SHA evidence.

## Product target

The program is complete only when the production runtime:

- uses PostgreSQL and Django as the source of truth for business data;
- uses real Django authentication and backend-enforced permissions;
- persists authorized writes across reload, logout, and a second authorized session;
- validates business invariants and conflicts on the server;
- audits sensitive documents, payments, stock, and operational transitions;
- has no production business-data fallback to mocks or `localStorage`;
- has tested deployment, monitoring, backup, restore, rollback, and incident procedures;
- passes multi-role commercial acceptance with the approved responsive interface.

### Approved commercial interface hard stop

The validated commercial interface is a protected product contract. During
backend integration, agents must preserve its screens, fields, actions, filters,
and workflows even when the current API is incomplete. An incomplete contract
must produce a documented integration blocker, not a reduced interface or a
silent mock fallback. Any material UI change requires explicit written client
authorization; this rule remains active until the client explicitly cancels it.

## Module maturity scale

Each module has exactly one evidence-backed state.

| State | Verifiable meaning |
|---|---|
| `P0 — Prototype UI` | Runtime behavior is mock/static only. |
| `P1 — Connected read` | Reads use the real API with explicit loading, empty, denied, expired-session, not-found, and retry states; there is no silent mock fallback. |
| `P2 — Connected read/write` | Applicable writes are server-validated and persist in PostgreSQL across reload and another authorized session. |
| `P3 — Secured and tested` | Backend authorization, validation, audit, and backend/frontend/E2E tests prove the module behavior. |
| `P4 — Production ready` | Operations, observability, backup/restore, security, documentation, and final business acceptance are proven. |

A module cannot advance on UI visibility alone. Hiding a frontend action is not an
authorization control, and a successful mock notification is not persistence evidence.

## Current program checkpoint

Checkpoint date: 2026-07-18. Current verified baseline:
`58b6b90be7563ebb0667c5f84058d08990ba0b63`, with exact-SHA `main` CI success in run
`29639718831`.

| Item | Status | Evidence or limitation |
|---|---|---|
| Phase 0 audit | Completed as a local read-only report | `reports/ERP_PROTOTYPE_TO_PRODUCTION_PHASE0_AUDIT_2026-07-15.md`; local and gitignored, therefore not a versioned proof artifact. |
| Phase 1A auth contract audit | Completed as a local read-only report | `reports/ERP_PROTOTYPE_TO_PRODUCTION_PHASE1A_AUTH_CONTRACT_AUDIT_2026-07-15.md`; local and gitignored. |
| Phase 1B backend session/CSRF | Completed and integrated | PR `#460`, merged `main` SHA `3ba2b669b728f34c6f3dda5b1cf129aff1431d8d`, exact-SHA CI run `29443962863` green. |
| Phase 1B frontend authentication/session connection | Completed, integrated, and validated by the human | PR `#466`, reviewed head `5689629fbfc1097344f725efa466a9b1bff86dbb`, merged `main` SHA `97768abae975e337a08497fae40f18f2399df888`, exact-SHA CI run `29497402230` green. The approved prototype UI now uses the real Django session contract, centralized CSRF handling, real logout, and explicit loading/error/retry states; the former `checkAuth` bypass is removed. |
| Phase 1C session resilience and profile | Completed, integrated, and validated by the human | PR `#468`, reviewed head `8cb6b03e1241a4b10056cc1922091c4056b4960c`, merged `main` SHA `306ab3d14576aacd0f05df47798eaba265799d43`, exact-SHA CI run `29510304381` green, and independent FE-B verdict `APPROVE`. The mounted prototype now exposes the real session user in a read-only profile and handles session expiry, offline/online recovery, and coalesced revalidation without replacing backend data with a mock. Frontend evidence: build green, Vitest 42 files / 436 tests green, and real-backend Playwright 3/3 green. |
| Phase 1D structured route protection | Completed, integrated, and validated by the human | PR `#470`, reviewed head `136b120f1072a8d0bda86d8679a3cec7ee613a04`, merged `main` SHA `db88076aa0ee0c577837aa731d2dd4fdb69a1f1e`, exact-SHA CI run `29527965807` green, and independent FE-B/FE-C/FE-D verdicts `APPROVE`. The approved prototype now uses structured protected hash routing, preserves intended destinations and browser history, and presents an explicit not-found state. Frontend evidence: build green, Vitest 44 files / 445 tests green, and real-backend Playwright 3/3 green. PR CI run `29527836782` was green for frontend, classification, and policy; backend was skipped as expected for the frontend-only scope. |
| Phase 1E-BE backend role/permission consolidation | Completed and integrated | PR `#480`, reviewed head `531140abbb6be5ea95704e8c50f869e0781422bd`, merged `main` SHA `42f49293ff5a5540a1948fac7a831ed2a1db7246`, exact-SHA CI run `29636383746` green. Delegated identity administration is anti-escalation guarded, system/reserved roles are platform-only and immutable, approved groups are reconciled with active roles, assignment attribution/audit is durable, and negative API/service tests pass. |
| Phase 1E-FE capability-aware frontend | Completed and integrated | PR `#481`, reviewed head `cf5097771490e43458ed1abfd825f7f29c4e1273`, merged `main` SHA `fe07323adee896bf7e54511c4b341c9df9e03f2e`, exact-SHA CI run `29638784261` green. Navigation, deep-links, reservation creation/preparation actions, and sensitive customer/inventory entry points are derived from the real session capabilities with deny-by-default UI hints; backend authorization remains authoritative. Frontend CI passed with 46 files / 459 tests and production build. |
| Phase 1F-A automated role acceptance and runtime hygiene | Completed and integrated | PR `#482`, reviewed head `ee3830b13d2c467cfd3e1b92bac1a343e1e63530`, merged `main` SHA `58b6b90be7563ebb0667c5f84058d08990ba0b63`, exact-SHA CI run `29639718831` green. Playwright covers empty/unknown/identity-admin/reservation-sensitive/staff fixtures, forbidden deep-links, 320/375/1440 widths, console errors, failed/external/unexpected API requests; 18 targeted browser tests passed. |
| Phase 1 through multi-role acceptance | Completed and integrated | Phase 1F-E checkpoint: `docs/audits/PHASE1F_E_AUTHENTICATION_CHECKPOINT.md`. Main baseline `6943edd1e05170ff386182d5061de8a3256c5735`, main CI `29665879463` green, Vitest 46 files / 461 tests, real-backend Playwright 3/3, and human acceptance recorded on 2026-07-19. |
| Codex skills reassessment and deduplication | Completed and integrated | PR `#461`, merged `main` SHA `de746e29e907759acb36accf98ddd625669d542a`, exact-SHA CI run `29488633090` green. |
| Graphify/Ponytail durable-memory policy | Completed and integrated | PR `#462`, merged `main` SHA `31262c948e412343e74c8ee505f12c519607c4b0`, exact-SHA CI run `29489955113` green. |
| Proportional local-test matrix | Completed and integrated | PR `#463`, merged `main` SHA `a96ea1f3edd174cd9d03e0c594aee62e65247057`, exact-SHA CI run `29491225953` green. |
| Path/risk-aware CI and Graphify gate hardening | Completed and integrated | PR `#464`, reviewed head `792ed06eb9a9ba417c8087931eec953106c94c5f`, merged `main` SHA `8359c3a1c43126147845ebb9c0cfbc8894971466`, exact-SHA CI run `29493976339` green. |
| Phases 2–12 | Planned, not started by this roadmap | No phase may be inferred complete from historical panels or backend endpoints alone. |

The current phase is **Phase 1**. Phase 2 must not start until all Phase 1 exit gates are
met and validated by the human.

## Versioned module checkpoint

Checkpoint source: local read-only Phase 0 audit dated 2026-07-15, performed on
`c2616d652643c0c7699dd0187c1a51e9466a9164`. The report is stored locally at
`reports/ERP_PROTOTYPE_TO_PRODUCTION_PHASE0_AUDIT_2026-07-15.md` and is gitignored.
This table preserves its compact program-level findings; it is not a substitute for
rerunning the inventory on the live implementation baseline.

Maturity below describes the **mounted visible runtime**, not the mere existence of an
endpoint, model, historical connected panel, or isolated backend test. `API/model` lists
known reusable backend assets and explicitly marks missing or unconfirmed contracts.

| Module / surface | Mounted route and component | Runtime source at checkpoint | API / persistent model known at checkpoint | Permissions, audit, tests | Visible maturity | Confirmed anomaly or uncertainty | Next bounded action |
|---|---|---|---|---|---:|---|---|
| Authentication and session | Approved login UI and prototype shell gated by `AuthProvider`; intended hash destination preserved across login and structured protected navigation; read-only profile mounted from the real session identity | Real Django session API; no authentication bypass or business-auth fallback; authenticated identity is preserved during recoverable network loss and revalidated on recovery | `/api/v1/auth/session/`, `/api/v1/auth/login/`, `/api/v1/auth/logout/`; Django session and CSRF contracts | Backend auth contract tests plus frontend build, role-matrix Playwright 18/18, real-backend session acceptance 2/2 in PR #485, real admin/operator audit authorization in PR #487, and Phase 1F-E evidence: Vitest 461/461 and Playwright 3/3 | P1 | Authentication/session exit evidence is complete for the approved scope; business modules remain separate roadmap work | Phase 2 |
| Dashboard | `#dashboard` → `prototype/DashboardPage` | Mock/static | Aggregates dispersed; consolidated dashboard endpoint `Non confirmé` | Authenticated access/audit/test coverage for displayed totals `Non confirmé` | P0 | Visible indicators do not prove PostgreSQL origin | Reassess after Phases 2–9; target phase for a consolidated read model requires contract decision |
| Customers and prospects | `#customers`, `#customer/:id` → prototype customer pages | `mockClients`, `mockReservations`, reservation draft in `localStorage` | Customers API / `Customer`; prospect, conversion, history, and visitor contracts missing at checkpoint | Customer endpoint permissions exist; full role/object access and visible-flow tests not proven | P0 | Prototype DTO richer than backend; prospect lifecycle absent | Phases 2–3 |
| Titan reservations | `#reservation-new`, `#reservation-detail/:id`, `#reservations` → prototype reservation pages | Mock plus business draft in `localStorage` | Reservation draft APIs / `ReservationDraft`, `ReservationLine` | Sensitive confirmation controls and audit exist backend-side; mounted-flow proof absent | P0 | Mock type merges concepts that backend keeps separate; no visible persistence | Phase 5 |
| Hahitantsoa events | `#hahitantsoa` and reservation surfaces → prototype pages | Mock/static | Hahitantsoa event APIs / event draft, lines, amendments | Backend permissions/audit partly present; visible multi-role tests absent | P0 | Titan/Hahitantsoa boundary must remain explicit | Phase 5 |
| Catalog, packs, services, venues | `#packages`, `#services`, `#venues` → prototype pages | Mock; packs persisted in business `localStorage` | Dedicated Hahitantsoa catalog/price/media contracts and models missing at checkpoint | Permissions, audit, and production tests `Non confirmé` | P0 | Backend scope and commercial rules require approval; Titan must not expose venues/services | Phase 4; business decision required before missing contracts |
| Inventory and stock movements | `#inventory`, `#inventory-management`, `#inventory-item/:id`, `#stock-movements` → prototype pages | Mock | Inventory APIs / items, availability, stock movements, returns, damage/loss | Backend auth/audit/tests exist for several operations; mounted UX not connected | P0 | Prototype fields and CRUD exceed confirmed backend contract | Phase 4, then Phase 8 for return/incident effects |
| Planning | `#planning` → `prototype/PlanningPage` | Mock/static | Reservation availability APIs; complete calendar/appointment read model `Non confirmé` | Access and source-of-truth tests for displayed calendar `Non confirmé` | P0 | A validated-looking calendar is not evidence of real availability | Phase 5 for reservation planning; remaining agenda scope requires decision |
| Visitor agenda | `#agenda-visitors` → `prototype/AgendaVisitorsPage` | Mock/static | Visitor/appointment endpoint and model missing at checkpoint | Permissions, audit, tests absent or `Non confirmé` | P0 | Ownership, retention, and relation to customers/prospects not specified | Candidate Phase 2/9 only after business and privacy decision; otherwise outside MVP |
| Documents and templates | `#documents` → `prototype/DocumentsPage` | Mock plus template business `localStorage` | Document instance/generation APIs / `DocumentInstance`; persistent template/version models missing on `main` at checkpoint | Sensitive document permissions/audit partly exist; mounted template flow uses mocks | P0 | Dirty R7B worktree requires lossless reconciliation; private PDF access finding remains relevant until reverified | Phase 6 after dedicated R7B preflight |
| Billing and payments | `#commercial-ops` → `prototype/CommercialOpsPage` | Mock/static | Billing/payment APIs / invoices, installments, allocations, payments, credit notes, refund obligations | Sensitive backend permissions/audit/tests exist; mounted workflow proof absent | P0 | No visible request/persistence evidence; simulated success prohibited | Phase 7 |
| Cashbox and cautions | `#cashbox`, `#caution` → prototype pages | Mock/static and `mockCautions` | Cashbox APIs / sessions and movements; caution/refund obligations in inventory domain | Backend permission/audit coverage partly present; visible role tests absent | P0 | UI data not connected; lifecycle coherence with payments/returns must be proven | Phase 7, with Phase 8 dependencies for returns/damage |
| Logistics, returns, damage/loss | `#stock-preparation`, `#logistics-dispatch`, `#logistics-returns`, `#breakage-loss` → prototype pages | Mock | Logistics/inventory APIs / events, item lines, returns, settlements | Backend transitions, permissions, audit, and tests partly exist; mounted workflow absent | P0 | Mock transitions do not prove stock effects or rollback consistency | Phase 8 |
| Audit, identity, and administration | `#audit`, `#admin` → prototype pages | Mock/static; system preferences announced as local | Audit/identity APIs / `AuditEvent`, `ApplicationRole`, `UserRoleAssignment` | Phase 0 found split role authorities and incomplete RBAC audit; admin visible flow unproven | P0 | Reservation-sensitive permission was too broad for identity administration; settings persistence contract missing | Phase 1E–1F for RBAC, Phase 9 for administration/settings |
| Reports and exports | `#reports` → `prototype/ReportsPage` | Mock/static | PostgreSQL report/export endpoints missing at checkpoint | Export authorization, audit, retention, and tests absent or `Non confirmé` | P0 | Business/legal scope, formats, and sensitive-export policy unresolved | Phase 9, blocked pending business/legal and API decisions |
| Excel import | `#import-excel` → fallback `PlaceholderPage` | No functional mounted workflow confirmed | Preview/mapping/validation/commit/rollback API and persistence missing at checkpoint | Upload validation, permission, audit, rollback tests `Non confirmé` | P0 | File format, limits, data ownership, and atomic import policy undecided | Phase target `Non confirmé`; decision required, otherwise outside MVP |
| HR and payroll | `#hr-payroll` → fallback `PlaceholderPage` | No functional mounted workflow confirmed | Endpoint/model absent at checkpoint | Legal access, audit, retention, payroll tests `Non confirmé` | P0 | Highly sensitive domain has no approved business/legal contract | Phase target `Non confirmé`; blocked pending explicit scope, possibly outside MVP |
| Purchasing, suppliers, expenses | `#purchasing` → fallback `PlaceholderPage` | No functional mounted workflow confirmed | Endpoint/model absent at checkpoint | Permissions, approval workflow, audit, accounting tests `Non confirmé` | P0 | Business process and accounting boundaries not approved | Phase target `Non confirmé`; business decision required, possibly post-MVP |
| Notifications | `#notifications` → fallback `PlaceholderPage` | No functional mounted workflow confirmed | Notification/preference endpoint and persistent model absent at checkpoint | Delivery authorization, privacy, retry, and tests `Non confirmé` | P0 | Channels, providers, consent, retention, and failure policy undecided | Phase target `Non confirmé`; decide MVP in Phase 9/11 planning |
| Help and support | `#help` → `prototype/HelpPage` | Local content | No business persistence required by current evidence; support integration `Non confirmé` | Content review, authorization needs, analytics/privacy tests `Non confirmé` | P0 | Static help can remain local, but commercial support ownership and update process are undefined | Phase 11 documentation/support procedure; interactive support is a separate decision |

Refresh procedure:

1. rerun mounted-route, mock, `localStorage`, API, model, permission, audit, and test
   inventories on the current `main` SHA;
2. update only rows affected by merged, exact-SHA-green evidence;
3. link the relevant PR, merged SHA, CI run, persistence proof, and human validation in
   the detailed phase report or task queue;
4. keep a row at its current maturity when any required proof is missing;
5. record unresolved product scope as `Non confirmé`, blocked, or outside MVP only after
   an explicit decision.

## Roadmap by phase

### Phase 0 — Audit and integration plan

Goal: establish the factual mapping from mounted prototype routes to mocks,
`localStorage`, historical connected components, API functions, endpoints, models,
permissions, tests, and missing contracts.

Required exit evidence:

- mounted-route and visible-page inventory;
- mock and business `localStorage` inventory;
- prototype page to connected component to endpoint to model mapping;
- module P0–P4 matrix, gaps, dependencies, risks, and medium-bundle roadmap;
- no product-code mutation during the audit.

Status: completed by local report on 2026-07-15. Durable versioning of the detailed
matrix is `Non confirmé`; future phases must refresh affected rows against live code.

### Phase 1 — Authentication, session, and RBAC

Goal: restore real authentication and backend-authoritative access control before
connecting business data.

Ordered bundles:

1. `1A` — audit existing authentication, CSRF, session, role, and permission contracts;
2. `1B-BE` — JSON session bootstrap, CSRF-safe login/logout, throttling, and auth audit;
3. `1B-FE` — connect the approved login UI, remove auth bypasses, and centralize CSRF
   handling for all unsafe methods;
4. `1C` — current-user profile, session restoration, expiry, network recovery, and
   explicit anonymous/denied states;
5. `1D` — protect routes and preserve the intended destination across login;
6. `1E-BE` — consolidate effective roles/groups, separate identity administration,
   define object-level access, and audit assignment/revocation;
7. `1E-FE` — reflect capabilities in navigation and actions without treating UI hiding
   as security;
8. `1F` — multi-role backend, frontend, E2E, responsive, console, and network acceptance.

Required exit evidence:

- no `checkAuth() => true`, false logout, or secret/token storage in `localStorage`;
- CSRF-protected POST/PUT/PATCH/DELETE and explicit invalid-session versus forbidden
  behavior;
- backend-authoritative permissions for administrator, management, sales, logistics,
  cash/accounting, read-only, and unauthorized users;
- revocation behavior and security audit events tested;
- frontend build, Vitest, relevant Playwright, and human visual validation green;
- PR and exact merged-SHA `main` CI green for every accepted bundle.

Status: completed. `1A` has local audit evidence; `1B-BE`, `1B-FE`, `1C`, `1D`, `1E-BE`,
`1E-FE`, and `1F-E` are complete with merged, exact-SHA-green evidence and human
validation. The authentication/session module is now P1 for the approved scope.

### Phase 2 — Customers and prospects, read-only

Goal: replace visible customer/prospect reads with real APIs while preserving the
approved list, detail, search, filter, pagination, and status UX.

Dependency: Phase 1 complete. Missing prospect, conversion, history, and appointment
contracts must be approved rather than invented.

Exit evidence: real API reads, all required UI states, read permissions, no silent mock
fallback, responsive validation, and updated module matrix.

### Phase 3 — Customers and prospects, writes

Goal: persist create/update/conversion workflows with server validation, duplicate
handling, prospect restrictions, permissions, and audit.

Dependency: Phase 2 read contracts stable.

Exit evidence: request/response/PostgreSQL proof, reload, second authorized session,
denied-role test, audit event, and backend/frontend/E2E tests.

### Phase 4 — Catalog, offers, and inventory

Goal: connect the commercial catalog separately from operational inventory.

Bundles:

- `4A` catalog: materials, articles, packs, services, venues, prices, media, displayed
  availability;
- `4B` inventory: quantities, movements, inputs, outputs, states, available stock, and
  history;
- `4C` writes: adjustments, validation, permissions, audit, and concurrent consistency.

Titan remains pure rental and must never expose Hahitantsoa venues or services. Uploads
require an approved backend contract and must not add user media to Git.

### Phase 5 — Reservations and availability

Goal: connect availability and reservation lifecycle with server-authoritative conflict
protection.

Bundles: availability read; Titan reservation; Hahitantsoa reservation; real planning;
update/cancel/status; conflict and concurrency tests.

Exit evidence includes the reservation confirmation prerequisites defined in
`AGENTS.md`, transaction-safe audit, locking/conflict tests, and strict domain-boundary
proof.

### Phase 6 — Documents and templates

Goal: replace document/template business `localStorage` with persistent templates,
versions, instances, snapshots, private files, and authorized lifecycle actions.

Hard dependency: a dedicated reconciliation mission for the preserved dirty R7B
worktree, with inventory, lossless strategy, and human authorization before mutation.

Exit evidence: real template/version CRUD and activation/restoration where approved,
real upload/download, private access checks, audit, persisted preview/file distinction,
and no false save message.

### Phase 7 — Billing, payments, and cashbox

Goal: provide traceable, atomic financial lifecycle operations.

Bundles: invoice reads; controlled writes; installment payments; receipts; cashbox;
cancellations/corrections; audit and reconciliation.

Exit evidence: server-controlled amounts and unique references, idempotency and double
submission tests, atomicity, strict permissions, complete audit, and no simulated payment
presented as real.

### Phase 8 — Logistics, returns, and incidents

Goal: persist preparation, dispatch, delivery, returns, damage/loss, deposits, and stock
effects as one traceable operational chain without collapsing domain boundaries.

Exit evidence: every action changes the intended backend state and quantities,
permissions and audit are proven, and rollback/inconsistency cases are tested.

### Phase 9 — Audit, administration, and reports

Goal: connect audit logs, user/role administration, business settings, PostgreSQL-backed
reports, exports, filters, indicators, and access restrictions.

Dependency: business/legal decisions must define report/export data, format, retention,
and access. Until approved contracts exist, these capabilities remain `Non confirmé` or
blocked; totals must never come from `mockData`.

### Phase 10 — Remove production mocks

Goal: eliminate business mocks, business `localStorage`, auth bypasses, dead buttons,
placeholders declared production-ready, and simulated success from production paths.

Keep test fixtures and explicitly separated demo seeds. Add enforceable checks so a
module declared migrated cannot silently regain a business mock dependency.

### Phase 11 — Production readiness

Goal: prove secure configuration and operability for deployment.

Minimum evidence: environment-specific settings, `DEBUG=False`, secret management,
HTTPS and secure cookies, CSRF/CORS, production server and proxy, PostgreSQL/Redis,
static/media handling, upload limits, logging/error collection, health/monitoring,
backup retention, a successful restore test, rollback/migration/deployment/incident
procedures, least privilege, load checks, error pages, and `manage.py check --deploy`.

Use OWASP ASVS 5.0 with applicable/not-applicable justification, proof, gaps, and
corrective actions. The application cannot be called production ready without a real
backup restoration test.

### Phase 12 — Commercial acceptance

Goal: validate complete workflows with administrator, management, sales, logistics,
cash/accounting, read-only, and unauthorized roles.

The minimum journey covers login, prospect creation and conversion, Titan and
Hahitantsoa reservations, availability, documents, invoice, installment payment,
receipt, preparation, delivery, return, damage/loss, reports, audit, and logout.

Exit evidence: real persistence, correct permissions and statuses, no dead action or
production mock, responsive and clean browser diagnostics, tested backup/restore,
user documentation, and support procedure, followed by final human acceptance.

## Per-module evidence matrix

Maintain this schema in the Phase 0 report or its future versioned successor:

| Field | Required content |
|---|---|
| Module and visible route | Mounted component and approved UI reference |
| Source of data | Mock, API endpoint, selector, and PostgreSQL model |
| Operations | Reads and writes separately |
| Trust controls | Backend permissions, validation, conflict handling, and audit |
| Tests | Backend, frontend, E2E, responsive, console, and network evidence |
| Maturity | Exactly one state from P0 to P4 |
| Gaps | Confirmed anomaly or `Non confirmé` |
| Next action | One bounded dependency-aware bundle |

## Gate for advancing a bundle or phase

For each implementation bundle:

1. run the live baseline and preserve unrelated dirty worktrees;
2. use the applicable backend or frontend orchestrator contract and independent review;
3. prove focused and full required quality gates;
4. obtain functional and visual human validation when frontend behavior changes;
5. commit, push, open/update PR, and merge only with the required human authorization;
6. require green PR CI, head-SHA merge protection, exact merged-SHA `main` CI, and
   authorized cleanup;
7. update the module matrix and this checkpoint only from those proofs;
8. list the remaining phases in the lot report and stop for human validation.

No phase is complete because code merely exists. Completion requires the applicable
runtime, persistence, permission, audit, tests, CI, cleanup, and human evidence.

## Durable execution memory

This roadmap is the versioned program checkpoint. After every merged lot, update only
facts supported by the merged SHA and exact-SHA `main` CI:

- completed phase or bundle and its remaining limitations;
- PR number, reviewed head SHA, merged `main` SHA, and CI run;
- module maturity rows affected by the change;
- next bounded lot and unresolved dependencies;
- durable workflow lesson only when it changes future execution.

Git history, PRs, accepted decisions, and exact-SHA CI are supporting evidence.
`reports/`, `logs/terminal/`, Codex conversational memory, and `graphify-out/` are useful
local context but are not program sources of truth. Do not duplicate this checkpoint in
a second roadmap or infer completion from an unmerged worktree.

## Remaining sequence at this checkpoint

1. complete `1E-BE`, `1E-FE`, and `1F`;
2. execute Phases 2 through 12 in order, split into the bounded bundles above.

The skills reassessment completed in PR `#461`; it is a governance improvement, not a
substitute for any product phase.

The proportional test policy is defined in `docs/ai-agents/pr-quality-gates.md` and is
enforced by PR `#464`. The high-risk workflow self-change selected both stacks and the
stable policy gate; subsequent documentation-only checkpoints have proven that both
application jobs are skipped while `CI policy gate` remains green.
