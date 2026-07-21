# Orchestrator Task Queue

## Current State

- `origin/main` HEAD is `b2339de`.
- `main` CI is green as verified on 2026-07-21 (run 29844073781).
- **BACKEND FUNCTIONAL FREEZE** is in effect as of F175A audit (2026-06-24).
- All backend-only Document A / Document B requirements are implemented, tested, and passing CI.
- No open backend PRs. No new backend feature bundles shall be started without explicit human authorization.
- F145A through F145H are merged on `main`.
- F153A is merged and provides the backend local CI wrappers and fast validation workflow.
- F153B is merged and provides the backend specialist skills pack and selection guidance.
- F153C is merged and provides backend skill-plan activation in the orchestrator workflow.
- F153D is merged as PR #393 (F162B queue refresh).
- Identity / role management foundation merged as PR #282.
- F164–F174 backend bundles are all merged: #395 (F163 logistics), #396 (F164 follow-up), #397 (F165 closeout summary), #398 (F166 production readiness), #399 (F167 closeout API), #400 (F168 credit note retrieve), #401 (F169 PDF foundation), #402 (F170 payment gateway), #403 (F171 closeout write-side), #404 (F172 credit note cancel), #405 (F173 E2E acceptance), #406 (F174 credit note list), #407 (F175A final backend completion audit + freeze decision).
- F147F is merged as PR #322 — worktree and branch cleaned up.
- Human merge control remains mandatory.
- Agent prompts should use the official runbook and this queue instead of repeating long
  procedural instructions.

### Backend freeze rationale

See `docs/audits/F175A_FINAL_BACKEND_COMPLETION_AUDIT.md`. Summary:
- All 16 Document A backend domains are implemented and tested.
- E2E operational acceptance test (F173) validates the full Titan happy path.
- Remaining gaps are classified as: frontend dependency, infrastructure dependency, external provider/credential dependency, or missing business/fiscal policy.
- No backend-only Document A requirement remains unimplemented.

### Frontend milestone state

Status:
- F177A merged as PR `#410`
- F177B merged as PR `#411`
- FE-B0 merged as PR `#412`
- FE-B merged as PR `#413`
- FE-B0R merged as PR `#414`
- FE-C merged as PR `#415`
- FE-D merged as PR `#416`
- FE-E merged as PR `#417`
- FE-F merged as PR `#418`
- FE-G merged as PR `#419`
- FE-H merged as PR `#420`
- FE-I merged as PR `#421`
- FE-J merged as PR `#422`

Current frontend posture:
- the planned FE-B0 through FE-J bundle sequence is complete on `main`
- the F180 finalization series is complete (see below)
- the F181A audit and corrective PRs are complete (see below)
- the application is ready for realistic user testing

### Frontend audit state

Status:
- F178A merged as PR `#423`
- F178B merged — frontend cartography refresh after FE-C to FE-J merges
- F178D merged — Graphify operational integration (knowledge graph)

Immediate rule for future frontend tasks:
- read `docs/audits/F178A_FRONTEND_CONNECTIVITY_AND_HYGIENE_AUDIT.md`
- read the refreshed F178B cartography/design docs
- do not plan FE-C through FE-J again as future work

### F180 finalization series

Goal: Finish the application for realistic user testing — frontend UX, backend gaps if approved, QA, demo data, documentation, E2E scenarios, final polish.

Backend freeze policy for F180:
- Start frontend-first, reuse existing APIs.
- If existing APIs are sufficient, continue.
- If a missing backend capability blocks a required workflow, report the gap.
- Classify gaps as: (1) small bug fix allowed under freeze, (2) required micro-backend derogation, (3) business/legal decision, (4) future/post-MVP scope.
- Do not implement backend changes without explicit approval (except small bug fixes).

### F180C bundle 3 — Planning/calendar UI

Status:
- **merged** as PR #433
- HEAD at merge: `c2d4c6c`
- scope: weekly planning table view in `PlanningPanel.tsx`, Titan/Hahitantsoa filters, week navigation, route integration, tests fixed

### F180C1 — Enriched client file

Status:
- **merged** as PR #435
- HEAD at merge: `acb7c4c`
- scope: enrich `CustomerFileView` in `CustomerPanel.tsx` with linked documents, billing/invoices, payments, logistics, financial summary, customer metrics, dossier timeline
- frontend-first: implemented using existing APIs

### F180C2 — French localization

Status:
- **merged** as PRs #436, #437
- HEAD at merge: `d83c4b7`
- scope: French translation for remaining panels (financial, planning, commercial ops, etc.)

### F180D — Application finalization for realistic user testing

Goal: Polish, demo data, documentation, E2E scenarios, final readiness.

Backend freeze policy: frontend-first, reuse existing APIs. Report gaps as (1) bug fix, (2) micro-derogation, (3) business/legal decision, (4) future scope.

#### Bundle D1 — Planning panel enhancement + Hahitantsoa confirmation polish

Status:
- **merged** as PR #438
- HEAD at merge: `39342f0`
- scope: PlanningPanel scope tags, duration column, resource count column; HahitantsoaEventDraftsPanel "Confirmé" step; French success notice
- tests: 9 new PlanningPanel tests, all 246 frontend tests pass
- CI: main green at `39342f0`

#### Bundle D2 — Reports/exports UI

Status:
- **BLOCKED** — business/legal decision and backend API contract gap
- No backend endpoints exist for report/export data.
- No frontend report/export components have been implemented.
- The `#reports` navigation entry is an intentional placeholder.
- No work will proceed on reports/exports until: (a) business/legal defines export data scope, format, and access controls; (b) backend API contract is approved.
- This is an accepted critical finding — not to be implemented now.

#### Bundle D3 — Demo data, tester guide, and realistic scenarios

Status:
- **merged** as PR #439
- HEAD at merge: `a338ad0`
- scope:
  - `seed_all_demo` management command (runs all 6 seeds in dependency order)
  - `seed_dev_admin` management command (staff + superuser for testing full permissions)
  - Update `LOCAL_TESTER_GUIDE.md` with: correct Docker service names (`db`, `redis`), `seed_all_demo` usage, admin credentials, realistic Titan/Hahitantsoa workflow scenarios, blocked reports documentation
  - Tests for new commands
  - Bug fix: `seed_demo_hahitantsoa_event_drafts` field name (`hahitantsoa_event_draft` → `event_draft`)
- CI: main green at `a338ad0` (run 28259049930)
- post-merge: continue to Bundle D4

#### Bundle D4 — End-to-end/manual workflow validation

Status:
- **merged** as PR #440
- HEAD at merge: `51056ea`
- scope:
  - Validation report document (`docs/audits/F180D4_E2E_VALIDATION_REPORT.md` — 14 workflows, gap classification, ~88% readiness)
  - Fix stale planning references found during validation (App.tsx, FutureWorkspacePanel, cartography, design docs)
  - No E2E tooling added (justified: no existing E2E setup, adding would be large/risky)
- CI: main green at `51056ea`
- post-merge: continue to Bundle D5

#### Bundle D5 — Fidelity / responsive / accessibility polish

Status:
- **merged** as PR #441
- HEAD at merge: `e920be6`
- scope:
  - 288-line CSS addition (card-hover, status-pills, scope-badges, skeleton animation, form-input, ops-table, metric-icons, btn-primary/secondary, dark-mode overrides)
  - DashboardPanel: French text, metric icons, loading skeleton, removed prototype jargon
  - App.tsx: audit module French, shell hero French, quick-chip aria-labels French
  - AuditPanel, AvailabilityPanel, HahitantsoaEventDraftsPanel: full French translation
  - BillingInvoicePanel: French status labels, "Amount"→"Montant"
  - PaymentWorkflowPanel: French status/kind/method display labels
  - CustomerPanel: remaining English labels fixed
  - LogisticsDeliveryPanel: French event-type/status labels, permission tags
  - CashboxPanel, CautionRefundPanel: French aria-labels and defaults
  - ReturnsHandlingPanel, BreakageLossPanel, StockMovementLedgerPanel: prototype eyebrow text removed
  - All 7 affected test files updated, 246 tests pass
- CI: main green at `e920be6` (run 28267437949)
- post-merge: continue to Bundle D6

#### Bundle D6 — Final readiness audit and client-demo handoff

Status:
- **merged** as PR #442
- HEAD at merge: `2c94d03`
- scope:
  - Created `docs/audits/F180D6_FINAL_READINESS_AUDIT.md` — comprehensive readiness audit:
    - All Titan and Hahitantsoa workflows verified
    - D5 polish (French, CSS, dark-mode) documented
    - D2 reports/exports block verified still correct
    - Demo data and LOCAL_TESTER_GUIDE verified up to date
    - Accessibility/responsive/dark-mode status documented
    - 14 remaining gaps classified (2=polish, 4=placeholder, 5=business, 6=future, 7=infra)
    - Readiness estimate: ~91%
    - Decision: **PRÊT pour tests utilisateur réalistes et démo client**
  - No backend, frontend, or test files modified (docs only)
- CI: main green at `2c94d03` (run 28269131366)

#### Bundle D7 — Reservation detail, new-reservation assistant, and Titan confirmation UI

Status:
- **merged** as PR #443
- HEAD at merge: `7645b9c`
- scope:
  - **Reservation detail**: New "Ressources liées" section in draft detail showing counts of documents, invoices, payments, and logistics events fetched in parallel via existing APIs; each card navigates to Commercial Ops
  - **New-reservation assistant**: Numbered step indicators (1–4) on the wizard rail; "Résumé de la création" preview before draft creation; success notice styling improved
  - **Titan confirmation UI**: Prerequisite checklist (contrat/dépôt/confirmé) with visual met/pending indicators and timestamps
  - Files: AvailabilityPanel.tsx (+152 lines), App.tsx (+1 line), styles.css (+195 lines)
- Backend gaps: none found (all used existing APIs)
- Quality: TS clean, build passes, 246 tests pass
- CI: main green at `7645b9c` (run 28271059102)

### Frontend API integration — Phases 1-10

Goal: Connect all remaining frontend pages to real backend APIs.

Status: **COMPLETE** — all 10 phases merged on 2026-07-18/19.

| Phase | PR | Scope |
|---|---|---|
| 4B | #491 | Connect getInventoryItem API + unit tests |
| 5A | #493 | Validate Titan & Hahitantsoa reservation wizard availability & UI contracts |
| 5B | #497 | Validate reservation amendment requests & availability preflight |
| 6B | #502 | Connect document template administration & versioning to DRF |
| 9 | #503 | Connect Hahitantsoa venues & services to DRF |
| Checkpoint | #504 | Phase integration checkpoint closeout for Phases 6-10 |

Additional phase-related PRs:
- #492 — docs: prevent worktree and validated UI governance drift
- #494 — feat(backend): expose customer lifecycle read contract
- #495 — feat(frontend): connect validated customer list to API
- #496 — feat: connect customer detail read flow
- #498 — docs: close Phase 1 authentication checkpoint
- #499 — docs: close Phase 2 customer read checkpoint
- #500 — docs(reports): record phase 60 R7B document templates reconciliation audit
- #501 — feat: connect customer writes to API

CI: main green at `5d30ecd` after all phases merged.

### F180H — Hotfix CI (pre-existing failures)

Status: **COMPLETE** — merged as PR #508

Scope:
- Backend: ruff format + lint fixes on 13 files (I001, E501, F401, F541)
- Backend: removed duplicate 0007 migration in documents app
- Backend: added missing 0002 migration for procurement QuickExpense validator
- Backend: fixed customer serializer (lifecycle_status/party_type added to read_only_fields)
- Frontend: added convertProformaToContract and voidProforma API functions
- Frontend: added valid_until field to DocumentInstance type
- Frontend: updated 5 test MOCK fixtures

CI: main green at `ed20511` after merge.

### F181A — UI/UX User Journey Audit + Corrective PRs

Status: **COMPLETE** — audit + 4 corrective PRs merged

Audit report: `docs/audits/F181A_UI_UX_USER_JOURNEY_AUDIT.md`
- 37 findings classified by severity (0 Critical, 6 High, 17 Medium, 14 Low)
- Score: ~82% UI/UX quality

Corrective PRs:
| PR | ID | Scope | CI |
|---|---|---|---|
| #506 | F181A-AUDIT | Audit report | ✅ |
| #507 | F181A-HIGH-1 | i18n FR (~60 messages), annulation reservation, notice prospect, helper UUID, alignement libellés | ✅ |
| #509 | F181A-MED-1 | Modal CSS (Tailwind→custom), filtres stock, compteurs segments, lien reçu, onNavigate tab | ✅ |
| #510 | F181A-LOW-1 | Dead code removal, amendment preflight guard, confirm button helper text | ✅ |
| #511 | F181A-DOC-T-1 | Boutons "Convertir en contrat" et "Annuler le proforma" dans TitanDocumentsPanel | ✅ |

CI: main green at `b2339de` after all PRs merged.

Remaining gaps (documented in audit):
- F181A-HAH-8/CUST-2: Prospect status tag in notes → needs backend column (post-F175A)
- F181A-LOG-3/5/6: Logistics HAH, backward transitions → needs business decisions
- F181A-AVAIL-5: Commercial Ops tab navigation → needs prototype implementation

### Active workflow improvement bundle

Status:
- F152A in progress as an agent-tools/docs-only hardening bundle

Scope:
- PR finalization recovery for already-merged PRs
- backend quality-gate guidance hardening
- explicit Docker cleanup by ERP Compose project name
- root dirty-state preflight clarification
- recurring-errors matrix and runbook updates

Hard stops:
- any need to touch backend/, frontend/, tests/, `.github/`, manifests, `.env`, secrets,
  F147F, or non-ERP Docker resources

### F178E — Graphify workflow propagation

Status:
- **merged** as PR #426
- HEAD at merge: `de36a5f`
- scope: propagated Graphify knowledge graph consultation order into all agent
  entrypoint files

### F179A — Ponytail full operational integration

Status:
- **merged** as PR #427
- HEAD at merge: `d2a3246`
- scope: integrated ERP Ponytail anti-overengineering ladder into AGENTS.md and
  all agent entrypoint files

### Active frontend/docs bundle

Status:
- F152D in progress as a docs/tooling frontend-guidance bundle

Scope:
- create canonical `docs/design/DESIGN.md`
- add portable `erp-ui-ux-design-review` skill
- update frontend agent docs to reference canonical design guidance and F150A skills

Hard stops:
- any frontend or backend application mutation
- any CI, Docker, scripts/dev, governance, or secret-surface drift
- any design guidance that breaks DEC-001 or broader business boundaries
### F153D

Status:
- active agent-docs bundle
- branch: `docs/f153d-backend-productivity-metrics`
- worktree: `/home/raillersing/projects/hahitantsoa-titan-erp-f153d-backend-productivity-metrics`

Scope:
- create a lightweight backend productivity and skill-adoption tracking system
- update the runbook with the backend productivity report section
- update the recurring-errors matrix with adoption and reliability failures
- refresh the queue to point the next backend workflow step at F153E if useful

Hard stops:
- backend code changes
- backend script changes
- `.github/` changes
- `.env`, secrets, or non-ERP Docker resources
- any ambiguity that would require touching the active backend feature worktrees

Validation:
- `bash scripts/dev/erp-agent-scope-guard agent-docs`
- `git diff --check`
- confirm no backend/frontend/scripts/.github/dependency manifest changes
- open PR, wait for PR CI, merge with head-SHA protection, verify exact-SHA `main` CI, then clean the worktree/branch

Next planned backend bundle:
- F153E backend workflow refinement if the measurement data shows another lightweight docs-only improvement is useful
- expected focus: narrow follow-up based on F153D adoption findings

## Backend Commercial Operations Status

### F145A

Status:
- merged as PR #249

Scope delivered:
- commercial operations completion plan

### F145B

Status:
- merged as PR #250

Scope delivered:
- documents runtime and commercial artifact foundation

### F145C

Status:
- merged as PR #254

Scope delivered:
- payment foundation

### F145D

Status:
- merged as PR #255

Scope delivered:
- stock movement ledger foundation

### F145E

Status:
- merged as PR #259

Scope delivered:
- return inspection foundation

### F145F

Status:
- merged as PR #261

Scope delivered:
- damage/loss settlement foundation

### F145G

Status:
- merged as PR #263

Scope delivered:
- damage/loss settlement execution foundation

### F145H

Status:
- merged as PR #274

Scope delivered:
- excess receivable invoice foundation
- caution refund and excess receivable data-model foundations within the commercial
  closeout flow

## Next Backend Commercial Bundle

### Recommended next backend bundles (post-F161)

Status:
- F157D–F161 merged: financial closeout consolidation, commercial closeout source kind,
  INV-009 installment enforcement, legal invoice numbering, billing credit notes — all complete on `main`.
- F162A application-wide completion audit completed (81% overall, 87% backend, 70% frontend).

Recommended next bundles:
1. **F163 — Logistics operator-ready expansion**
   - Scope: delivery note generation, complete passation workflow (handover signature / delivery note document), return intake orchestration, logistics event operational depth.
   - Allowed: `backend/apps/logistics/`, `backend/apps/documents/` for delivery note templates, `tests/backend/`
   - Forbidden: frontend files, inventory mutation beyond read-only references, Antigravity/tooling files, `.env`, secrets

2. **F164 — Commercial closeout coherence**
   - Scope: unify cross-app closeout narrative (reservation confirmation → billing invoice → installment → payment → cashbox → logistics → return → damage/loss settlement → excess invoice → credit note/refund). Introduce closeout orchestration service coordinating state across apps without collapsing boundaries.
   - Allowed: backend models, services, selectors across billing, payments, cashbox, inventory, documents; tests
   - Forbidden: frontend files, broad logistics mutation, Antigravity/tooling files

3. **F165 — Production readiness / observability**
   - Scope: health check endpoints (`/health/`, `/ready/`), structured logging, metrics endpoint, production Docker Compose or K8s manifests, environment-specific settings.
   - Allowed: `backend/config/`, `compose.*`, `scripts/`, monitoring setup
   - Forbidden: business logic mutation, frontend files, `.env`, secrets

Hard stops:
- any required frontend change for backend bundles
- any accounting/fiscal policy decision not documented in source rules
- broadening beyond the allowed app scope

Expected validation:
- backend-focused quality checks
- `git diff --check`
- PR CI green before merge
- `main` CI green after merge
- cleanup of the task worktree/branch after merge
## Frontend Catch-Up Status

### Current state

Status:
- frontend has caught up materially since F152 (58% → 70%).
- LoginPanel, AuthContext, session-aware app gating merged (#346).
- Customer CRUD UI with search/filter merged.
- Identity/role CRUD UI merged.
- Billing invoice panel, logistics delivery panel, returns handling panel, breakage/loss panel wired.
- Accessibility and loading-state test coverage expanded.

Largest gaps:
- permission-aware UX gating (role checks integrated into all write panels)
- logistics operational flow UI (prep/handover/delivery note)
- billing/cashbox/credit note operator UI (installments, cashbox sessions)
- end-to-end acceptance

Constraint:
- frontend catch-up remains a separate workstream and must not be folded into backend
  bundles without explicit authorization

### Recommended next frontend bundles
1. **FE-B0 — App shell, brand architecture, and light/dark theme foundation** — implement the shell/token/theming contracts before broad page redesign.
2. **FE-B — Logistics / delivery operational UI** — activate prep/handover/delivery note flow in `LogisticsDeliveryPanel`; wire to backend logistics endpoints.
3. **FE-C — Billing / cashbox / credit note operator UI** — add installment schedule display, cashbox session management, credit note issuance, refund obligation execution trigger.

### Frontend design reference rule

Before any frontend implementation, agents must consult:

- `docs/architecture/application-map/README.md`
- `docs/architecture/application-map/FRONTEND_MAP.md`
- `docs/architecture/application-map/API_AND_DATA_FLOW_MAP.md`
- `docs/architecture/application-map/NAVIGATION_TREE_TARGET.md`
- `docs/design/brand/BRAND_ARCHITECTURE.md`
- `docs/design/CLIENT_APPROVED_UI_REFERENCE.md`
- `docs/design/UI_MIGRATION_CONTRACT.md`
- `docs/design/THEME_AND_DARK_MODE_CONTRACT.md`
- `docs/design/FRONTEND_PROTOTYPE_GAP_ANALYSIS.md`
- `docs/design/FRONTEND_MIGRATION_ROADMAP_FROM_PROTOTYPE.md`
- `docs/design/DESIGN.md`

After any frontend PR that changes navigation, layout, design-system components,
major UX flows, brand usage, theme behavior, or prototype-derived behavior, the
agent must either update the relevant design/cartography docs or justify explicitly
why no update is required.

## Workflow Improvement Gates

### Fallback model safety gate

- Any Kimi or other fallback-model output must be treated as untrusted until it is
  repository-verified.
- No bundle is considered healthy solely because a model reported success.
- If fallback-model work is suspected to be broken, the orchestrator must verify:
  - current branch and worktree state
  - real file diff
  - PR existence/state
  - CI result
  - whether the code is actually merged on `main`

### Done-means-done gate

- A bundle is not complete when it is only drafted, reported, or locally committed.
- Done means:
  - committed intentionally
  - PR opened
  - PR CI green
  - merged
  - post-merge `main` CI green
  - worktree/branch cleanup completed or explicitly handed off

### Stale task queue gate

- Before starting a new bundle, compare this queue with live repo truth:
  - `git rev-parse HEAD`
  - `git worktree list --porcelain`
  - `gh pr list`
  - latest `main` CI status
- If the queue is stale, update the queue or record the mismatch before routing the next
  bundle.

### Backend/frontend matrix gate

- Each new bundle prompt must explicitly classify the task as:
  - backend-only
  - frontend-only
  - docs-only
  - agent-tools only
- The prompt must also state the approved cross-boundary rule:
  - no cross-boundary mutation, or
  - the minimum explicitly approved contract repair only

### Dirty worktree and PR gate

- Before a new bundle starts, verify:
  - no ambiguous dirty files in the target worktree
  - no unrelated untracked files inside the task scope
  - branch state is clear
  - PR state is known
- If there is ambiguity about whether a dirty file is user work or unrelated residue,
  stop and resolve that ambiguity before implementation starts.

## Validation Expectations For Docs/Queue Mutations

- `git diff --check`
- `bash scripts/dev/erp-task-queue-validate`
- `bash scripts/dev/erp-agent-profile-validate` when agent docs are touched
- Agent F documentation review
- Agent B final review
- PR CI green before merge
- post-merge `main` CI green

## Agents/Docs Governance Queue

### F147B

Status:
- merged
- baseline: origin/main at db9fd45
- branch: docs/f147b-orchestrator-compliance-smoke-test (merged as PR #253)
- scope: orchestrator compliance smoke test, docs/audits audit file, task queue update

Result:
- PASS across all compliance checkpoints
- gap identified: erp-agent-scope-guard lacks a dedicated `agent-docs` profile
- agent-command-runbook.md reviewed — no correction needed

### F147C

Status:
- completed agents/docs governance task
- baseline: origin/main at 84a76ea
- branch: docs/f147c-opencode-project-config
- scope: OpenCode project config with adapter agents, commands, and permissions

Scope delivered:
- opencode.json — updated with agent/command/permission config
- .opencode/agents/ — backend-orchestrator, frontend-orchestrator, docs-agent, review-agent adapters
- .opencode/commands/ — task-start, worktree-preflight, pr-create commands
- All agents reference existing docs/ai-agents contracts — no duplication
- Permissions default to ask/deny for risky actions
- No automatic merge

Expected validation:
- `git diff --check`
- PR CI green before merge
- `main` CI green after merge

### F147D

Status:
- completed agents/docs governance task
- baseline: origin/main at 9551caa
- branch: tools/f147d-agent-docs-scope-guard
- scope: add agent-docs profile to erp-agent-scope-guard

Scope delivered:
- scripts/dev/erp-agent-scope-guard — added agent-docs case with check_blocked + check_allowed_only
- docs/audits/F147D_AGENT_DOCS_SCOPE_GUARD_PROFILE.md — audit note
- Profile allows: docs/ai-agents/, docs/audits/, opencode.json, .opencode/
- Profile forbids: backend/, frontend/, tests/, scripts/dev/, .github/, .env*, secrets, dependency manifests

### F152A

Status:
- active agent-tools/docs bundle
- branch: `chore/f152a-workflow-recovery-hardening`
- worktree: `/home/raillersing/projects/hahitantsoa-titan-erp-f152a-workflow-recovery-hardening`

Scope:
- harden `erp-pr-worktree-finalize` for already-merged recovery
- harden `erp-docker-agent-cleanup` for explicit ERP Compose project targeting
- allow `agent-docs` scope validation for narrow ERP workflow helper scripts in mixed governance bundles
- update runbook and recurring-errors audit with PR #318 lessons
- create F152A workflow recovery audit note

Validation:
- `bash scripts/dev/erp-agent-scope-guard agent-tools`
- `bash scripts/dev/erp-agent-scope-guard agent-docs`
- `git diff --check`
- `shellcheck` if available, otherwise `bash -n`, on changed shell scripts
- dry-run Docker cleanup verification only unless explicit safe-apply context exists

### F148A

Status:
- merged as PR #269
- baseline: origin/main at `2d96134`
- branch: `docs/f148a-claude-code-project-integration` (merged)
- scope: Claude Code project integration and governance
- worktree: removed
- note: the original F148A completion audit was merged as PR #264 on a different branch (`docs/f148a-completion-audit`). This entry tracks the Claude Code onboarding task that reused the F148A letter.

Scope delivered:
- `CLAUDE.md` — Claude Code workflow instructions
- `.claude/settings.json` — Claude Code project settings
- `docs/ai-agents/tooling/claude-code-orchestration.md` — Claude Code orchestration documentation
- `docs/ai-agents/orchestrator-task-queue.md` — updated

Validation:
- PR CI green (both Backend quality and Frontend quality passed)
- `main` CI green after merge
- No backend, frontend, test, or script files modified

Validation:
- `git diff --check` — PASS
- Scope manually verified; only the four allowed files changed
- PR CI green before merge
- `main` CI green after merge

### F148B

Status:
- open — Claude Code tooling guard and finalize-wrapper alignment
- baseline: origin/main at `d45a2fe`
- branch: `chore/f148b-claude-tooling-guard-alignment`
- worktree: `/home/raillersing/projects/hahitantsoa-titan-erp-f148b-claude-tooling-guard`
- note: this is a new follow-up tooling task. The prior F148B worktree PR finalization wrapper was merged as PR #265.

Scope:
- update `scripts/dev/erp-agent-scope-guard` so the `agent-docs` profile accepts Claude Code governance paths (`CLAUDE.md`, `.claude/settings.json`, `docs/ai-agents/tooling/claude-code-orchestration.md`)
- update `scripts/dev/erp-pr-worktree-finalize` to be executable and to safely return to the root worktree to fast-forward `main` after a squash merge
- update `docs/ai-agents/tooling/claude-code-orchestration.md`
- update `docs/ai-agents/orchestrator-task-queue.md`
- tooling/governance only

Allowed files:
- `scripts/dev/erp-agent-scope-guard`
- `scripts/dev/erp-pr-worktree-finalize`
- `docs/ai-agents/tooling/claude-code-orchestration.md`
- `docs/ai-agents/orchestrator-task-queue.md`

Stop conditions:
- any required backend/frontend/test change
- any required `.env` or secrets access
- any touch to F147F or its worktree
- any touch to `docs/audits/F140D_OPENCODE_WSL_NATIVE_EVALUATION.md`
- any scope drift outside the allowed files

Coexistence:
- Claude Code does not replace Codex, Antigravity, or OpenCode
- F147F remains paused and must not be resumed until F148B is merged and `main` CI is green
- F147F may later serve as the first Claude Code pilot task after explicit orchestrator assignment

Expected validation:
- `git diff --check` — PASS
- `bash scripts/dev/erp-agent-scope-guard agent-docs` — must pass for F148B changed files
- `scripts/dev/erp-pr-worktree-finalize` — executable bit set
- PR CI green before merge
- `main` CI green after merge

### F148C

Status:
- merged as PR #266
- baseline: origin/main at c8ba67b
- branch: tools/f148c-finalizer-validation (merged)
- scope: validate and harden the worktree PR finalization wrapper

Scope delivered:
- scripts/dev/erp-pr-worktree-finalize — hardened with pending-checks guard,
  branch-uniqueness check, worktree-removal safety (cd to REPO_ROOT after remove),
  and root-worktree refusal
- docs/ai-agents/agent-command-runbook.md — updated worktree finalization section
  with clarified execution context, one-task-one-branch enforcement, simplified
  default invocation
- docs/audits/F148C_FINALIZER_VALIDATION.md — audit note
- F148C runbook documented safe PR validation: materialise-to-tempfile before bash,
  scoped grep for --delete-branch

Validated findings:
- Pending checks bug: statusCheckRollup filter excluded null-conclusion checks,
  allowing merge while CI still running (FIXED: explicit pending check added)
- Orphaned worktree: final git commands ran from removed worktree directory
  (FIXED: cd to REPO_ROOT before branch deletion and status)
- Root-only rule: runbook said only root/main may merge (FIXED: added exception
  for worktree finalization wrapper)
- One-task-one-branch: no cross-worktree check existed
  (FIXED: branch-uniqueness check added before merge)

Validation:
- bash scripts/dev/erp-agent-scope-guard agent-tools — PASS
- bash scripts/dev/erp-pr-worktree-finalize --help — shows usage
- git diff --check — PASS
- PR CI green before merge

### F148D

Status:
- merged as PR #267
- baseline: origin/main at dbe03ce
- branch: docs/f148d-opencode-backend-dry-run (merged)
- scope: OpenCode backend orchestrator dry-run audit (docs-only while Codex is active on F145H)

Scope delivered:
- docs/audits/F148D_OPENCODE_BACKEND_ORCHESTRATOR_DRY_RUN.md — comprehensive dry-run audit
  covering main state, active worktrees, F148A backend findings, safe next bundles,
  recommended next bundle (F145I billing), OpenCode role assessment, risks/stops
- docs/ai-agents/orchestrator-task-queue.md — updated (F148C→merged, F148D→open)
- No backend, frontend, test, script, or .github files modified

Validation:
- bash scripts/dev/erp-agent-scope-guard agent-docs — PASS
- git diff --check — PASS
- Confirmed no forbidden mutations

### F148E

Status:
- merged as PR #268
- baseline: origin/main at `f355def`
- branch: `docs/f148e-opencode-frontend-dry-run` (merged)
- scope: OpenCode frontend orchestrator dry-run audit (docs-only while Antigravity is active on F147F)

Scope delivered:
- docs/audits/F148E_OPENCODE_FRONTEND_ORCHESTRATOR_DRY_RUN.md — comprehensive dry-run audit
  covering main state, active worktrees, F148A frontend findings, safe next bundles,
  recommended next bundle (F147G wire 3 pending panels), OpenCode role assessment, risks/stops
- docs/ai-agents/orchestrator-task-queue.md — updated (F148D→merged, F148E→open)
- No backend, frontend, test, script, or .github files modified

Validation:
- bash scripts/dev/erp-agent-scope-guard agent-docs — PASS
- git diff --check — PASS
- Confirmed no forbidden mutations

### F148F

Status:
- open PR — awaiting human merge
- baseline: origin/main at `3b9835c`
- branch: `docs/f148f-campaign-plan`
- scope: docs-only campaign plan + queue refresh (first bundle of docs-only campaign)

Scope delivered:
- `docs/audits/F148F_DOCS_ONLY_CAMPAIGN_PLAN.md` — campaign plan: discovery, bundling, execution order, hard stops
- `docs/ai-agents/orchestrator-task-queue.md` — updated (F148A→merged, F148B→open, F148C/D/E→merged, HEAD→3b9835c)
- No backend, frontend, test, script, or .github files modified

Validation:
- bash scripts/dev/erp-agent-scope-guard agent-docs — PASS
- git diff --check — PASS
- Confirmed no forbidden mutations

### F148G

Status:
- open PR — awaiting human merge
- baseline: origin/main at `298abf3`
- branch: `docs/f148g-production-readiness`
- scope: production readiness / QA infrastructure audit (docs-only, second bundle of campaign)

Scope delivered:
- `docs/audits/F148G_PRODUCTION_READINESS_AUDIT.md` — audit of QA gaps: no conftest/fixtures,
  no E2E tests, no coverage, no tsc in CI, no production deployment config, no CI concurrency,
  no pre-commit hooks, no secret scanning in CI
- No backend, frontend, test, script, or .github files modified

Validation:
- bash scripts/dev/erp-agent-scope-guard agent-docs — PASS
- git diff --check — PASS
- Confirmed no forbidden mutations

### F149A

Status:
- merged as PR #275
- baseline: origin/main at `1be744a`
- branch: `feat/f149a-agent-ci-docker-lifecycle-hygiene` (merged)
- scope: agent CI Docker lifecycle hygiene

Scope delivered:
- `scripts/dev/erp-docker-agent-cleanup` — dry-run-safe Docker cleanup wrapper
- `docs/ai-agents/agent-command-runbook.md` — Docker cleanup section, post-merge cleanup rules
- `docs/audits/F149A_AGENT_CI_DOCKER_LIFECYCLE_HYGIENE.md` — audit documentation

Validation:
- bash scripts/dev/erp-agent-scope-guard agent-tools — PASS
- git diff --check — PASS
- bash -n scripts/dev/erp-docker-agent-cleanup — PASS
- scripts/dev/erp-docker-agent-cleanup — dry-run output correct
- PR CI green, main CI green after merge

### F149B

Status:
- active agent-tools task
- baseline: origin/main at `c44612f`
- branch: `feat/f149b-worktree-finalizer-main-sync-repair`
- scope: repair erp-pr-worktree-finalize main-sync bug

Scope:
- fix `scripts/dev/erp-pr-worktree-finalize` to use `MAIN_PATH` (main repo root)
  instead of `$REPO_ROOT` (task worktree root) after merge
- update `docs/ai-agents/agent-command-runbook.md` with validation patterns
- update `docs/ai-agents/orchestrator-task-queue.md`
- `docs/audits/F149B_WORKTREE_FINALIZER_MAIN_SYNC_REPAIR.md` — audit documentation
- tooling only

Validation:
- bash scripts/dev/erp-agent-scope-guard agent-tools — PASS
- git diff --check — PASS
- scripts/dev/erp-pr-worktree-finalize --help — shows usage
- grep proving cd "$MAIN_PATH" appears twice and cd "$REPO_ROOT" appears zero times in post-merge paths
- grep proving --match-head-commit in merge command
- grep proving no --delete-branch in executable merge command
- PR CI green before merge
- `main` CI green after merge

### F151A-0

Status:
- **COMPLETED** — merged as PR #302
- main HEAD at merge: `f63144d`
- scope: agent workflow and skills readiness review (docs-only audit)

Scope delivered:
- `docs/audits/F151A0_AGENT_WORKFLOW_SKILLS_READINESS_REVIEW.md` — full audit report
- `docs/ai-agents/orchestrator-task-queue.md` — queue update

### F151A-1

Status:
- **COMPLETED** — merged as PR #303
- main HEAD at merge: `fa9dda5`
- scope: scope guard update for `.agents/skills/`

Scope delivered:
- `scripts/dev/erp-agent-scope-guard` — added `\.agents/skills/` to `agent-docs` allowed pattern

### F151B (Phases 2 & 3)

Status:
- **COMPLETED** — merged as PRs #304, #305
- main HEAD after campaign: `12c1f3c`
- scope: shared agent skills integration (7 skills + usage guide)

Scope delivered:
Phase 2 (PR #304):
- `.agents/skills/backend-quality-gates/SKILL.md`
- `.agents/skills/backend-agent-roles/SKILL.md`
- `.agents/skills/backend-ci-workflow/SKILL.md`
- `docs/ai-agents/tooling/agent-shared-skills.md` — usage guide

Phase 3 (PR #305):
- `.agents/skills/worktree-discipline/SKILL.md`
- `.agents/skills/secret-handling/SKILL.md`
- `.agents/skills/business-boundaries/SKILL.md`
- `.agents/skills/post-merge-cleanup/SKILL.md`

Phase 4 (F150A migration to `.agents/skills/`):
- completed as F151C-2 (PR #312) — 8 frontend skills promoted with `erp-frontend-*` names

### F151C-0

Status:
- **COMPLETED** — merged as PR #308
- main HEAD at merge: `e504ba1`
- scope: agent skills portfolio audit and rationalization plan (docs-only audit)
- audit published: `docs/audits/F151C0_AGENT_SKILLS_PORTFOLIO_AUDIT.md`

Outcome:
- 18 skills inventoried, classified, and rationalized
- 2 deleted, 8 renamed, 8 promoted, 5 missing identified
- Final target: 21 skills under `.agents/skills/` with `erp-*` naming

### F151C-1

Status:
- **COMPLETED** — merged as PRs #310, #311
- main HEAD after campaign: `cca61e2`
- scope: rename all `.agents/skills/` skills to `erp-*` prefix, delete 2 superseded skills

Scope delivered:
- RENAMED (8): `hahitantsoa-erp-task-start`→`erp-task-start`, `backend-quality-gates`→`erp-quality-gates`, `backend-agent-roles`→`erp-agent-roles`, `backend-ci-workflow`→`erp-ci-workflow`, `worktree-discipline`→`erp-worktree-discipline`, `secret-handling`→`erp-secret-handling`, `business-boundaries`→`erp-business-boundaries`, `post-merge-cleanup`→`erp-post-merge-cleanup`
- DELETED (2): `hahitantsoa-erp-backend-validation`, `hahitantsoa-erp-pr-lifecycle`
- UPDATED: `docs/ai-agents/tooling/agent-shared-skills.md` — new skill names, Onboarding section, Discovery section

### F151C-2

Status:
- **COMPLETED** — merged as PR #312
- main HEAD at merge: `cca61e2`
- scope: promote 8 frontend skills from `.opencode/skills/` to `.agents/skills/` with `erp-frontend-*` names

Scope delivered:
- PROMOTED (8): `frontend-scope-guard`→`erp-frontend-scope-guard`, `react-typescript-quality`→`erp-frontend-typescript-quality`, `frontend-api-contracts`→`erp-frontend-api-contracts`, `frontend-testing`→`erp-frontend-testing`, `frontend-accessibility-ux`→`erp-frontend-accessibility-ux`, `frontend-error-recovery`→`erp-frontend-error-recovery`, `frontend-state-forms`→`erp-frontend-state-forms`, `frontend-performance-maintainability`→`erp-frontend-performance-maintainability`
- DELETED: all 8 original `.opencode/skills/` directories
- UPDATED: `docs/ai-agents/tooling/frontend-specialist-skills.md` — updated paths and names
- UPDATED: `docs/ai-agents/tooling/agent-shared-skills.md` — added frontend skills table

### F151C-3

Status:
- **COMPLETED** — merged as PR #313
- main HEAD at merge: `cca61e2`
- scope: create 5 missing skills identified in F151C-0 audit

Scope delivered:
- `.agents/skills/erp-migration-safety/SKILL.md` — migration necessity, reversibility, constraints, locking, rollback
- `.agents/skills/erp-security-review/SKILL.md` — authorization, permissions, input validation
- `.agents/skills/erp-agent-role-assignment/SKILL.md` — role assignment quick reference for orchestrators
- `.agents/skills/erp-api-contracts/SKILL.md` — API contract design, review, and cross-boundary protocol
- `.agents/skills/erp-scope-guard-setup/SKILL.md` — scope guard profiles, usage, and troubleshooting
- UPDATED: `docs/ai-agents/tooling/agent-shared-skills.md` — added all 5 new skills to table

### F151D

Status:
- **IN PROGRESS**
- task: recurring errors to skills matrix
- scope: add a docs/audits matrix mapping recurring ERP workflow errors to the
  correct skills, validation commands, prevention rules, and hard stops; add a short
  runbook pointer; update the queue status entry
- allowed scope:
  - `docs/audits/F151D_RECURRING_ERRORS_TO_SKILLS_MATRIX.md`
  - `docs/ai-agents/agent-command-runbook.md`
  - `docs/ai-agents/orchestrator-task-queue.md`
- forbidden scope:
  - `backend/`
  - `frontend/`
  - `tests/`
  - `.github/`
  - dependency manifests
  - `.env` or secrets
  - `.agents/skills/`
  - paused F147F worktree
  - identity-role-filter worktree or branch
  - unrelated active worktrees
- validation:
  - `bash scripts/dev/erp-agent-scope-guard agent-docs`
  - `git diff --check`
- next step:
  - review the matrix for consistency, then open a docs PR when the diff is clean

### F151E

Status:
- **COMPLETED** — merged as PR #316
- main HEAD at merge: `76d61ef` (pre‑F147F)
- scope: align CI watch interval policy — replace `--interval 15` with `--interval 30` in runbook and F151D matrix

Scope delivered:
- `docs/ai-agents/agent-command-runbook.md` — 2 `--interval 15` → `--interval 30`; added rationale note
- `docs/audits/F151D_RECURRING_ERRORS_TO_SKILLS_MATRIX.md` — 4 `--interval 15` → `--interval 30`
- `docs/ai-agents/orchestrator-task-queue.md` — updated

### F152B

Status:
- active agent-tools/docs bundle
- branch: `chore/f152b-frontend-ci-wrapper`
- worktree: `/home/raillersing/projects/hahitantsoa-titan-erp-f152b`

Scope:
- create `scripts/dev/erp-frontend-ci` — local frontend validation wrapper
- update `docs/ai-agents/agent-command-runbook.md` — reference the new wrapper
- update `docs/audits/F151D_RECURRING_ERRORS_TO_SKILLS_MATRIX.md` — add `vitest: not found` pattern
- update `docs/ai-agents/orchestrator-task-queue.md` — F147F merged, F152B active

Allowed files:
- `scripts/dev/erp-frontend-ci`
- `docs/ai-agents/agent-command-runbook.md`
- `docs/audits/F151D_RECURRING_ERRORS_TO_SKILLS_MATRIX.md`
- `docs/ai-agents/orchestrator-task-queue.md`
- `.agents/skills/erp-frontend-testing/SKILL.md` (optional, brief reference)

Forbidden:
- `backend/`, `frontend/src/`, `frontend/package.json`, `frontend/package-lock.json`, `.github/`, `.env`, secrets
- active backend worktree/branch (`feat/payment-refund-api-hardening`)

Validation:
- `bash -n scripts/dev/erp-frontend-ci`
- `bash scripts/dev/erp-agent-scope-guard agent-tools`
- `bash scripts/dev/erp-agent-scope-guard agent-docs`
- `git diff --check`
- run `scripts/dev/erp-frontend-ci` from the worktree
- PR CI green before merge
- main CI green after merge

### Final skills portfolio (21 skills)

```
.agents/skills/
├── erp-task-start/                  # Onboarding
├── erp-quality-gates/               # Backend quality
├── erp-agent-roles/                 # Backend roles
├── erp-ci-workflow/                 # CI workflow
├── erp-worktree-discipline/         # Worktree rules
├── erp-secret-handling/             # Secret rules
├── erp-business-boundaries/         # Business domain rules
├── erp-post-merge-cleanup/          # Post-merge cleanup
├── erp-migration-safety/            # Migration safety (NEW)
├── erp-security-review/             # Security review (NEW)
├── erp-agent-role-assignment/       # Role assignment (NEW)
├── erp-api-contracts/               # API contracts (NEW)
├── erp-scope-guard-setup/           # Scope guard setup (NEW)
├── erp-frontend-scope-guard/        # Frontend scope
├── erp-frontend-typescript-quality/ # TypeScript quality
├── erp-frontend-api-contracts/      # Frontend API contracts
├── erp-frontend-testing/            # Frontend testing
├── erp-frontend-accessibility-ux/   # Accessibility/UX
├── erp-frontend-error-recovery/     # Error recovery
├── erp-frontend-state-forms/        # State/forms
└── erp-frontend-performance-maintainability/  # Performance

.opencode/skills/                    # (empty after promotion)
```

## Later Repair Track

### F138E

Status:
- planned repair or recovery track after the current orchestration foundation work

Purpose:
- resume or repair any lingering workflow or WIP reliability issues not solved by
  F138B/F138C/F138D

Scope:
- smallest safe workflow or documentation repair only
- no opportunistic feature expansion

Stop conditions:
- any attempt to convert the repair track into product feature work
- any change outside the explicitly approved repair surface

Expected validation:
- focused workflow checks
- `git diff --check`
- PR CI green when code or workflow files require it

## Worktree Separation Rules

- backend task work happens in the backend worktree only
- frontend task work happens in the frontend worktree only
- agent-tools and agent-docs work happen in their own dedicated worktrees only
- never mix F135B and F137C edits in one branch
- never fix unrelated WIP while delivering the active task

## Standard Orchestrator Stops

Stop immediately and ask for human direction when:

- the active worktree is not the expected one
- the branch does not match the assigned task
- forbidden files appear in diff or status
- the task would require reading or using `.env`
- CI fails for a reason that would broaden the task beyond approved scope
- local state shows unrelated user changes that conflict with the task

## Validation Policy

For every task:

- run the baseline branch and status check first
- keep the diff scoped and reviewable
- run the smallest relevant local checks
- open a PR only when authorized
- do not merge automatically
- verify PR CI before merge
- verify `main` and main CI after merge

After merge of F138B/F138C, the default orchestrator preflight becomes:

- `scripts/dev/erp-worktree-preflight`
- `scripts/dev/erp-agent-scope-guard`
- `scripts/dev/erp-backend-compose-ci` for backend DB-backed local validation

## Application Cartography Rule (F176A)

Before any new implementation task, the orchestrator must verify that agents have consulted:

- `docs/architecture/application-map/README.md`
- `docs/architecture/application-map/APPLICATION_FUNCTION_CATALOG.md`
- `docs/architecture/application-map/BACKEND_MAP.md`
- `docs/architecture/application-map/FRONTEND_MAP.md`
- `docs/architecture/application-map/API_AND_DATA_FLOW_MAP.md`
- `docs/architecture/application-map/NAVIGATION_TREE_TARGET.md`
- `docs/architecture/application-map/AGENT_USAGE_GUIDE.md`

After any PR that changes product behavior, API, navigation, or business workflow, the responsible agent must either:

- update the application cartography, or
- explicitly state in the final report why no cartography update is required.

## Queue Update Rule

Update this document when one of these changes occurs:

- the active task changes
- the next frontend task changes
- a task is merged and the queue advances
- a repair track becomes necessary
- the required standard wrappers or gates change
- the application cartography requires a version bump
