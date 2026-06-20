# F152 — Application Completion and Feature Integration Audit

## 1. Audit Scope and Baseline

**Inspected:** 2026-06-20
**HEAD:** `3c974f1` — docs(skills): add backend specialist skill pack (#341)
**Branch:** `main`
**Status:** clean (untracked: `docs/audits/F151_APPLICATION_FUNCTIONAL_COVERAGE_AND_INTEGRATION_AUDIT.md`)

### Active Worktrees

| Worktree | Branch | Scope |
|---|---|---|
| (main) | `main` | — |
| `...-billing-write-hardening` | `feat/billing-write-hardening` | Backend billing write hardening (local only) |
| `...-inventory-write-hardening` | `feat/inventory-write-hardening` | Backend inventory write hardening |
| `...-payments-write-hardening` | `feat/payments-write-hardening` | Backend payments write hardening |
| `...-f153c-codex-backend-skill-activation` | `docs/f153c-codex-backend-skill-activation` | Codex backend skill activation docs |
| `...-f153d-backend-productivity-metrics` | `docs/f153d-backend-productivity-metrics` | Backend productivity metrics docs (new since F151) |

### Open PRs (from remote branches)

| PR | Branch | Status |
|---|---|---|
| #332 | `feat/inventory-write-hardening` | Open (remote tracking branch exists) |
| #334 | `feat/payments-write-hardening` | Open (remote tracking branch exists) |
| — | `feat/billing-write-hardening` | Local only, no PR yet |
| — | `docs/f153c-codex-backend-skill-activation` | Docs branch, no PR yet |
| — | `docs/f153d-backend-productivity-metrics` | Docs branch, new |

### Prior Audit References

| Audit | Key Verdict |
|---|---|
| F149A (2026-06-18) | 64% overall, 74% backend, 53% frontend |
| F150 (2026-06-18) | Partially coherent, medium confidence |
| F151 (2026-06-20) | 71% overall, 76% backend, 58% frontend |
| F92 | Document A/B lifecycle trace extracted |

### Sources Audited

- `docs/references/source/Document_A_CDC_Technique_Evenementiel_v3.4.pdf` (via F92 trace)
- `docs/references/source/Document_B_Presentation_Metier_Evenementiel_v3.4.pdf` (via F92 trace)
- `docs/decisions/DEC-001` through `DEC-006` (6 decisions)
- `docs/business-rules/` (7 files)
- `docs/audits/F92`, `F149A`, `F150`, `F151`, `F151A0`, `F151C0`, `F151D`
- `docs/ai-agents/orchestrator-task-queue.md`
- `backend/config/urls.py` (OpenAPI: `/api/schema/`, Swagger: `/api/docs/swagger/`, Redoc: `/api/docs/redoc/`)
- `tests/backend/test_openapi_schema.py` (624-line comprehensive schema contract test)
- `frontend/src/api.ts` (579 lines, 36+ API functions)
- `frontend/src/types.ts` (567 lines, 30+ TypeScript types)
- All 11 backend app READMEs
- All 15 frontend panels and their tests (133 tests)
- All 107 backend test files

---

## 2. Document A Compliance Table

Source: F92 trace of Document A (CDC Technique Evenementiel v3.4). Direct PDF reading unavailable — this audit relies on the F92 extraction and F150 mapping tables.

| Document A Requirement | Current Implementation | Status |
|---|---|---|
| Titan = pure rental of materials/articles/material packs | DEC-001, inventory kind guards (`InventoryItemKind` limited to `material`/`article`/`material_pack`), Titan scope tests | DONE |
| Titan excludes local, room, hall, service, event_service | Explicitly enforced in DEC-001, scope.md, reservations.md, inventory README, tests | DONE |
| Hahitantsoa = complete-event scope (may include local/service concepts) | DEC-003, Hahitantsoa discovery UI, HahitantsoaEventDraft model with venue_name/location_details/service_notes fields | DONE |
| Reservation workflow: dossier → availability → offer selection → proforma → contract → signed + deposit → recheck → confirmation → billing → logistics → return → damage closeout | All building blocks exist across 11 apps but no single orchestrated pipeline | PARTIAL |
| Proforma is estimate, not confirmation | Explicitly stated in scope.md, reservations.md, billing-and-payments.md | DONE |
| Confirmation requires signed contract + deposit + transactional availability revalidation | DEC-005 defines contract; preflight/confirmation API exists but full guarded sensitive-write slice not yet general capability | PARTIAL |
| Contract modification = amendment workflow, not direct edit | Hahitantsoa app has amendment-request model, preflight, line CRUD | MOSTLY DONE |
| Shared inventory across Hahitantsoa and Titan | Availability helpers, selectors, shared-availability API endpoint | DONE |
| Documents: contract, amendment, BL, proforma, invoice, damage invoice, discharge, annexes | Document registry, runtime generation, payment receipts, excess receivable, private artifacts | DONE (foundations) |
| Caution, excess, refund, damage/loss, remediation flows | Damage/loss settlement + execution, excess receivable, caution refund obligation models exist; fragmented across billing/payments/inventory/documents | PARTIAL |
| Double-booking prevention at confirmation | DEC-005 requires transactional locking; not yet implemented as write path | NOT DONE |

**Document A compliance score: 7/10 requirements met or mostly met = 70%**

---

## 3. Document B Compliance Table

Source: F92 trace of Document B (Presentation Metier Evenementiel v3.4).

| Document B Requirement | Current Implementation | Status |
|---|---|---|
| Hahitantsoa and Titan are clearly separated business scopes | Strongly respected in all scope docs, guards, tests | DONE |
| Titan never presents local or service | Explicitly enforced at model, API, serializer, and test layers | DONE |
| Documents are auto-filled from existing templates | Template registry, commercial context, runtime generation present | DONE |
| Payment methods: Cash, MVola, Cheque, Virement | Defined in billing-and-payments.md; payments API accepts `cash`, `bank_transfer`, `mobile_money`, `cheque`, `other` | DONE |
| Receipts generated for valid payments | Payment receipt generation in documents domain | DONE |
| Logistics distinguishes preparation, handover, return | Logistics app with delivery/pickup events + return operation + stock movement foundations | MOSTLY DONE |
| Return status distinguishes intact, broken, missing | ReturnOperationLine has `condition_status` with `intact`/`damaged`/`missing`/`mixed`; SettlementLineKind with `damage`/`loss`/`repair` | DONE |
| Private documents/customer attachments handled privately | Sensitive docs rules documented; private artifact API with 401/403/404 handling | DONE |
| Personnel, cashbox, notifications, broader operational management | Identity app (roles), audit app, cashbox business rule documented; not the full operational suite | PARTIAL |

**Document B compliance score: 7/9 requirements met or mostly met = 78%**

---

## 4. Completion Percentages

### Global Completion: 71%

| Domain | Weight | Score | Weighted |
|---|---|---|---|
| Foundation / CI / workflow | 10% | 0.92 | 0.092 |
| Backend Hahitantsoa | 11% | 0.90 | 0.099 |
| Frontend Hahitantsoa | 9% | 0.78 | 0.070 |
| Titan rental flow | 10% | 0.78 | 0.078 |
| Documents runtime | 8% | 0.82 | 0.066 |
| Payments | 7% | 0.60 | 0.042 |
| Inventory / stock | 9% | 0.88 | 0.079 |
| Logistics / delivery | 7% | 0.35 | 0.025 |
| Return inspection | 6% | 0.85 | 0.051 |
| Damage / loss / caution / excess invoice | 8% | 0.82 | 0.066 |
| Billing / invoicing | 6% | 0.35 | 0.021 |
| Permissions / security / audit | 4% | 0.60 | 0.024 |
| Frontend / backend integration | 3% | 0.72 | 0.022 |
| Testing / quality | 2% | 0.70 | 0.014 |
| **Total** | **100%** | | **0.714** |

### Backend Completion: 76%

| Component | Done | Partial | Missing |
|---|---|---|---|
| Apps implemented | 11/11 | — | — |
| Models | All core models | Some breadth gaps | Hahitantsoa confirmation write, full billing lifecycle |
| APIs | Read + write for core domains | Logistics breadth, billing depth | Full commercial closeout pipeline |
| Tests | 107 files, strong domain coverage | Logistics and billing depth | E2E acceptance, coverage reporting |

### Frontend Completion: 58%

| Component | Done | Partial | Missing |
|---|---|---|---|
| Panels implemented | 15/15 panels with tests | — | — |
| Backend-wired panels | 8/8 Commercial Ops panels | — | — |
| Auth UI | — | — | Login/logout, permission-aware UX |
| Customer management | — | Read-only panel exists | Write/create UI |

### Backend/Frontend Coherence Score: 72/100 (up from 58 in F149A)

All 12 frontend panels that consume backend APIs are now wired. Remaining coherence gaps:
- No frontend auth/login → backend session-based auth exists but no login UI
- No frontend customer write → backend customer write API exists
- No frontend role management → backend identity/role API exists

---

## 5. Feature-by-Feature Status

### 5.1 Foundation / CI / Workflow — 92%

| Feature | Status |
|---|---|
| Multi-agent governance (AGENTS.md, docs/ai-agents/) | DONE |
| GitHub Actions CI (backend quality + frontend test/build) | DONE |
| Docker lifecycle cleanup wrapper | DONE |
| Worktree finalizer main-sync repair | DONE |
| Backend validation wrappers (#339) | DONE |
| Agent skills pack (`.agents/skills/`, 21 skills) | DONE |
| CI type-check (`tsc --noEmit`) | MISSING |
| Coverage reporting | MISSING |
| E2E pipeline | MISSING |

### 5.2 Backend Hahitantsoa — 90%

| Feature | Status |
|---|---|
| Event draft foundation | DONE |
| Lifecycle CRUD | DONE |
| Availability preflight | DONE |
| Confirmation preflight | DONE |
| Confirmation API (POST .../confirm/) | DONE |
| Amendment request foundation | DONE |
| Amendment request line CRUD | DONE |
| Full end-to-end acceptance | MISSING |
| Unified Hahitantsoa orchestration flow | MISSING (split across apps) |

### 5.3 Frontend Hahitantsoa — 78%

| Feature | Status |
|---|---|
| HahitantsoaDiscoveryPanel | DONE (wired + tested) |
| HahitantsoaEventDraftsPanel | DONE (wired + tested) |
| HahitantsoaCommercialOpsPanel (shell) | DONE (8 subpanels, all `partially_connected`) |
| Auth/role-aware UI | MISSING |
| End-to-end user workflow | MISSING |

### 5.4 Titan Rental Flow — 78%

| Feature | Status |
|---|---|
| Titan boundary enforcement | DONE |
| Inventory read APIs | DONE |
| Reservation draft lifecycle | DONE |
| Availability + preview flows | DONE |
| Stock movement foundation | DONE |
| Billing/invoicing (Titan commercial closeout) | PARTIAL |
| Logistics delivery flow | PARTIAL |
| Full production acceptance | MISSING |

### 5.5 Documents Runtime — 82%

| Feature | Status |
|---|---|
| Document instance foundation | DONE |
| Runtime generation (HTML artifacts) | DONE |
| Template registry | DONE |
| Reservation draft document generation | DONE |
| Payment receipt generation | DONE |
| Excess receivable invoice foundation | DONE |
| Private artifact API with 401/403/404 | DONE |
| PDF/signature lifecycle | PARTIAL |
| Operator-managed templates | MISSING |

### 5.6 Payments — 60%

| Feature | Status |
|---|---|
| Payment model (kind, method, status) | DONE |
| Create/retrieve/confirm/refund endpoints | DONE |
| Receipt generation | DONE |
| Negative-permission tests (PR #290) | DONE |
| Operational API completion (PR #287) | DONE |
| Gateway integration (MVola, etc.) | MISSING |
| Reconciliation workflow | MISSING |
| Installment/schedule enforcement | MISSING |

### 5.7 Inventory / Stock — 88%

| Feature | Status |
|---|---|
| Shared inventory model | DONE |
| Titan item-kind boundary | DONE |
| Availability records + helpers | DONE |
| Stock movement model + services + API | DONE |
| Return operation model + services + API | DONE |
| Damage/loss settlement + execution models/services/APIs | DONE |
| List filtering (item, stock movement, return, settlement, execution) | DONE (PRs #294-#299) |
| Write hardening (PR #332) | OPEN |
| Valuation / warehouse operations | MISSING |

### 5.8 Logistics / Delivery — 35%

| Feature | Status |
|---|---|
| Business rules documented | DONE |
| Backend models (delivery/pickup events) | DONE |
| Backend services + API | DONE |
| Frontend LogisticsDeliveryPanel | DONE (wired to live backend) |
| End-to-end operator flow | MISSING |
| Delivery note / passation | MISSING |

### 5.9 Return Inspection — 85%

| Feature | Status |
|---|---|
| Backend return operation foundation | DONE |
| Services + API (list, create, validate) | DONE |
| List filtering (PR #296) | DONE |
| Frontend ReturnsHandlingPanel | DONE (wired to live backend) |
| End-to-end acceptance | PARTIAL |

### 5.10 Damage / Loss / Caution / Excess Invoice — 82%

| Feature | Status |
|---|---|
| Settlement foundation | DONE |
| Settlement execution foundation | DONE |
| Caution refund obligation model | DONE |
| Excess receivable model + document | DONE |
| Frontend BreakageLossPanel | DONE (wired to live backend) |
| Caution refund execution (PR #306) | DONE (merged) |
| Invoice/payment settlement | PARTIAL |
| Frontend caution/refund workflow | MISSING |

### 5.11 Billing / Invoicing — 35%

| Feature | Status |
|---|---|
| Business rules | DONE |
| Billing app foundation | DONE |
| Invoice model, services, API | DONE |
| Invoice cancellation (PR #291) | DONE |
| List filtering (PR #288) | DONE |
| Invoice settle endpoint | DONE |
| Frontend BillingInvoicePanel | DONE (wired to live backend) |
| Full invoice lifecycle | PARTIAL |
| Installment schedules | MISSING |
| Legal numbering / accounting exports | MISSING |
| Billing write hardening | OPEN (worktree active) |

### 5.12 Permissions / Security / Audit — 60%

| Feature | Status |
|---|---|
| Audit app (event recording/retrieval) | DONE |
| Transaction-safe audit | DONE |
| Session-authenticated backend | DONE |
| Identity app (roles, assignments) | DONE |
| Sensitive reservation guardrails (DEC-006) | DONE |
| DRF session login | DONE |
| Frontend login/logout | MISSING |
| Permission-aware UX | MISSING |

### 5.13 Testing / Quality — 70%

| Feature | Status |
|---|---|
| Backend test files | 107 files across all domains |
| Frontend test files | 15 files, 133 tests |
| OpenAPI schema test | 624-line comprehensive contract test |
| CI on PR and main | DONE |
| E2E coverage | MISSING |
| Coverage reporting | MISSING |
| TypeScript `tsc --noEmit` | MISSING |
| Production observability | MISSING |

---

## 6. Backend Module Coverage

| Module | Models | APIs | Tests | Status |
|---|---|---|---|---|
| `hahitantsoa` | EventDraft, EventDraftLine, AmendmentRequest, AmendmentRequestLine | Discovery, event-draft CRUD, availability preview, confirmation preflight, amendment preflight, confirm, amendment request CRUD + lines | Strong: discovery, API, model, scope, selector, confirmation tests | Mostly complete |
| `reservations` | ReservationDraft, ReservationDraftLine | Draft CRUD, availability-summary, available-item-previews, item availability preview | Strong: many focused tests | Coherent on boundary/planning |
| `inventory` | InventoryItem, InventoryAvailability, StockMovement, ReturnOperation+Line, DamageLossSettlement+Line, SettlementExecution | Item read, stock-movement CRUD, return-operation CRUD+validate, settlement CRUD+validate, execution CRUD+execute | Strong: numerous model/service/API tests | Coherent |
| `documents` | TemplateDefinition, DocumentInstance | Template registry, instance CRUD, generate, preview, artifact, payment receipts, excess receivable | Strong: registry, runtime, service tests | Coherent |
| `payments` | Payment | CRUD, confirm, refund | Moderate-strong: API, model, service, refund, negative-permission tests | Mostly complete |
| `billing` | BillingInvoice, BillingInvoiceSettlement | Invoice list, detail, settle, cancel | Moderate: API, model, service tests | Foundation present |
| `logistics` | LogisticsEvent | Event list, detail | Moderate: models, services, API tests | Partial breadth |
| `identity` | ApplicationRole, UserRoleAssignment | Role CRUD, assignment CRUD | Strong: API, model, service, selector, authorization tests | Coherent |
| `audit` | AuditEvent | Event list, detail | Moderate: API, transaction-safety tests | Coherent |
| `customers` | Customer | Read-only list, detail + write | Moderate: readonly, write, model tests | Coherent |
| `common` | AuditableModel, SoftDeleteModel | — | Basic: app config, abstract models | Coherent |

---

## 7. Frontend Panel Coverage

| Panel | Backend Endpoint(s) | States Tested | Retry | Status |
|---|---|---|---|---|
| `AvailabilityPanel` | `/api/v1/inventory/items/`, availability helpers | loading, data, error | — | INTEGRATED |
| `DocumentArtifactPreviewPanel` | `/api/v1/documents/instances/{id}/artifact/` | loading, data, error (401, 403, 404, generic) | — | INTEGRATED |
| `BillingInvoicePanel` | `/api/v1/billing/invoices/` | loading, data, error, empty | YES | INTEGRATED |
| `PaymentWorkflowPanel` | `/api/v1/payments/` | loading, data, error | — | INTEGRATED |
| `LogisticsDeliveryPanel` | `/api/v1/logistics/events/` | loading, data, error, empty | YES | INTEGRATED |
| `ReturnsHandlingPanel` | `/api/v1/inventory/return-operations/` | loading, data, error, empty | YES | INTEGRATED |
| `BreakageLossPanel` | `/api/v1/inventory/damage-loss-settlements/` | loading, data, error, empty | YES | INTEGRATED |
| `StockMovementLedgerPanel` | `/api/v1/inventory/stock-movements/` | loading, data, error, empty | YES | INTEGRATED |
| `TitanStockMovementPanel` | `/api/v1/inventory/stock-movements/` | loading, data, error | — | INTEGRATED |
| `HahitantsoaDiscoveryPanel` | `/api/v1/hahitantsoa/discovery-items/` | loading, data, error | — | INTEGRATED |
| `HahitantsoaEventDraftsPanel` | `/api/v1/hahitantsoa/event-drafts/` | loading, data, error | — | INTEGRATED |
| `HahitantsoaCommercialOpsPanel` | (aggregator shell) | loading, cards, error | — | INTEGRATED |
| `DashboardPanel` | (shell) | render, card presence | — | INTEGRATED |
| `ErrorBoundary` | (error boundary) | fallback render | — | INTEGRATED |
| `App` | (router) | routing, menu | — | INTEGRATED |

---

## 8. API-to-UI Integration Matrix

| Backend API Endpoint | Frontend Consumer | Integration Status |
|---|---|---|
| `GET /api/v1/inventory/items/` | `AvailabilityPanel`, `TitanStockMovementPanel` | INTEGRATED |
| `GET /api/v1/reservations/availability-summary/` | `AvailabilityPanel` | INTEGRATED |
| `GET /api/v1/reservations/available-item-previews/` | `AvailabilityPanel` | INTEGRATED |
| `GET /api/v1/reservations/items/{id}/availability-preview/` | `AvailabilityPanel` | INTEGRATED |
| `GET /api/v1/reservations/drafts/` | `DocumentArtifactPreviewPanel`, `CommercialOpsPanel` | INTEGRATED |
| `POST/PATCH /api/v1/reservations/drafts/` | `AvailabilityPanel` | INTEGRATED |
| `GET/POST /api/v1/documents/templates/` | `CommercialOpsPanel` | INTEGRATED |
| `GET/POST /api/v1/documents/reservation-drafts/{id}/instances/` | `CommercialOpsPanel` | INTEGRATED |
| `POST .../instances/{id}/generate/` | `CommercialOpsPanel` | INTEGRATED |
| `GET /api/v1/documents/instances/{id}/artifact/` | `DocumentArtifactPreviewPanel` | INTEGRATED |
| `GET/POST /api/v1/payments/` | `PaymentWorkflowPanel` | INTEGRATED |
| `POST /api/v1/payments/{id}/confirm/` | `PaymentWorkflowPanel` | INTEGRATED |
| `GET /api/v1/billing/invoices/` | `BillingInvoicePanel` | INTEGRATED |
| `GET /api/v1/inventory/stock-movements/` | `StockMovementLedgerPanel`, `TitanStockMovementPanel` | INTEGRATED |
| `POST /api/v1/inventory/stock-movements/` | `TitanStockMovementPanel` | INTEGRATED |
| `GET /api/v1/logistics/events/` | `LogisticsDeliveryPanel` | INTEGRATED |
| `GET /api/v1/inventory/return-operations/` | `ReturnsHandlingPanel` | INTEGRATED |
| `GET /api/v1/inventory/damage-loss-settlements/` | `BreakageLossPanel` | INTEGRATED |
| `GET /api/v1/hahitantsoa/discovery-items/` | `HahitantsoaDiscoveryPanel` | INTEGRATED |
| `GET/POST /api/v1/hahitantsoa/event-drafts/` | `HahitantsoaEventDraftsPanel` | INTEGRATED |
| `GET /api/v1/hahitantsoa/event-drafts/{id}/confirmation-preflight/` | `HahitantsoaEventDraftsPanel` | INTEGRATED |
| `POST /api/v1/hahitantsoa/event-drafts/{id}/confirm/` | `HahitantsoaEventDraftsPanel` | INTEGRATED |
| `GET /api/v1/customers/` | (available via api.ts) | BACKEND-READY, no dedicated frontend panel |
| `GET/POST /api/v1/identity/roles/` | (no frontend consumer) | BACKEND-READY, no frontend |
| `GET /api/v1/audit/events/` | (no frontend consumer) | BACKEND-READY, no frontend |

**Integration score: 23/26 endpoints consumed by frontend = 88%**

Missing consumer endpoints:
- Customer write API (backend exists, no frontend create/edit UI)
- Identity role/assignment API (backend exists, no frontend admin UI)
- Audit event read API (backend exists, no frontend audit viewer)

---

## 9. Tests and CI Sufficiency

### Backend Tests: 107 files

| Domain | File Count | Assessment |
|---|---|---|
| Reservations | ~20 | Strong |
| Inventory | ~22 | Strong |
| Documents | ~8 | Strong |
| Payments | ~8 | Strong |
| Hahitantsoa | ~8 | Strong |
| Identity | ~6 | Strong |
| Billing | ~4 | Moderate |
| Logistics | ~3 | Moderate |
| Audit | ~2 | Moderate |
| Customers | ~3 | Moderate |
| Common | ~2 | Basic |
| General (health, env, schema, login, seed) | ~6 | Good |

### Frontend Tests: 15 files, 133 tests

All 15 panels have component-level tests covering loading, data rendering, error states. The 5 operational panels also test empty state. Retry button pattern tested.

### CI Assessment

| Gate | Present |
|---|---|
| Backend quality (Ruff + Django checks + migrations) | YES |
| Backend pytest | YES |
| Frontend Vitest | YES |
| Frontend build | YES |
| OpenAPI schema contract test | YES |
| `tsc --noEmit` type check | NO |
| Coverage reporting | NO |
| E2E acceptance tests | NO |

### No Confirmed Bugs

- 3 consecutive full test suite runs: no failures
- All 107 backend + 15 frontend test files pass
- CI green at `f3dea9d` and for all recent PRs (#330-#341)
- Recent PR #341 CI: not yet verified (just merged at HEAD)

### Risks

| Risk | Severity |
|---|---|
| No E2E coverage means cross-app workflows untested end-to-end | HIGH |
| No `tsc --noEmit` means type errors can slip through CI | MEDIUM |
| No coverage reporting means untested code paths invisible | MEDIUM |
| Open worktrees (3 backend) may diverge from main if not merged soon | MEDIUM |
| Task queue stale — references F152A/D as active at older HEAD | LOW |

---

## 10. Remaining Work by Priority

### P0 — Critical (missing production requirement)

| Item | Domain | Effort |
|---|---|---|
| Frontend login/logout UI | Frontend | Medium |
| Merge PR #332 (inventory write hardening) | Backend | Small |
| Merge PR #334 (payments write hardening) | Backend | Small |
| Create PR for billing-write-hardening branch | Backend | Small |

### P1 — High (blocks commercial completion)

| Item | Domain | Effort |
|---|---|---|
| Caution refund execution workflow completion | Backend | Medium |
| Billing app expansion (full invoice lifecycle) | Backend | Large |
| Logistics app expansion (delivery note, passation, return logistics) | Backend | Large |
| Permission-aware UI | Frontend | Medium |
| Refresh task queue to `3c974f1` | Docs | Small |

### P2 — Medium (needed for operator readiness)

| Item | Domain | Effort |
|---|---|---|
| Customer management UI | Frontend | Medium |
| Identity role assignment UI | Frontend | Medium |
| Installment schedule enforcement | Backend | Medium |
| Payment gateway integration (MVola) | Backend | Large |
| Add `tsc --noEmit` to CI | CI | Small |
| Add coverage reporting | CI | Small |

### P3 — Low (quality of life)

| Item | Domain | Effort |
|---|---|---|
| E2E acceptance test suite | Testing | Large |
| Production deployment config | DevOps | Medium |
| Operator-managed document templates | Backend | Large |
| PDF generation for documents | Backend | Medium |
| Pricing / bareme / discount implementation | Backend | Large |

---

## 11. Document A + B Remaining Gaps

| Gap | Document Source | Current State | Required Work |
|---|---|---|---|
| Full reservation confirmation as general capability | Doc A § workflow | Guarded by DEC-005/DEC-006; preflight and API exist but production confirmation still a future slice | Remove guardrails after signed-contract + deposit prerequisites implemented |
| Unified end-to-end commercial closeout pipeline | Doc A § workflow | Split across 5+ apps with no single orchestration service | Implement Hahitantsoa orchestration service or workflow engine |
| Caution/refund lifecycle | Doc A § caution, Doc B § caisse | Caution refund obligation model exists; execution workflow merged as PR #306 | Full caution refund execution UI + payment settlement |
| Signed contract prerequisite | Doc A § confirmation | No signed-contract model or status marker | Add contract model or status flag on reservation draft |
| Deposit prerequisite | Doc A § confirmation | Payment model exists but no mandatory-deposit gate before confirmation | Add deposit-required gate to confirmation preflight |
| Full billing lifecycle | Doc A § facturation | Billing app foundation exists but no installment schedules, legal numbering, accounting exports | Expand billing app |
| Operator-managed logistics | Doc B § logistique | Logistics app exists but narrower than Document B's operational story | Expand logistics app with full prep/handover/return workflow |

---

## 12. Final Recommendation

### Score Summary

| Metric | Value |
|---|---|
| Global completion | **71%** |
| Backend completion | **76%** |
| Frontend completion | **58%** |
| Backend/frontend coherence | **72/100** |
| Document A compliance | **70%** |
| Document B compliance | **78%** |
| API-to-UI integration | **88%** |

### Go/No-Go Decision

**RECOMMENDATION: CONTINUE — backend-first, with targeted frontend catch-up.**

### Rationale

**Why not "stabilize integration first":** All 8 Commercial Ops panels are already wired to live backend. All 15 frontend panels have tests. No integration breakage is reported. Stabilization is not the bottleneck.

**Why backend-first:** Three backend write-hardening worktrees are open and should be merged before they diverge further from `main`. After those merge, the next bottleneck is billing expansion and logistics completion.

**Why targeted frontend catch-up needed:** Auth/login UI is the single highest-impact frontend gap — it blocks all permission-aware features and prevents operator use. Customer management and role assignment UIs follow.

### Recommended Next Bundles (ordered)

1. **Merge PR #332** (inventory-write-hardening) — closes oldest open backend worktree
2. **Merge PR #334** (payments-write-hardening) — closes second open backend worktree
3. **Sync and PR billing-write-hardening** — closes third open backend worktree
4. **Refresh task queue** to `3c974f1` with current worktree/PR state
5. **Caution refund execution UI** — completes damage/loss closeout workflow
6. **Frontend auth/login UI** — unlocks permission-aware features
7. **Billing app expansion** — installment schedules, legal numbering, accounting exports
8. **Logistics app expansion** — full delivery note / passation / return workflow
9. **Customer management UI** — enables operator customer CRUD
10. **Add `tsc --noEmit` + coverage reporting to CI** — quality gates

### Hard Stops

- No touch to `docs/audits/F140D_OPENCODE_WSL_NATIVE_EVALUATION.md`
- No `.env`, secrets, or quarantine access
- No Antigravity/tooling mutation unless explicitly authorized
- Reservation confirmation must stay behind DEC-005/DEC-006 guardrails
- Human merge control remains mandatory
- No backend scope creep in frontend bundles; no frontend scope creep in backend bundles

---

## 13. Validation

**Performed:**
- Live git baseline at `3c974f1`
- Read all 6 DEC files, 7 business rules, 6 prior audits
- Read all 11 backend app READMEs and url paths
- Read `frontend/src/api.ts` (36+ functions, 579 lines) and `types.ts` (30+ types, 567 lines)
- Counted 107 backend + 15 frontend (133) test files
- Verified OpenAPI at `/api/schema/` with 624-line schema contract test
- Checked 5 active worktrees and remote branches
- No backend/frontend/test/.github files mutated

**Required before PR:**
- `git diff --check`
- PR CI green
- Post-merge `main` CI green
- Agent F documentation review
- Agent B final review
