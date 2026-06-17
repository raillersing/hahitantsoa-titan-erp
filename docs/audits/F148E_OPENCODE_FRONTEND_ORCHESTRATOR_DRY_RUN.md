# F148E — OpenCode Frontend Orchestrator Dry-Run Audit

## 1. Executive Summary

This report evaluates OpenCode as a frontend orchestrator for the Hahitantsoa/Titan ERP
AI-agent workflow. It is a docs-only dry-run: OpenCode performs the orchestration
workflow (plan, audit, document, queue, PR) without modifying frontend code, because
Antigravity is actively working on frontend in a dedicated worktree.

**Key finding:** OpenCode is ready to serve as frontend orchestrator at Level 2 (maximum
autonomy per frontend-orchestrator contract), but frontend implementation must remain
delegated to a dedicated frontend agent (Antigravity or equivalent) because OpenCode's
opencode.json permissions are edit=ask, write=ask for all frontend paths.

---

## 2. Current Repository State

| Parameter | Value |
|---|---|
| **origin/main HEAD** | `f355def` — `docs(audit): F148D OpenCode backend orchestrator dry-run audit (#267)` |
| **origin/main CI** | Green — last 5 push runs all `success` |
| **Open PRs** | None |
| **Total worktrees** | 5 (1 active backend, 1 active frontend, 1 main, 2 detached) |
| **Frontend component files** | 11 Panel `.tsx` + 3 shell/root `.tsx` = 14 total |
| **Frontend test files** | 13 `.test.tsx` |
| **Frontend API surface** | `api.ts` (~547 lines, 35 functions), `types.ts` (~504 lines) |

---

## 3. Active Worktrees

| Worktree Path | Branch | Purpose |
|---|---|---|
| `.../hahitantsoa-titan-erp` | `main` | Root main repo |
| `.../hahitantsoa-titan-erp-f145h` | `feat/f145h-excess-damage-loss-invoice-foundation` | Codex active backend worktree (DIRTY) |
| `.../hahitantsoa-titan-erp-f147f-antigravity-frontend` | `feat/f147f-antigravity-frontend-ux-hardening` | **Antigravity active frontend worktree (DIRTY)** |
| `.../hahitantsoa-titan-erp-frontend` | (detached HEAD) | Legacy frontend |
| `.../hahitantsoa-titan-erp-openclaw-sandbox` | (detached HEAD) | Decommissioned sandbox |

### 3.1 Antigravity Frontend Worktree Details

The active Antigravity frontend worktree (`feat/f147f-antigravity-frontend-ux-hardening`)
has uncommitted changes touching:

- `frontend/src/ErrorBoundary.tsx` (new) — React error boundary component
- `frontend/src/ErrorBoundary.test.tsx` (new) — error boundary tests
- `frontend/src/App.test.tsx` — updated to test error boundary integration
- `frontend/src/DashboardPanel.tsx` — error boundary wrapping
- `frontend/src/main.tsx` — app-level error boundary
- `frontend/src/styles.css` — error/loading styles

The branch is based on `b4c3cac` (F147E merge), which is **four commits behind**
`origin/main` (pre-dates F148A, F148B, F148C, F148D). Antigravity is working on a stale
baseline.

---

## 4. Why F148E Is Docs-Only

1. **Antigravity has exclusive frontend access.** The F147F worktree is dirty with active
   uncommitted work. Any frontend mutation from another agent would create merge
   conflicts or logic collisions.

2. **One agent equals one worktree equals one branch.** Per AGENTS.md worktree matrix,
   frontend work belongs in the frontend-dedicated worktree. This task's worktree
   (`docs/f148e-opencode-frontend-dry-run`) is an agent-docs worktree, limited to
   `docs/ai-agents/`, `docs/audits/`, `opencode.json`, and `.opencode/`.

3. **Scope guard enforces separation.** `scripts/dev/erp-agent-scope-guard agent-docs`
   forbids all `frontend/`, `backend/`, `tests/`, `scripts/dev/`, `.github/`, and
   dependency manifest changes.

4. **OpenCode's frontend permissions are edit=ask.** In `opencode.json`, the
   `frontend-orchestrator` agent has `edit: ask` and `write: ask` for all paths.
   Autonomous frontend mutation is not authorized.

---

## 5. Frontend-Relevant Findings from F148A

The application-wide completion audit (F148A, PR #264) established:

- **Frontend operational readiness: 45%** (12% weight of overall 59.5%)

### Current Frontend Architecture

| Component | Type | Status |
|---|---|---|
| `App.tsx` | Shell | Live — hash-based navigation, 4 scopes |
| `main.tsx` | Shell | Live — React root |
| `DashboardPanel` | Panel | Live |
| `AvailabilityPanel` | Panel | Live |
| `TitanStockMovementPanel` | Panel | Live |
| `DocumentArtifactPreviewPanel` | Panel | Live |
| `HahitantsoaDiscoveryPanel` | Panel | Live |
| `HahitantsoaEventDraftsPanel` | Panel | Live (1768 lines — needs splitting) |
| `PaymentWorkflowPanel` | Panel | Live |
| `HahitantsoaCommercialOpsPanel` | Panel | Live (orchestrates sub-panels) |
| `LogisticsDeliveryPanel` | Panel | Placeholder (`pending_backend`) |
| `ReturnsHandlingPanel` | Panel | Placeholder (`pending_backend`) |
| `BreakageLossPanel` | Panel | Placeholder (`pending_backend`) |
| `StockMovementLedgerPanel` | Panel | Placeholder (`pending_backend`) |

### Key Gaps from F148A

| Gap | Impact | Priority |
|---|---|---|
| No auth/login UI | No production authentication flow | High |
| No router library (hash-based) | No URL management, no deep linking | Medium |
| No state management (all local useState) | No shared state, prop drilling | Medium |
| 4 placeholder panels | Logistics, Returns, Breakage, Ledger not wired | Medium |
| Flat src/ directory | No component hierarchy | Low |
| No customer CRUD UI | Customer management backend exists but no frontend | Medium |
| No billing/invoice UI | Billing app not yet implemented (backend gap) | Low (blocked) |
| No permission-based UI | No role-based UI controls | Medium |

### Commercial Ops Integration Status

The `HahitantsoaCommercialOpsPanel` manages 6 sub-sections:

| Section | Component | Integration Status |
|---|---|---|
| Documents & Contracts | `DocumentArtifactPreviewPanel` | Partially connected |
| Payments & Receipts | `PaymentWorkflowPanel` | Partially connected |
| Billing & Invoices | (placeholder) | Pending backend (`billing/` app) |
| Logistics & Delivery | `LogisticsDeliveryPanel` | Pending backend (`logistics/` app) |
| Returns Handling | `ReturnsHandlingPanel` | Pending backend integration |
| Breakage & Loss | `BreakageLossPanel` | Pending backend integration |
| Stock Movement Ledger | `StockMovementLedgerPanel` | Pending backend integration |

---

## 6. Safe Next Frontend Bundle Candidates (After Antigravity/F147F Completion)

### Candidate A: Wire 3 Pending Panels to Existing Backends (Recommended)
- **Scope:** Wire `ReturnsHandlingPanel`, `BreakageLossPanel`, `StockMovementLedgerPanel`
  to existing inventory backend APIs (return operations, damage/loss settlement, stock
  movements). Add API calls, loading/error/empty states, and focused tests.
- **Overlap with F147F:** None (F147F touches ErrorBoundary + hardening, not panels)
- **Dependency on F147F:** None (separate files)
- **Backend readiness:** Returns, damage/loss, and stock movement backends exist and are
  tested. API functions are already in `api.ts` for stock movements and returns.
- **Confidence:** High

### Candidate B: Auth/Login UI
- **Scope:** Login page component, logout button, route gating (protect views behind
  session check). Reuses existing Django session auth via `/api-auth/`.
- **Overlap with F147F:** None
- **Dependency on F147F:** None
- **Backend readiness:** Django auth is active; no backend change needed
- **Confidence:** High

### Candidate C: Split HahitantsoaEventDraftsPanel
- **Scope:** Decompose the 1768-line panel into smaller focused sub-components
  (draft list, draft editor, line management, availability preflight).
- **Overlap with F147F:** None
- **Dependency on F147F:** None (single file refactor)
- **Backend readiness:** Internal refactor only
- **Confidence:** High

### Candidate D: Customer CRUD UI
- **Scope:** Customer list, create form, edit form. Uses existing `customers/` backend
  (currently read-only — needs backend CRUD first per F148A recommendation).
- **Overlap with F147F:** None
- **Dependency on F147F:** None
- **Backend readiness:** Backend is read-only; needs backend bundle first (F145I or F145J)
- **Confidence:** Medium (backend-dependent)

---

## 7. Recommended Next Frontend Bundle

**Bundle: F147G — Wire 3 Pending Panels to Existing Backends**

_Candidate after Antigravity/F147F completion._

| Aspect | Detail |
|---|---|
| **Bundle label** | F147G (next in F147 sequence after F147F) |
| **Owner** | Frontend agent (Antigravity or dedicated frontend implementer) |
| **Scope** | Wire `ReturnsHandlingPanel`, `BreakageLossPanel`, `StockMovementLedgerPanel` to existing inventory backend APIs. Add real API calls, loading/error/empty states, and focused tests. |
| **Allowed scope** | `frontend/src/ReturnsHandlingPanel.tsx`, `frontend/src/ReturnsHandlingPanel.test.tsx`, `frontend/src/BreakageLossPanel.tsx`, `frontend/src/BreakageLossPanel.test.tsx`, `frontend/src/StockMovementLedgerPanel.tsx`, `frontend/src/StockMovementLedgerPanel.test.tsx`, `frontend/src/api.ts` (extend), `frontend/src/types.ts` (extend), `frontend/src/HahitantsoaCommercialOpsPanel.tsx` (update status labels) |
| **Forbidden scope** | `backend/`, `tests/backend/`, `LogisticsDeliveryPanel` (backend missing), billing/invoice UI (backend missing), auth/login, router refactor, state management |
| **Expected files** | Modify 3 panel files + 3 test files; extend `api.ts` (if missing endpoints) and `types.ts` (if missing types); update `HahitantsoaCommercialOpsPanel.tsx` status labels |
| **Expected checks** | `npm test` (Vitest), `npm run build` (Vite build), `tsc --noEmit` (type check), `git diff --check` |
| **Validation commands** | `cd frontend && npm ci && npm test && npm run build` |
| **Hard stops** | Backend endpoint missing for any of the 3 panels (reduce scope to panels with existing backends); scope expands into logistics/billing/auth; F147F not yet merged (wait for clean main); backend API contract mismatch requiring backend mutation |

---

## 8. OpenCode's Role for Future Frontend Implementation

**Recommendation: OpenCode remains orchestrator and reviewer only. Frontend
implementation is delegated to Antigravity or a dedicated frontend agent.**

Rationale:

1. **Permission model.** OpenCode's `frontend-orchestrator` adapter has `edit=ask` and
   `write=ask` for all paths. Every frontend edit would require human approval, making
   autonomous implementation impractical.

2. **Tool maturity.** OpenCode adapters are Level 2 (Pursue Goal only with fully
   specified contract). The frontend-orchestrator contract explicitly says Level 4
   auto-merge is forbidden and Level 3 auto-repair is limited to same-PR scope.

3. **Separation of concerns.** The existing workflow (AGENTS.md) already defines
   Agent FE-A (implementer) and Agent FE-B (reviewer) as separate roles. OpenCode is
   best suited as the orchestrator that assigns, delegates, and reviews.

4. **Antigravity is established.** Antigravity already has the frontend worktree and
   active implementation context. Replacing Antigravity would duplicate agent setup
   and risk worktree conflicts.

5. **Backend contract authority.** Frontend agents must never invent endpoints or
   permissions. OpenCode, as orchestrator, is better positioned to validate that
   frontend implementation matches confirmed backend contracts — a review function,
   not an implementation one.

**Recommended OpenCode workflow for next frontend bundle:**

1. OpenCode (orchestrator) produces the task prompt with scope, allowed/forbidden
   files, confirmed backend contracts, and quality gates.
2. Antigravity (Agent FE-A) implements in the frontend worktree.
3. OpenCode (Agent FE-B) performs independent UI/UX review.
4. OpenCode (Agent FE-E) validates API contract integration.
5. OpenCode produces the PR report.
6. Human merges.
7. OpenCode validates main CI and advances the queue.

---

## 9. Risks, Uncertainties, and Stop Conditions

### Risks

| Risk | Impact | Mitigation |
|---|---|---|
| F147F stale baseline (4 commits behind main) | Merge conflict when F147F PR opens | F147F must rebase or merge main before PR |
| OpenCode and Antigravity both attempt frontend edits | File collision, logic conflict | Strict worktree separation enforced by scope guard |
| Panel wiring reveals missing backend endpoint | Scope must be reduced to working panels only | Check api.ts before committing; reduce scope to 2 of 3 panels if needed |
| F148A frontend 45% score is stale | F147F may have improved frontend score since F148A | Re-evaluate after F147F merge |
| Backend F145H may incidentally add logistics/returns endpoints | Accidental overlap with F147G scope | Monitor F145H diff before starting F147G |

### Uncertainties

- **F147F merge timeline** — unknown when Antigravity will finish and create PR
- **F145H merge timeline** — unknown; F145H backend may add endpoints used by panels
- **Main CI after F147F** — must be green before any new frontend task starts
- **OpenCode subagent availability** — native frontend-orchestrator subagent may not
  be available; sequential role execution in OpenCode may be needed
- **Worktree creation for next bundle** — whether to reuse the existing F147F worktree
  or create a new one depends on whether the branch is deleted after merge

### Stop Conditions

Any of the following must stop F148E immediately:

- Any required frontend, backend, test, script, or `.github` mutation
- Any `.env` or secret access
- PR CI red or pending
- Worktree dirty with unrelated files
- Uncertainty about conflict with Antigravity frontend work (F147F)
- The selected next bundle (F147G) overlaps with F147F scope as delivered
- Any panel's backend endpoint is confirmed missing (reduce scope)

---

## 10. OpenCode Frontend Orchestrator Readiness Assessment

| Criterion | Status | Evidence |
|---|---|---|
| **Agent adapter exists** | ✅ | `frontend-orchestrator` in opencode.json + `.opencode/agents/frontend-orchestrator.md` |
| **Prompt contract exists** | ✅ | `docs/ai-agents/prompt-contracts/frontend-orchestrator.md` (Level 2, F138I-v1) |
| **Task queue document** | ✅ | `docs/ai-agents/orchestrator-task-queue.md` |
| **Agent template** | ✅ | `docs/ai-agents/frontend-agent-template.md` (Agents FE-A–FE-F) |
| **Runbook with commands** | ✅ | `docs/ai-agents/agent-command-runbook.md` |
| **Scope guard** | ✅ | `scripts/dev/erp-agent-scope-guard` (backend, frontend, agent-tools, agent-docs profiles) |
| **Worktree preflight** | ✅ | `scripts/dev/erp-worktree-preflight` |
| **Worktree PR finalization** | ✅ | `scripts/dev/erp-pr-worktree-finalize` |
| **Frontend quality gates** | ✅ | `pr-quality-gates.md` with frontend-specific checks |
| **Audit trail** | ✅ | F148A (completion audit), F148D (backend orchestrator), F148E (this audit) |
| **CI green** | ✅ | Last 5 main runs all success |
| **Human merge control** | ✅ | `No merge was performed.` enforced in every prompt contract |
| **Can implement frontend autonomously** | ❌ | edit/write=ask; should remain orchestrator/reviewer only |

**Verdict: OpenCode is ready as a Level 2 frontend orchestrator.** It can plan, delegate,
review, and manage the task queue. Frontend implementation should be delegated to
Antigravity or a dedicated frontend agent.

---

## 11. Validation Performed

- `bash scripts/dev/erp-agent-scope-guard agent-docs` — PASS (no forbidden paths)
- `git diff --check` — PASS (no whitespace errors)
- `git status --short` — clean
- No `frontend/`, `backend/`, `tests/`, `scripts/dev/`, `.github/`, `.env`, or
  dependency manifest files created or modified

---

## 12. Summary

- **Branch**: `docs/f148e-opencode-frontend-dry-run`
- **Changed files**: `docs/audits/F148E_OPENCODE_FRONTEND_ORCHESTRATOR_DRY_RUN.md`,
  `docs/ai-agents/orchestrator-task-queue.md`
- **Validation**: scope guard PASS, `git diff --check` PASS
- **No frontend code was modified.**
- **Recommended next frontend bundle**: F147G — Wire 3 Pending Panels to Existing
  Backends (candidate after Antigravity/F147F completion)
- **OpenCode role**: Orchestrator and reviewer only; delegate implementation to
  Antigravity or dedicated frontend agent
