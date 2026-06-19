# Orchestrator Task Queue

## Current State

- `origin/main` HEAD is `d6296f0` (merge of F147F PR #322 and F151E PR #316).
- `main` CI is green as verified on 2026-06-19.
- F145A through F145H are merged on `main`.
- Identity / role management foundation merged as PR #282.
- Merged backend PRs: #284 (logistics), #285 (audit read API), #286 (customer write API), #287 (payments operational completion), #288 (billing invoice list filtering), #289 (customer list filtering), #290 (payment negative-permission tests), #291 (billing invoice cancellation), #292 (reservation draft list filtering), #294 (inventory item list filtering), #295 (stock movement list filtering), #296 (return operation list filtering), #297 (damage/loss settlement list filtering), #298 (settlement execution list filtering), #299 (hahitantsoa event draft list filtering), #306 (caution refund execution workflow).
- PR #318 (identity role and assignment list filtering) is merged and serves as the
  trigger case for workflow hardening in F152A.
- Merged docs/tooling PRs: #283 (Graphify pilot), #293 (queue refresh), #300 (docker cleanup), #301 (frontend skills), #302 (F151A-0 audit), #303 (F151A-1 scope guard), #304 (F151B backend skills), #305 (F151B cross-agent skills), #307 (queue refresh), #308 (F151C-0 audit), #310 (F151C-1 naming cleanup), #311 (F151C-1 naming cleanup repush), #312 (F151C-2 frontend promotion), #313 (F151C-3 missing skills), #314 (F151C queue update), #316 (F151E interval alignment), #322 (F147F frontend UX hardening).
- Open PRs:
  - None in backend commercial queue; all closed and merged.
- F147F is merged as PR #322 — worktree and branch cleaned up.
- Human merge control remains mandatory.
- Agent prompts should use the official runbook and this queue instead of repeating long
  procedural instructions.

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

### Recommended next backend bundle

Status:
- next backend commercial bundle after full PR queue integration and main green

Recommended scope:
- identity role list filtering and negative permission tests

Reason:
- identity/role management foundation (PR #282) is merged and functional
- the next natural increment is list filtering (ApplicationRole by name/scope, UserRoleAssignment by role/assigned date range) and negative permission tests for identity endpoints
- this follows the established pattern of recent PRs #288-#292 and #290
- it requires no migrations, no frontend changes, and no new business decisions

Allowed scope:
- backend ApplicationRole list filtering (name, scope)
- backend UserRoleAssignment list filtering enhancements (role, assigned date range)
- backend identity negative permission and failure-mode tests
- backend commercial audit/status docs needed for that bundle

Forbidden scope:
- frontend files
- Antigravity/tooling files
- F140D
- `.env`, secrets, quarantine, or unrelated worktrees
- broad identity refactor beyond list filtering and focused tests

Hard stops:
- any required frontend change
- any required touch to Antigravity/tooling work
- any ambiguity about unrelated dirty state
- any need to broaden into RBAC enforcement on commercial endpoints without explicit authorization

Expected validation:
- backend-focused quality checks
- focused identity tests
- `git diff --check`
- PR CI green before merge
- `main` CI green after merge
- cleanup of the task worktree/branch after merge
## Frontend Catch-Up Status

### Current state

Status:
- frontend is behind merged backend commercial foundations

Largest gaps:
- returns handling activation
- breakage/loss activation
- stock movement ledger activation
- auth / role-aware UX
- customer and billing surfaces

Constraint:
- frontend catch-up remains a separate workstream and must not be folded into backend
  bundles without explicit authorization

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

## Queue Update Rule

Update this document when one of these changes occurs:

- the active task changes
- the next frontend task changes
- a task is merged and the queue advances
- a repair track becomes necessary
- the required standard wrappers or gates change
