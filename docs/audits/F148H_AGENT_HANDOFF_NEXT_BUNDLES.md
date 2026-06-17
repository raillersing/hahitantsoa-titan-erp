# F148H — Agent Governance Handoff + Next-Bundle Plan

## 1. Current State Summary

| Parameter | Value |
|---|---|
| **origin/main HEAD** | `dcb57fb` — F148G production readiness audit (#272) |
| **origin/main CI** | Green — last 5 push runs all `success` |
| **Open PRs** | PR #270 — `chore: align Claude Code tooling guards (F148B)` (OPEN) |
| **Active dirty worktrees** | F145H (Codex backend), F147F (Antigravity frontend) |

### Merged docs-only tasks (F148 series)
- F148A — Claude Code governance (PR #269)
- F148B — Tooling guard alignment (PR #270, still open — scripts task)
- F148C — Worktree PR finalization validation (PR #266)
- F148D — Backend orchestrator dry-run audit (PR #267)
- F148E — Frontend orchestrator dry-run audit (PR #268)
- F148F — Docs-only campaign plan (PR #271)
- F148G — Production readiness audit (PR #272)

---

## 2. Agent Roles and Responsibilities

### OpenCode
- **Role:** Orchestrator, reviewer, and docs/tooling workflow agent
- **Worktree:** Agent-docs worktree (this branch)
- **Scope:** `docs/audits/`, `docs/ai-agents/`, `opencode.json`, `.opencode/`
- **Max autonomy:** Level 2 (edit=ask, write=ask for all paths)
- **Merge authority:** Orchestrate and review only; never merge automatically

### Codex
- **Role:** Default backend and frontend implementation agent
- **Worktree:** Backend worktree (currently F145H)
- **Scope:** `backend/`, `tests/backend/`, backend audits
- **Current task:** F145H — excess damage/loss invoice foundation (DIRTY)
- **Baseline:** `50ec2b0` (5 commits behind main)

### Antigravity
- **Role:** Windows/WSL bridge agent, frontend hardening
- **Worktree:** Frontend worktree (currently F147F)
- **Scope:** `frontend/`, frontend audits
- **Current task:** F147F — frontend UX hardening (ErrorBoundary, tests, styles) (DIRTY)
- **Baseline:** `b4c3cac` (6 commits behind main)

### Claude Code
- **Role:** WSL-native project agent
- **Governance:** `CLAUDE.md`, `.claude/settings.json`,
  `docs/ai-agents/tooling/claude-code-orchestration.md`
- **Coexistence:** Does not replace Codex, Antigravity, or OpenCode
- **Constraints:** Follows same AGENTS.md workflow, wrappers, and branch discipline

---

## 3. Worktree Separation Rules

Per AGENTS.md and confirmed by all audits (F148D/F148E):

| Agent | Worktree Suffix | Branch Prefix | Allowed Paths |
|---|---|---|---|
| Backend (Codex) | `-f145h` (or next) | `feat/f145*` | `backend/`, `tests/backend/` |
| Frontend (Antigravity) | `-f147f` (or next) | `feat/f147*` | `frontend/` |
| Tooling | `-f148b` | `chore/f148b-*` | `scripts/dev/`, `docs/` |
| Docs (OpenCode) | `-f148*` | `docs/f148*` | `docs/ai-agents/`, `docs/audits/` |

**Cardinal rule:** Never modify another agent's worktree. Never put two agents on the
same files. Never mix backend, frontend, agent-tools, and agent-docs edits in one branch.

---

## 4. Orchestration Handoff Protocol

When one agent completes its task and the next begins:

### Backend Handoff (Codex → next backend agent)
1. Codex finishes F145H, creates PR, merges, main CI green.
2. Next backend agent syncs to main (post-F145H).
3. Next backend agent creates dedicated worktree + branch.
4. OpenCode (orchestrator) produces task prompt with scope, allowed/forbidden files,
   quality gates, and confirmed contracts.
5. Next backend agent implements in the backend worktree.
6. OpenCode (reviewer) performs independent review.
7. Human merges.
8. OpenCode validates main CI and advances queue.

### Frontend Handoff (Antigravity → next frontend agent)
1. Antigravity finishes F147F, creates PR, merges, main CI green.
2. Next frontend agent syncs to main (post-F147F).
3. Next frontend agent creates dedicated worktree + branch.
4. OpenCode (orchestrator) produces task prompt with scope, confirmed backend contracts,
   and quality gates.
5. Next frontend agent implements in the frontend worktree.
6. OpenCode (reviewer) performs independent review.
7. Human merges.
8. OpenCode validates main CI and advances queue.

### Docs/Tooling Handoff
Docs-only and tooling tasks follow the same pattern but use agent-docs or agent-tools
profiles instead of backend/frontend worktrees.

---

## 5. Next Backend Bundle Plan (After F145H)

**Recommended: F145I — Billing/Payment Foundation Completion**
(per F148D recommendation)

| Aspect | Detail |
|---|---|
| **Owner** | Codex or dedicated backend implementer |
| **Scope** | Implement `billing/` app: invoice model, service, endpoints |
| **Allowed** | `backend/apps/billing/` (new), `payments/` (extend), `tests/backend/test_billing/` |
| **Forbidden** | `identity/`, `logistics/`, `inventory/`, `documents/`, `reservations/` |
| **Hard stops** | F145H not yet merged; payment gateway integration (out of scope) |
| **Status** | Awaiting Codex F145H completion |

---

## 6. Next Frontend Bundle Plan (After F147F)

**Recommended: F147G — Wire 3 Pending Panels to Existing Backends**
(per F148E recommendation)

| Aspect | Detail |
|---|---|
| **Owner** | Antigravity or dedicated frontend implementer |
| **Scope** | Wire `ReturnsHandlingPanel`, `BreakageLossPanel`, `StockMovementLedgerPanel` to backends |
| **Allowed** | `frontend/src/` (3 panels + tests), `api.ts`, `types.ts` |
| **Forbidden** | `LogisticsDeliveryPanel` (backend missing), `billing/` (backend missing), auth/login |
| **Hard stops** | F147F not yet merged; confirmed missing backend endpoint (reduce scope) |
| **Status** | Awaiting Antigravity F147F completion |

---

## 7. Worktree PR Finalization Observations

During execution of F148D, F148E, F148F, and F148G, a recurring issue was observed:
the `erp-pr-worktree-finalize` script fails at the `git pull --ff-only origin main`
step when run from a task worktree, because the local `main` branch in the worktree
diverges from `origin/main` after a squash-merge.

**Root cause:** The script fetches origin and runs `git pull --ff-only origin main`
while the worktree is on a feature branch (`docs/f148*`), not on `main`. The
`--ff-only` pull fails when the two branches have diverged.

**Impact:** The PR merges successfully and main CI passes, but the worktree removal,
branch deletion, and pruning steps in the script are skipped. Manual cleanup is
required post-merge.

**Recommended fix (docs-only note):** Update the finalization script to explicitly
checkout/switch to `main` (or use `git fetch origin main:main --ff-only`) before
pulling, to ensure the pull targets the correct branch. This is a script change and
should be handled in a future tools-governance task (F148B or F138E).

---

## 8. Validation Performed

- `bash scripts/dev/erp-agent-scope-guard agent-docs` — PASS (no forbidden paths)
- `git diff --check` — PASS (no whitespace errors)
- `git status --short` — clean
- No `backend/`, `frontend/`, `tests/`, `scripts/dev/`, `.github/`, `.env`, or
  dependency manifest files created or modified
- No `docs/audits/F140D_OPENCODE_WSL_NATIVE_EVALUATION.md` included
