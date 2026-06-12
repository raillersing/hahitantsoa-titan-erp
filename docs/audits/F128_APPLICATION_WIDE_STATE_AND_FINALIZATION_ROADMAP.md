# F128 - Application-wide state and finalization roadmap

## 1. Status

- Documentation-only.
- Accepted roadmap draft after PR #139.
- No runtime behavior changed.

## 2. Evidence base

This document is based on the F128A-0 non-mutating inspection and the current repository state on
`main` at `362545248e09b80b4c263bd01c2356a83909d2d8`.

Evidence used for this roadmap is limited to repository-inspectable facts:

- backend app layout and currently present domain packages;
- existing persisted models already present in the repository;
- current backend route surface and existing authenticated read-only or draft-only APIs;
- current frontend structure and its already wired local MVP-facing screens;
- existing decisions, ADRs, audits, runbooks, and README history;
- existing tests and quality/documentation workflow conventions.

This document does not invent runtime behavior, production guarantees, payment workflows, document
generation pipelines, RBAC implementation, or deployment capabilities that are not already present.

## 3. Current application state

### Backend

The backend is a Django/DRF monorepo foundation with concrete apps already present for:

- `audit`
- `billing`
- `common`
- `customers`
- `documents`
- `hahitantsoa`
- `identity`
- `inventory`
- `logistics`
- `reservations`

The repository already contains concrete persisted models for audit events, customers, inventory
items, inventory availability, reservation drafts, and reservation draft lines. Authenticated
read-only surfaces exist for inventory, reservation availability, customers, documents registry, and
Hahitantsoa discovery. The reservations domain also includes draft-only writes and backend-internal
lifecycle foundations.

The backend is still incomplete for the full ERP target. Runtime commercial document generation,
payment/deposit workflows, finalized reservation lifecycle APIs, explicit RBAC/data-scope hardening,
logistics execution, and production deployment concerns remain unfinished.

### Frontend

The frontend is React + Vite + TypeScript and remains local/MVP-oriented. It already integrates the
current controlled backend surfaces for:

- inventory catalog;
- reservation availability;
- reservation draft creation/update;
- customers;
- Hahitantsoa discovery.

It is not a complete ERP frontend. Navigation, business-boundary separation, auth UX, operational
screens, lifecycle controls, payment flows, logistics flows, and production-grade UX hardening are
still incomplete.

### Documentation

The project documentation is strong but distributed. Business rules, decisions, ADRs, audits, MVP
documents, runbooks, and reference sources all contain relevant state. This is useful for traceable
decisions, but it increases the risk of historical documents being mistaken for current operational
status if roadmap maintenance drifts.

### CI / quality gates

The repository already uses documented local validation, logged terminal runs, and GitHub Actions
quality checks. Backend and frontend quality gates exist, but the project is not yet production-ready
and still relies on controlled human review, local validation, green PR CI, and manual merge.

## 4. Completed foundations by area

### Inventory

Current completed foundation:

- concrete `InventoryItem` domain;
- `InventoryAvailability` domain;
- read-only authenticated inventory API;
- internal availability selectors/services/tests;
- Titan-only kind guardrails already enforced at the domain level.

Current limitations:

- no approved operational write API;
- no approved stock/unit/quantity workflow;
- no maintenance/repair flow;
- no supplier/procurement implementation;
- no media/photos management workflow.

Important boundaries / exclusions:

- Titan remains limited to `material`, `article`, `material_pack`;
- no venue/local/room/hall/service/event-service logic;
- no broad operational inventory workflow yet.

### Customers

Current completed foundation:

- customer backend domain exists;
- authenticated customer API foundation is present in the current repository/frontend state.

Current limitations:

- not yet a full CRM/commercial lifecycle;
- no full document/payment/customer operations coupling;
- not yet a finalized ERP-grade customer workflow surface.

Important boundaries / exclusions:

- no automatic expansion into invoices, payment reconciliation, or full event workflow through F128.

### Reservations

Current completed foundation:

- reservation drafts and draft lines are persisted;
- availability preview/summary read-only APIs exist;
- draft create/update API exists in controlled scope;
- backend-internal lifecycle foundations already exist post-F121/F123 work.

Current limitations:

- no public lifecycle confirmation/cancellation API;
- no final production-grade permission/RBAC boundary yet;
- no final payment/document prerequisite execution flow;
- no durable full commercial reservation workflow yet.

Important boundaries / exclusions:

- no broad reservation write surface beyond approved draft operations;
- no payment/invoice/contract runtime generation introduced by F128;
- no Hahitantsoa write workflow.

### Documents

Current completed foundation:

- documents registry exists;
- source templates and document-related documentation foundations exist;
- document domain is sufficiently present to justify backend-only next steps.

Current limitations:

- no safe runtime commercial document generation contract completed;
- no final renderer pipeline;
- no full private delivery/access/audit policy implementation for runtime outputs.

Important boundaries / exclusions:

- F128 does not add PDF runtime generation;
- F128 does not add invoice/proforma runtime output logic.

### Payments / billing / cashbox

Current completed foundation:

- billing/cashbox exists mainly as groundwork and documentation direction;
- business rules already define accepted payment methods and audit expectations.

Current limitations:

- no finalized payment model/ledger;
- no receipt workflow;
- no deposit synchronization implementation with reservation lifecycle API;
- no cashbox operational backend/frontend completion.

Important boundaries / exclusions:

- no payment provider integration;
- no accounting-grade workflow;
- no invoice/payment execution implemented by F128.

### Hahitantsoa

Current completed foundation:

- distinct Hahitantsoa domain and scope documentation;
- authenticated read-only discovery API;
- dedicated frontend discovery surface;
- explicit separation from Titan already documented and tested.

Current limitations:

- no approved Hahitantsoa write workflow;
- no Hahitantsoa availability/planning workflow beyond controlled read-only scope;
- no event/venue/service operational implementation.

Important boundaries / exclusions:

- shared concepts with Titan remain only `material` and `article`;
- `material_pack` remains Titan-only;
- no event-service or venue modeling is approved by F128.

### Audit / identity / permissions

Current completed foundation:

- audit app exists;
- identity app exists;
- backend foundations for attribution, transaction-safe audit, and reservation-sensitive internal
  authorization already exist in controlled slices.

Current limitations:

- no complete role matrix;
- no full backend RBAC/group policy;
- no finalized application-wide permission class hardening;
- no complete security review across all business surfaces.

Important boundaries / exclusions:

- F128 does not implement RBAC;
- F128 does not change session/runtime security behavior;
- F128 does not alter secrets handling or `.env`.

### Logistics

Current completed foundation:

- logistics is present as a documented domain placeholder/foundation.

Current limitations:

- no delivery/pickup/return model implementation;
- no breakage/damage workflow;
- no repair invoice boundary;
- no logistics UI.

Important boundaries / exclusions:

- F128 does not create logistics runtime code;
- F128 does not introduce operational delivery/return behavior.

### Frontend

Current completed foundation:

- React/Vite/TypeScript frontend exists and is wired to several approved backend surfaces;
- local MVP/demo/read-only history is documented;
- current frontend supports catalog/discovery/read-only availability plus controlled draft handling.

Current limitations:

- no full ERP shell/navigation;
- no finalized auth UX;
- no lifecycle operations UI;
- no payment/logistics/commercial document workflow UI;
- no production polish claim.

Important boundaries / exclusions:

- F128 does not change frontend behavior;
- F128 does not introduce new routes, state management, or deployment assumptions.

### Deployment / operations

Current completed foundation:

- local Docker Compose workflow exists;
- health and readiness checks exist;
- local validation and logged-run workflow exists;
- PR CI and controlled merge expectations already exist.

Current limitations:

- no finalized production deployment decision;
- no complete environment matrix;
- no finalized backup/restore, staging, monitoring, or branch-protection enforcement posture.

Important boundaries / exclusions:

- F128 does not introduce deployment code;
- F128 does not claim production readiness.

## 5. Cross-cutting risks

- Scope drift: later slices can easily mix document generation, payments, lifecycle APIs, frontend,
  and logistics into one oversized PR.
- Historical documentation drift: older MVP and roadmap documents can be mistaken for current state
  if not explicitly marked historical or superseded.
- Security/authorization: authenticated-only boundaries are not the same thing as finalized
  authorization and data-scope hardening.
- Runtime document generation: templates/source assets exist, but runtime commercial document
  behavior remains a high-risk backend boundary.
- Payment ambiguity: deposits, receipts, cashbox, and billing can sprawl into accounting behavior if
  not tightly scoped.
- Frontend incompleteness: the frontend is useful but still partial relative to a full ERP target.
- Deployment readiness: local Docker and CI do not equal staging/production readiness.
- Generated/cache files: accidental noise from logs, caches, build outputs, or generated artifacts
  can pollute otherwise reviewable PRs.
- Over-combining PRs: document, payment, lifecycle API, RBAC, and frontend work must stay split into
  narrow business-boundary slices.

## 6. Finalization roadmap

### Phase 1 - Stabilize roadmap and immediate next foundation

- F128 roadmap PR;
- F126BC commercial document context and contract helpers;
- document instance boundary decision.

### Phase 2 - Commercial documents backend

- commercial context;
- template compatibility policy;
- document instance/storage policy;
- renderer interface;
- first safe runtime draft output;
- private access/audit;
- API only after backend contract is stable.

### Phase 3 - Payment/deposit domain

- payment decision;
- ledger model;
- manual/cashbox payment service;
- receipt boundary;
- reservation prerequisite synchronization;
- API;
- frontend.

### Phase 4 - Reservation lifecycle API and frontend controls

- lifecycle API decision refresh;
- role/authorization policy;
- confirmation/cancellation endpoints;
- audit coverage;
- OpenAPI;
- frontend controls.

### Phase 5 - Inventory operations

- operational inventory gaps;
- photos/media;
- authorized write API;
- stock/unit/quantity policy if approved;
- maintenance/repair;
- procurement/supplier;
- frontend inventory management;
- historical Excel import path.

### Phase 6 - Logistics / delivery / return

- logistics model decision;
- delivery/pickup/return;
- delivery note linkage;
- return note linkage;
- breakage/damage;
- repair invoice boundary;
- logistics frontend.

### Phase 7 - Hahitantsoa business scope

- Hahitantsoa scope refresh;
- venue/service/event package modeling if approved;
- Hahitantsoa planning/availability;
- Hahitantsoa documents;
- Hahitantsoa frontend;
- tests proving Titan remains equipment-only.

### Phase 8 - Identity, RBAC, audit, security hardening

- role matrix;
- backend role/group policy;
- permission classes;
- audit coverage;
- session/security settings review;
- `.env.example` and secrets policy review;
- negative tests;
- admin/operator runbook.

### Phase 9 - Frontend ERP completion

- navigation/business-scope separation;
- auth UX;
- dashboard shell;
- inventory screens;
- reservation lifecycle screens;
- document screens;
- payment/cashbox screens;
- logistics screens;
- error/loading/empty states;
- accessibility/responsive polish.

### Phase 10 - Deployment, acceptance, production readiness

- production deployment decision;
- environment matrix;
- backup/restore;
- monitoring/logging;
- branch protection and CI enforcement;
- demo vs production data separation;
- local acceptance;
- staging acceptance;
- production readiness checklist.

## 7. Recommended immediate next task

Recommended next task: `F126BC - Commercial document context and contract helpers`.

Why this is the safest immediate slice:

- the documents registry already exists;
- source templates already exist;
- F126A already records that runtime rendering must first introduce a backend commercial document
  context;
- this can stay a small backend-only PR;
- it unblocks later runtime document work without touching payments, lifecycle APIs, frontend, or
  PDF generation.

## 8. Explicit exclusions for F128

F128 does not:

- change runtime code;
- create models;
- create migrations;
- create endpoints;
- modify frontend behavior;
- implement payment;
- implement document generation;
- implement reservation lifecycle APIs;
- implement RBAC;
- modify `.env` or secrets;
- use OpenClaw.

## 9. Operating rules going forward

- one PR equals one business boundary;
- documentation may be included in implementation PRs only when directly tied;
- broad roadmap/documentation updates stay separate;
- all important commands must be logged with `scripts/dev/erp-logged-run`;
- no `.env` or secret changes;
- local validation before PR;
- GitHub Actions PR CI before merge;
- manual merge only after green CI;
- post-merge main validation and cleanup.
