# F148F — Docs-Only Campaign Plan

## 1. Current Repository State

| Parameter | Value |
|---|---|
| **origin/main HEAD** | `3b9835c` — `docs: integrate Claude Code workflow governance (#269)` |
| **origin/main CI** | Green — last 3 push runs all `success` |
| **Open PRs** | PR #270 — `chore: align Claude Code tooling guards (F148B)` (OPEN, MERGEABLE) |
| **Total worktrees** | 6 (1 main, 1 backend, 1 frontend, 1 F148B, 2 detached) |

## 2. Active Worktrees

| Worktree | Branch | Status |
|---|---|---|
| `.../hahitantsoa-titan-erp` | `main` | Root repo |
| `.../hahitantsoa-titan-erp-f145h` | `feat/f145h-excess-damage-loss-invoice-foundation` | Codex backend (DIRTY) |
| `.../hahitantsoa-titan-erp-f147f-antigravity-frontend` | `feat/f147f-antigravity-frontend-ux-hardening` | Antigravity frontend (DIRTY) |
| `.../hahitantsoa-titan-erp-f148b-claude-tooling-guard` | `chore/f148b-claude-tooling-guard-alignment` | F148B tooling (clean, PR #270 open) |
| `.../hahitantsoa-titan-erp-frontend` | (detached) | Legacy |
| `.../hahitantsoa-titan-erp-openclaw-sandbox` | (detached) | Decommissioned |

**Why this campaign is docs-only:** Codex (backend), Antigravity (frontend), and the F148B
agent (tooling) all have active exclusive worktrees. Any non-docs mutation would risk
collision.

## 3. Discovery of Remaining Docs-Only Tasks

### Completed and already reflected in queue
- F148C (finalizer validation) — merged PR #266
- F148D (backend orchestrator dry-run) — merged PR #267
- F148E (frontend orchestrator dry-run) — merged PR #268

### Completed but NOT yet reflected in queue
- **F148A** (Claude Code governance) — **merged as PR #269**; queue still says "open"
- **F148B** (Claude tooling guard alignment) — **open PR #270**; queue has no entry

### Discovered docs-only task candidates

| # | Task | Description | Suggested Label | Estimated Effort |
|---|---|---|---|---|
| 1 | **Campaign Plan + Queue Refresh** | Campaign plan document; update queue: F148A→merged, F148B→open, refresh HEAD | F148F | Small (1 doc, 1 queue edit) |
| 2 | **Production Readiness / QA Infrastructure Audit** | Docs-only audit of QA gaps from F148A §5.10: conftest, factory fixtures, E2E, coverage, CI type-checking, production deployment | F148G | Medium (1 audit doc) |
| 3 | **Agent Governance Handoff + Next-Bundle Plan** | Cross-agent handoff notes, finalization plan for backend/frontend bundles after F145H/F147F complete, audit index review | F148H | Medium (1-2 docs) |

## 4. Grouping Into Medium Bundles

### Bundle 1: F148F — Campaign Plan + Queue Refresh
**Scope:** Campaign plan document (`docs/audits/F148F_DOCS_ONLY_CAMPAIGN_PLAN.md`),
task queue refresh (F148A→merged, F148B→open, update HEAD).

**Allowed files:** `docs/audits/F148F_DOCS_ONLY_CAMPAIGN_PLAN.md`,
`docs/ai-agents/orchestrator-task-queue.md`

### Bundle 2: F148G — Production Readiness / QA Infrastructure Audit
**Scope:** Docs-only audit of QA, testing, and production readiness gaps, based on
F148A §5.10 findings. No scripts or config files are modified.

**Allowed files:** `docs/audits/F148G_PRODUCTION_READINESS_AUDIT.md`

### Bundle 3: F148H — Agent Governance Handoff + Next-Bundle Plan
**Scope:** Cross-agent handoff notes documenting orchestrator responsibilities,
next backend/frontend bundle plans after F145H/F147F, audit index consistency check.

**Allowed files:** `docs/audits/F148H_AGENT_HANDOFF_NEXT_BUNDLES.md`,
`docs/ai-agents/orchestrator-task-queue.md` (minor status update if needed)

## 5. Execution Order

1. **F148F** → Campaign Plan + Queue Refresh (this bundle)
2. **F148G** → Production Readiness / QA Infrastructure Audit
3. **F148H** → Agent Governance Handoff + Next-Bundle Plan

Each bundle uses a dedicated branch and worktree. After each merge and green main CI,
sync and continue to the next.

## 6. Explicit Forbidden Scopes

- `backend/` — never
- `frontend/` — never
- `tests/` — never
- `scripts/dev/` — never (F148B handles this)
- `.github/` — never
- `.env` or secrets — never
- dependency manifests — never
- `docs/audits/F140D_OPENCODE_WSL_NATIVE_EVALUATION.md` — never unless explicitly authorized
- `.claude/` — already established by F148A; not a docs-only task concern
- `CLAUDE.md` — already established; not a docs-only task concern
- OpenCode adapter config (`.opencode/`, `opencode.json`) — not needed for these bundles
- Any agent's active worktree (`F145H`, `F147F`, `F148B`)

## 7. Hard Stops

Stop immediately if any of the following occurs:

- Any backend/frontend/test/script/.github/dependency mutation is required
- Any `.env` or secret access is required
- `F140D` untracked file would be included
- Scope guard fails
- `git diff --check` fails
- PR CI is pending, red, cancelled, unstable, or missing
- PR merge state is not CLEAN
- `scripts/dev/erp-pr-worktree-finalize` refuses to proceed
- Active Codex backend or Antigravity frontend work would be affected
- A docs-only task depends on a business decision not documented
- Any bundle becomes too large; split into medium bundles
