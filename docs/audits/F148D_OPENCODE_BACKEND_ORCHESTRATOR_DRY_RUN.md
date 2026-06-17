# F148D — OpenCode Backend Orchestrator Dry-Run Audit

## 1. Executive Summary

This report evaluates OpenCode as a backend orchestrator for the Hahitantsoa/Titan ERP
AI-agent workflow. It is a docs-only dry-run: OpenCode performs the orchestration
workflow (plan, audit, document, queue, PR) without modifying backend code, because
Codex is actively working on backend in a dedicated worktree.

**Key finding:** OpenCode is ready to serve as backend orchestrator at Level 2 (maximum
autonomy per backend-orchestrator contract), but backend implementation must remain
delegated to a dedicated backend agent (Codex or equivalent) because OpenCode's
opencode.json permissions are edit=ask, write=ask for all backend paths.

---

## 2. Current Repository State

| Parameter | Value |
|---|---|
| **origin/main HEAD** | `dbe03ce` — `feat(tools): validate and harden worktree PR finalization wrapper (F148C) (#266)` |
| **origin/main CI** | Green — last 5 push runs all `success` |
| **Open PRs** | None |
| **Total worktrees** | 6 (2 active backend/frontend branches, 1 docs branch, 1 main, 2 detached) |
| **Backend apps** | 11 (8 registered in `INSTALLED_APPS`; `billing/`, `identity/`, `logistics/` are empty placeholders) |

---

## 3. Active Worktrees

| Worktree Path | Branch | Purpose |
|---|---|---|
| `.../hahitantsoa-titan-erp` | `main` | Root main repo |
| `.../hahitantsoa-titan-erp-f145h` | `feat/f145h-excess-damage-loss-invoice-foundation` | **Codex active backend worktree (DIRTY)** |
| `.../hahitantsoa-titan-erp-f147f-antigravity-frontend` | `feat/f147f-antigravity-frontend-ux-hardening` | Frontend worktree |
| `.../hahitantsoa-titan-erp-f148d-opencode-backend-dry-run` | `docs/f148d-opencode-backend-dry-run` | **This task (docs-only)** |
| `.../hahitantsoa-titan-erp-frontend` | (detached HEAD) | Legacy frontend |
| `.../hahitantsoa-titan-erp-openclaw-sandbox` | (detached HEAD) | Decommissioned sandbox |

### 3.1 Codex Backend Worktree Details

The active Codex backend worktree (`feat/f145h-excess-damage-loss-invoice-foundation`)
has uncommitted changes touching:

- `backend/apps/documents/registry.py` — template registration
- `backend/apps/documents/runtime.py` — document generation
- `backend/apps/documents/excess_receivable.py` (new) — excess receivable logic
- `backend/apps/documents/templates_documents/` (new) — new templates
- `backend/apps/inventory/services.py` — service layer changes
- `backend/apps/inventory/views.py` — view changes
- `backend/apps/inventory/urls.py` — URL changes

The branch is based on `50ec2b0`, which is **three commits behind `origin/main`** (pre-dates
F148A, F148B, F148C). Codex is working on a stale baseline.

---

## 4. Why F148D Is Docs-Only

1. **Codex has exclusive backend access.** The F145H worktree is dirty with active
   uncommitted work. Any backend mutation from another agent would create merge
   conflicts or logic collisions.

2. **One agent equals one worktree equals one branch.** Per AGENTS.md worktree matrix,
   backend work belongs in the backend-dedicated worktree. This task's worktree
   (`docs/f148d-opencode-backend-dry-run`) is an agent-docs worktree, limited to
   `docs/ai-agents/`, `docs/audits/`, `opencode.json`, and `.opencode/`.

3. **Scope guard enforces separation.** `scripts/dev/erp-agent-scope-guard agent-docs`
   forbids all `backend/`, `frontend/`, `tests/`, `scripts/dev/`, `.github/`, and
   dependency manifest changes.

4. **OpenCode's backend permissions are edit=ask.** In `opencode.json`, the
   `backend-orchestrator` agent has `edit: ask` and `write: ask` for all paths.
   Autonomous backend mutation is not authorized.

---

## 5. Backend-Relevant Findings from F148A

The application-wide completion audit (F148A, PR #264) established:

- **Overall completion: 59.5%** (medium confidence)
- **Backend core domains** (inventory, reservations, hahitantsoa, documents): ~85% functional
- **Backend edge domains** (customers, payments, audit): ~45% functional
- **Backend unfilled domains** (billing, identity, logistics): ~0% (empty placeholders)
- **Highest-risk gaps:** no billing/invoicing (critical), no identity/role management (high),
  no frontend auth UI (high), customer management read-only (medium)

### Top backend gaps requiring implementation:

| Domain | Current State | Priority |
|---|---|---|
| Billing/payment | Empty `billing/` app; `payments/` has basic model | Critical |
| Identity/roles | Empty `identity/` app; Django auth only | High |
| Customer CRUD | Read-only list/retrieve only | Medium |
| Logistics delivery | Empty `logistics/` app | Medium |

---

## 6. Safe Next Backend Bundle Candidates (After Codex/F145H Completion)

### Candidate A: Billing/Payment Foundation (Recommended)
- **Scope:** Implement `billing/` app with invoice model, service, endpoints
- **Overlap with F145H:** None (F145H touches documents + inventory, not billing)
- **Dependency on F145H:** None (separate app, no shared models)
- **Confidence:** High

### Candidate B: Identity/Role Management
- **Scope:** Implement `identity/` app with user profiles, roles, permissions
- **Overlap with F145H:** None
- **Dependency on F145H:** None
- **Confidence:** High

### Candidate C: Customer CRUD Completion
- **Scope:** Add create/update/delete to `customers/` with services+selectors
- **Overlap with F145H:** None
- **Dependency on F145H:** None
- **Confidence:** High

### Candidate D: Production Readiness (Tooling)
- **Scope:** conftest, factory fixtures, E2E smoke, CI type-checking, coverage
- **Overlap with F145H:** None (tooling, not backend code)
- **Dependency on F145H:** None
- **Confidence:** High

---

## 7. Recommended Next Backend Bundle

**Bundle: F145I — Billing/Payment Foundation Completion**

_Candidate after Codex/F145H completion._

| Aspect | Detail |
|---|---|
| **Bundle label** | F145I (next in F145 sequence after F145H) |
| **Owner** | Backend agent (Codex or dedicated backend implementer) |
| **Scope** | Invoice model, invoice generation service, billing endpoints (list/create/retrieve), billing frontend card |
| **Allowed scope** | `backend/apps/billing/` (new), `backend/apps/payments/` (extend), `tests/backend/test_billing/` |
| **Forbidden scope** | `identity/`, `logistics/`, `frontend/` (except billing card), `inventory/`, `documents/`, `reservations/` |
| **Expected files** | `billing/models.py`, `billing/services.py`, `billing/selectors.py`, `billing/views.py`, `billing/serializers.py`, `billing/urls.py`, migration file; extend `payments/services.py` |
| **Expected tests** | Model tests, service layer tests, endpoint integration tests, payment-billing linkage tests |
| **Validation commands** | `ruff check backend`, `python manage.py check`, `python manage.py makemigrations --check`, `pytest tests/backend/test_billing/ -q` |
| **Hard stops** | Payment gateway integration (out of scope), tax calculation (out of scope), billing frontend beyond a single card (reduce scope), F145H not yet merged (wait for clean main) |

---

## 8. OpenCode's Role for Future Backend Implementation

**Recommendation: OpenCode remains orchestrator and reviewer only. Backend
implementation is delegated to Codex or a dedicated backend agent.**

Rationale:

1. **Permission model.** OpenCode's `backend-orchestrator` adapter has `edit=ask` and
   `write=ask` for all paths. Every backend edit would require human approval, making
   autonomous implementation impractical.

2. **Tool maturity.** OpenCode adapters are Level 2 (Pursue Goal only with fully
   specified contract). The backend-orchestrator contract explicitly says Level 4
   auto-merge is forbidden and Level 3 auto-repair is limited to same-PR scope.

3. **Separation of concerns.** The existing workflow (AGENTS.md) already defines
   Agent A (implementer) and Agent B (reviewer) as separate roles. OpenCode is best
   suited as the orchestrator that assigns, delegates, and reviews — not as the
   implementer.

4. **Codex is established.** Codex already has the backend worktree and active
   implementation context. Replacing Codex with OpenCode as backend implementer
   would duplicate agent setup and risk worktree conflicts.

**Recommended OpenCode workflow for next backend bundle:**

1. OpenCode (orchestrator) produces the task prompt with scope, allowed/forbidden
   files, and quality gates.
2. Codex (Agent A) implements in the backend worktree.
3. OpenCode (Agent B) performs independent review.
4. OpenCode produces the PR report.
5. Human merges.
6. OpenCode validates main CI and advances the queue.

---

## 9. Risks, Uncertainties, and Stop Conditions

### Risks

| Risk | Impact | Mitigation |
|---|---|---|
| F145H stale baseline (3 commits behind main) | Merge conflict when F145H PR opens | F145H must rebase or merge main before PR |
| OpenCode and Codex both attempt backend edits | File collision, logic conflict | Strict worktree separation enforced by scope guard |
| F148A medium confidence (±1% overall) | Bundle size estimate may be off by 1 PR | Plan each bundle as 2-4 sub-tasks; adjust after first PR |
| No active worktree for the recommended bundle exists yet | Delay while setting up backend worktree | Create backend worktree at task start |
| F145H scope may incidentally touch billing | Overlap if Codex extends beyond F145H scope | Monitor F145H diff before starting F145I |

### Uncertainties

- **F145H merge timeline** — unknown when Codex will finish and create PR
- **Main CI after F145H** — must be green before any new backend task starts
- **OpenCode subagent availability** — native backend-orchestrator subagent may not
  be available; sequential role execution in OpenCode may be needed
- **Worktree creation for next bundle** — whether to reuse the existing F145H worktree
  or create a new one depends on whether the branch is deleted after merge

### Stop Conditions

Any of the following must stop F148D immediately:

- Any required backend, frontend, test, script, or `.github` mutation
- Any `.env` or secret access
- PR CI red or pending
- Worktree dirty with unrelated files
- Uncertainty about conflict with Codex backend work (F145H)
- The selected next bundle (F145I billing) overlaps with F145H scope as delivered

---

## 10. OpenCode Backend Orchestrator Readiness Assessment

| Criterion | Status | Evidence |
|---|---|---|
| **Agent adapter exists** | ✅ | `backend-orchestrator` in opencode.json + `.opencode/agents/backend-orchestrator.md` |
| **Prompt contract exists** | ✅ | `docs/ai-agents/prompt-contracts/backend-orchestrator.md` (Level 2, F138I-v1) |
| **Task queue document** | ✅ | `docs/ai-agents/orchestrator-task-queue.md` |
| **Agent template** | ✅ | `docs/ai-agents/backend-agent-template.md` (Agents A–F) |
| **Runbook with commands** | ✅ | `docs/ai-agents/agent-command-runbook.md` |
| **Scope guard** | ✅ | `scripts/dev/erp-agent-scope-guard` (backend, frontend, agent-tools, agent-docs profiles) |
| **Worktree preflight** | ✅ | `scripts/dev/erp-worktree-preflight` |
| **Worktree PR finalization** | ✅ | `scripts/dev/erp-pr-worktree-finalize` |
| **Backend compose CI** | ✅ | `scripts/dev/erp-backend-compose-ci` |
| **Audit trail** | ✅ | F148A (completion audit), F148B (finalization tooling), F148C (validation) |
| **CI green** | ✅ | Last 5 main runs all success |
| **Human merge control** | ✅ | `No merge was performed.` enforced in every prompt contract |
| **Can implement backend autonomously** | ❌ | edit/write=ask; should remain orchestrator/reviewer only |

**Verdict: OpenCode is ready as a Level 2 backend orchestrator.** It can plan, delegate,
review, and manage the task queue. Backend implementation should be delegated to Codex
or a dedicated backend agent.

---

## 11. Validation Performed

- `scripts/dev/erp-agent-scope-guard agent-docs` — PASS (no forbidden paths)
- `git diff --check` — PASS (no whitespace errors)
- `git status --short` — clean (only pre-existing untracked file `F140D_*`)
- No `backend/`, `frontend/`, `tests/`, `scripts/dev/`, `.github/`, `.env`, or
  dependency manifest files created or modified

---

## 12. Summary

- **PR**: #267
- **Branch**: `docs/f148d-opencode-backend-dry-run`
- **Changed files**: `docs/audits/F148D_OPENCODE_BACKEND_ORCHESTRATOR_DRY_RUN.md`,
  `docs/ai-agents/orchestrator-task-queue.md`
- **Validation**: scope guard PASS, `git diff --check` PASS
- **No backend code was modified.**
- **Recommended next backend bundle**: F145I — Billing/Payment Foundation Completion
  (candidate after Codex/F145H completion)
- **OpenCode role**: Orchestrator and reviewer only; delegate implementation to Codex
  or dedicated backend agent
