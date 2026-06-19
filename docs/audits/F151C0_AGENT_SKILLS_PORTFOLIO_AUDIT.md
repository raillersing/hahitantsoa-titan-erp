# F151C-0 — Agent Skills Portfolio Audit & Rationalization Plan

## Executive Summary

This audit inventories all 18 agent skills across `.agents/skills/` (10 skills) and `.opencode/skills/` (8 skills), classifies each with a decision, and produces a rationalization plan. The current portfolio has three structural problems:

1. **Naming inconsistency** — 3 skills use the `hahitantsoa-erp-*` prefix, 7 use bare names, 8 use `frontend-*` prefix. No uniform convention.
2. **Duplicate responsibilities** — 2 pre-F151B Codex skills (`hahitantsoa-erp-backend-validation`, `hahitantsoa-erp-pr-lifecycle`) are functionally superseded by F151B skills.
3. **Location fragmentation** — 8 frontend skills live in `.opencode/skills/` but contain no OpenCode-specific logic. They should be promoted to `.agents/skills/` for cross-agent access (Codex, Claude Code, OpenCode).

**Key numbers:**
- **KEEP**: 8 skills
- **MERGE+DELETE**: 2 skills
- **PROMOTE** (move + rename): 8 skills
- **DELETE** (superseded): 2 skills
- **MISSING** (proposed ADD): 5 skills
- **Final target**: 16 skills across 3 groups (onboarding, backend, frontend) under `erp-*` naming convention, all in `.agents/skills/`

## 1. Current Skill Inventory

### 1.1 `.agents/skills/` — 10 skills

| # | Skill directory | Lines | Origin | Content summary |
|---|----------------|-------|--------|-----------------|
| 1 | `hahitantsoa-erp-task-start` | 32 | Pre-F151B Codex | Integrated task-start baseline, profile confirmation, worktree/scope stop conditions |
| 2 | `hahitantsoa-erp-backend-validation` | 22 | Pre-F151B Codex | Backend validation through wrappers (`erp-backend-compose-ci`, `backend-quality`) |
| 3 | `hahitantsoa-erp-pr-lifecycle` | 29 | Pre-F151B Codex | Full PR lifecycle: commit, push, PR, CI wait, squash merge, main CI, cleanup |
| 4 | `backend-quality-gates` | 35 | F151B | Pre-commit quality verification for backend PRs (Ruff, pytest, Django check, migrations) |
| 5 | `backend-agent-roles` | 65 | F151B | Role-specific checklists for backend agents A–F |
| 6 | `backend-ci-workflow` | 39 | F151B | CI wait, merge, and post-merge validation procedure |
| 7 | `worktree-discipline` | 31 | F151B | One-agent-one-worktree rules |
| 8 | `secret-handling` | 44 | F151B | Never-read-.env and log hygiene rules |
| 9 | `business-boundaries` | 31 | F151B | Titan vs Hahitantsoa domain rules |
| 10 | `post-merge-cleanup` | 40 | F151B | Branch/worktree/Docker cleanup procedure |

### 1.2 `.opencode/skills/` — 8 skills

| # | Skill directory | Lines | Origin | Content summary |
|---|----------------|-------|--------|-----------------|
| 11 | `frontend-scope-guard` | 23 | F150A | Frontend scope enforcement: approved files, no backend drift, business boundary |
| 12 | `frontend-api-contracts` | 25 | F150A | API call correctness: method, path, payload, auth, error handling |
| 13 | `frontend-testing` | 24 | F150A | Vitest + RTL component test checklist |
| 14 | `react-typescript-quality` | 27 | F150A | TypeScript strictness, React patterns, code quality |
| 15 | `frontend-accessibility-ux` | 27 | F150A | WCAG AA, keyboard navigation, semantic HTML, UX consistency |
| 16 | `frontend-error-recovery` | 25 | F150A | Error boundary patterns, graceful degradation, user-facing errors |
| 17 | `frontend-performance-maintainability` | 27 | F150A | Render performance, bundle hygiene, code maintainability |
| 18 | `frontend-state-forms` | 25 | F150A | Form handling, validation, data fetching, state management |

## 2. Skill-by-Skill Decision Table

| # | Current name | Decision | Target name | Rationale |
|---|-------------|----------|-------------|-----------|
| 1 | `hahitantsoa-erp-task-start` | **RENAME** | `erp-task-start` | Unique content (baseline execution flow). Rename for naming consistency. |
| 2 | `hahitantsoa-erp-backend-validation` | **DELETE** | — | Functionally superseded by `erp-quality-gates` + `erp-ci-workflow`. Content is duplicated. |
| 3 | `hahitantsoa-erp-pr-lifecycle` | **DELETE** | — | Functionally superseded by `erp-ci-workflow` + `erp-post-merge-cleanup`. Content is duplicated. |
| 4 | `backend-quality-gates` | **RENAME** | `erp-quality-gates` | Keep content. Rename for naming consistency. |
| 5 | `backend-agent-roles` | **RENAME** | `erp-agent-roles` | Keep content. Rename for naming consistency. |
| 6 | `backend-ci-workflow` | **RENAME** | `erp-ci-workflow` | Keep content. Rename for naming consistency. |
| 7 | `worktree-discipline` | **RENAME** | `erp-worktree-discipline` | Keep content. Rename for naming consistency. |
| 8 | `secret-handling` | **RENAME** | `erp-secret-handling` | Keep content. Rename for naming consistency. |
| 9 | `business-boundaries` | **RENAME** | `erp-business-boundaries` | Keep content. Rename for naming consistency. |
| 10 | `post-merge-cleanup` | **RENAME** | `erp-post-merge-cleanup` | Keep content. Rename for naming consistency. |
| 11 | `frontend-scope-guard` | **PROMOTE + RENAME** | `erp-frontend-scope-guard` | Move to `.agents/skills/`. Useful for all agents, not OpenCode-specific. |
| 12 | `frontend-api-contracts` | **PROMOTE + RENAME** | `erp-frontend-api-contracts` | Move to `.agents/skills/`. Generic API contract patterns. |
| 13 | `frontend-testing` | **PROMOTE + RENAME** | `erp-frontend-testing` | Move to `.agents/skills/`. Generic test patterns. |
| 14 | `react-typescript-quality` | **PROMOTE + RENAME** | `erp-frontend-quality` | Move to `.agents/skills/`. Rename to match group convention. |
| 15 | `frontend-accessibility-ux` | **PROMOTE + RENAME** | `erp-frontend-accessibility` | Move to `.agents/skills/`. Generic a11y patterns. |
| 16 | `frontend-error-recovery` | **PROMOTE + RENAME** | `erp-frontend-error-recovery` | Move to `.agents/skills/`. Generic error handling. |
| 17 | `frontend-performance-maintainability` | **PROMOTE + RENAME** | `erp-frontend-performance` | Move to `.agents/skills/`. Generic perf patterns. |
| 18 | `frontend-state-forms` | **PROMOTE + RENAME** | `erp-frontend-state-forms` | Move to `.agents/skills/`. Generic form patterns. |

### Rationale for DELETE decisions

**`hahitantsoa-erp-backend-validation`** (lines 12-16):
- "Use `scripts/dev/erp-backend-compose-ci` for Compose-backed backend commands" — covered by `erp-ci-workflow`
- "Use `scripts/ci/backend-quality` for the standard backend quality gate" — covered by `erp-quality-gates`
- "Do not use host Python for backend Django tests or checks" — covered by `erp-quality-gates`
- "Stop if validation would require `.env`" — covered by `erp-secret-handling`
- All content is duplicated across F151B skills. No unique items.

**`hahitantsoa-erp-pr-lifecycle`** (lines 12-23):
- "Commit only allowed tracked files" — covered by `erp-quality-gates` (diff review)
- "Push branch and open PR" — covered by `erp-ci-workflow` (PR creation)
- "Wait for required PR checks" — covered by `erp-ci-workflow` (pre-merge CI)
- "Squash merge from root" — covered by `erp-ci-workflow` (merge)
- "Sync main, identify SHA-bound CI" — covered by `erp-ci-workflow` (post-merge CI)
- "Remove worktree and branch" — covered by `erp-post-merge-cleanup`
- All content is duplicated. No unique items.

### Rationale for PROMOTE decisions

All 8 frontend skills contain only generic frontend engineering patterns (WCAG, React Testing Library, TypeScript, form patterns, error boundaries, render performance). None reference OpenCode-specific APIs, commands, or configuration. The "When to use me" sections reference project agent roles (FE-A, FE-B) which are defined in `frontend-agent-template.md` — these are project roles, not OpenCode features.

OpenCode reads skills from both `.opencode/skills/` and `.agents/skills/`. Codex reads from `.agents/skills/` only. Promoting these skills to `.agents/skills/` makes them available to Codex agents (primarily the orchestrator, Agent FE-A, Agent FE-B) without duplication.

## 3. Redundant or Overlapping Skills

### Overlap 1: `hahitantsoa-erp-backend-validation` vs F151B skills

| Area | Old skill | New skill(s) | Verdict |
|------|-----------|--------------|---------|
| Wrapper usage | Lines 12-14 | `erp-quality-gates` checklist | Duplicate |
| Secret handling | Line 16 | `erp-secret-handling` checklist | Duplicate |
| Scope stopping | Line 17 | `erp-worktree-discipline` checklist | Duplicate |
| Reference links | Lines 19-22 | `erp-quality-gates` references | Duplicate |

**Action:** DELETE `hahitantsoa-erp-backend-validation`.

### Overlap 2: `hahitantsoa-erp-pr-lifecycle` vs F151B skills

| Area | Old skill | New skill(s) | Verdict |
|------|-----------|--------------|---------|
| Commit workflow | Line 12 | `erp-quality-gates` | Duplicate |
| PR creation | Lines 13-14 | `erp-ci-workflow` | Duplicate |
| CI wait | Line 15 | `erp-ci-workflow` | Duplicate |
| Merge | Line 18-19 | `erp-ci-workflow` | Duplicate |
| Main CI validation | Line 22 | `erp-ci-workflow` | Duplicate |
| Cleanup | Line 23 | `erp-post-merge-cleanup` | Duplicate |
| Reference links | Lines 27-29 | Various F151B skills | Duplicate |

**Action:** DELETE `hahitantsoa-erp-pr-lifecycle`.

### Overlap 3: `frontend-scope-guard` vs `worktree-discipline` vs `business-boundaries`

- `frontend-scope-guard` checks: frontend files only, no backend drift, Titan boundary, no invented APIs, no npm deps, no secrets
- `worktree-discipline` checks: correct worktree, correct branch, no mixed agent scopes
- `business-boundaries` checks: Titan/Hahitantsoa domain rules

These are complementary, not duplicate. The frontend scope guard focuses on frontend-specific scope rules that would not apply to a backend agent. **No action needed.**

### Overlap 4: `frontend-api-contracts` vs `erp-quality-gates`

- `frontend-api-contracts` checks: HTTP method, URL path, credentials, payload, error handling — all from the frontend side
- `erp-quality-gates` checks: Ruff, pytest, Django check, migrations, authorization — all from the backend side

These are complementary (frontend-side vs backend-side of the same contract). **No action needed.**

### Summary of duplicates

| Skill | Status | Replaced by |
|-------|--------|-------------|
| `hahitantsoa-erp-backend-validation` | DELETE | `erp-quality-gates` + `erp-ci-workflow` + `erp-secret-handling` |
| `hahitantsoa-erp-pr-lifecycle` | DELETE | `erp-ci-workflow` + `erp-post-merge-cleanup` |

## 4. Missing Skills

### Critical gaps (recommended for immediate ADD)

| Missing skill | Purpose | Source material | Priority |
|---------------|---------|----------------|----------|
| `erp-migration-safety` | Migration necessity, reversibility, constraints, indexes, locking, rollback checklist for Model/data changes | `backend-agent-template.md` Agent E section | HIGH |
| `erp-security-review` | Authorization, permission checks, data isolation, input validation for security-sensitive changes | `backend-agent-template.md` Agent B section, `AGENTS.md` engineering rules | HIGH |
| `erp-agent-role-assignment` | Which agent roles to assign per task type (backend, frontend, docs, review) — quick reference for orchestrators | `README.md` official roles, `backend-agent-template.md`, `frontend-agent-template.md` default role policy | MEDIUM |
| `erp-api-contracts` | API contract design, review, and cross-boundary change protocol — both backend and frontend sides | `pr-quality-gates.md`, `frontend-agent-template.md` Agent FE-E section | MEDIUM |
| `erp-scope-guard-setup` | Scope guard profiles, troubleshooting, and when to run — quick reference for all agents | `scripts/dev/erp-agent-scope-guard` | MEDIUM |

### Lower-priority gaps (future consideration)

| Missing skill | Purpose | Priority |
|---------------|---------|----------|
| `erp-docs-review` | Documentation accuracy, links, commands, and PR report review checklist | LOW |
| `erp-docker-cleanup` | Docker cleanup patterns, volume preservation, dry-run vs apply | LOW |
| `erp-billing-payment` | Billing/invoice/payment workflow rules and review checklist | LOW |
| `erp-audit-events` | Audit event requirements, attribution, transaction-safe audit patterns | LOW |
| `erp-permissions-model` | Permission/authorization model reference for the ERP | LOW |

## 5. Frontend Skill Promotion Recommendation

### Decision: PROMOTE all 8 frontend skills to `.agents/skills/`

**Reasoning:**
1. All 8 skills contain generic frontend engineering content — no OpenCode-specific APIs, commands, or configuration.
2. The project orchestrator (Codex) needs these skills for frontend tasks. Codex reads from `.agents/skills/`.
3. OpenCode reads from both locations, so promoted skills remain accessible to OpenCode.
4. Keeping them in `.opencode/skills/` creates a two-location maintenance burden and potential drift.
5. The `frontend-specialist-skills.md` usage guide in `docs/ai-agents/tooling/` already documents these as project skills, not OpenCode features.

**Which skills should remain OpenCode-only:** NONE. All 8 are generic enough to benefit Codex agents.

**Migration approach:** Copy each SKILL.md to `.agents/skills/erp-frontend-{name}/SKILL.md`, update references, delete from `.opencode/skills/`. Each skill's "When to use me" section references project agent roles (FE-A, FE-B) which remain correct in the new location.

**Edge case — OpenCode-specific `skill` command:** OpenCode's `skill` tool works with both directories. After promotion, OpenCode users would load `erp-frontend-testing` instead of `frontend-testing`. The usage guide and any orchestrator prompts referencing the old names must be updated.

### Frontend skill rename mapping

| Current name | New name |
|-------------|----------|
| `frontend-scope-guard` | `erp-frontend-scope-guard` |
| `frontend-api-contracts` | `erp-frontend-api-contracts` |
| `frontend-testing` | `erp-frontend-testing` |
| `react-typescript-quality` | `erp-frontend-quality` |
| `frontend-accessibility-ux` | `erp-frontend-accessibility` |
| `frontend-error-recovery` | `erp-frontend-error-recovery` |
| `frontend-performance-maintainability` | `erp-frontend-performance` |
| `frontend-state-forms` | `erp-frontend-state-forms` |

## 6. Token/Context Impact Analysis

### Current state: 18 skills

| Location | Count | Est. token size | Total tokens |
|----------|-------|-----------------|--------------|
| `.agents/skills/` — Pre-F151B | 3 | ~200 each | ~600 |
| `.agents/skills/` — F151B | 7 | ~350 each | ~2,450 |
| `.opencode/skills/` — F150A | 8 | ~250 each | ~2,000 |
| **Total** | **18** | | **~5,050** |

### Proposed target: 16 skills (8 KEEP + 8 PROMOTE after 2 DELETEs)

| Group | Count | Est. token size | Total tokens |
|-------|-------|-----------------|--------------|
| Onboarding (`erp-task-start`) | 1 | ~250 | ~250 |
| Backend (`erp-*-gates`, `erp-*-roles`, etc.) | 6 | ~350 each | ~2,100 |
| Frontend (`erp-frontend-*`) | 8 | ~250 each | ~2,000 |
| Missing (proposed, not yet created) | 5 | ~300 each | ~1,500 |
| **Current total** | **16** | | **~4,350** |
| **With proposed additions** | **21** | | **~5,850** |

### On-demand loading effect

The token cost is only incurred when a skill is loaded. A typical task loads 1-3 skills at most:
- Backend PR: `erp-quality-gates` + `erp-ci-workflow` + `erp-secret-handling` ≈ 1,050 tokens
- Frontend PR: `erp-frontend-scope-guard` + `erp-frontend-testing` ≈ 500 tokens
- Onboarding: `erp-task-start` + `erp-worktree-discipline` ≈ 500 tokens

Maximum simultaneous load (orchestrator slotting N sub-agents): ~1,500 tokens — well within context budgets.

### Risk: over-loading

If all 16 skills are loaded at session start (anti-pattern), the context cost is ~4,350 tokens. This is acceptable for a full repository context but wasteful. Mitigation: usage guide explicitly states "load on demand" rule.

## 7. Governance/Security Risks

### Risk 1: Stale skill content

After the F151B consolidation, 2 old skills (`hahitantsoa-erp-backend-validation`, `hahitantsoa-erp-pr-lifecycle`) contain instructions that are functionally duplicated but not identical. An agent loading the old skill may get outdated command patterns or miss new requirements.

**Severity:** Medium. **Mitigation:** DELETE these skills in the first implementation bundle.

### Risk 2: Naming collision

If 2 skills in different directories have the same name or conflicting descriptions, agent behavior becomes unpredictable. Currently no collision exists, but the `hahitantsoa-erp-*` prefix in `.agents/skills/` could be confused with similarly-named variables or scripts in `scripts/dev/`.

**Severity:** Low. **Mitigation:** Adopt `erp-*` prefix consistently across all skills.

### Risk 3: Skill discovery gap

Agents may not know which skills exist or when to load them. Currently, skills have no central index beyond `agent-shared-skills.md` (which omits 3 pre-F151B and 8 frontend skills).

**Severity:** Medium. **Mitigation:** Update `agent-shared-skills.md` to list ALL skills after the migration is complete.

### Risk 4: Cross-agent compatibility

OpenCode's skill loading behavior may differ from Codex's. If OpenCode uses a different resolution order for `.agents/skills/` vs `.opencode/skills/`, promoting skills could change behavior.

**Severity:** Low. **Mitigation:** Test by loading a promoted skill name in OpenCode after migration.

### Risk 5: PR #306 is open and unrelated

PR #306 exists in open/draft state. The implementation plan must avoid touching its branch or worktree.

**Severity:** Low. **Mitigation:** Enumerate active worktrees and branches before each implementation bundle.

## 8. Final Target Architecture

```
.agents/skills/                          # Shared skills — Codex, Claude Code, OpenCode
├── erp-task-start/                      # Onboarding: task-start baseline execution
├── erp-quality-gates/                   # Backend: pre-commit quality verification
├── erp-agent-roles/                     # Backend: role-specific checklists A–F
├── erp-ci-workflow/                     # Backend: CI wait, merge, post-merge validation
├── erp-worktree-discipline/             # Cross-agent: one-agent-one-worktree rules
├── erp-secret-handling/                 # Cross-agent: never-read-.env rules
├── erp-business-boundaries/             # Cross-agent: Titan/Hahitantsoa domain rules
├── erp-post-merge-cleanup/              # Cross-agent: branch/worktree/Docker cleanup
├── erp-frontend-scope-guard/            # Frontend: scope enforcement (PROMOTED)
├── erp-frontend-api-contracts/          # Frontend: API contract verification (PROMOTED)
├── erp-frontend-testing/                # Frontend: Vitest + RTL test checklist (PROMOTED)
├── erp-frontend-quality/                # Frontend: TypeScript/React quality (PROMOTED)
├── erp-frontend-accessibility/          # Frontend: WCAG/UX fundamentals (PROMOTED)
├── erp-frontend-error-recovery/         # Frontend: error boundary patterns (PROMOTED)
├── erp-frontend-performance/            # Frontend: render perf, bundle hygiene (PROMOTED)
└── erp-frontend-state-forms/            # Frontend: form/state management (PROMOTED)

.opencode/skills/                        # OpenCode-only skills (EMPTY after migration)
```

### Key architecture rules

1. **Single source of truth** — all skills under `.agents/skills/`. `.opencode/skills/` is cleared after migration.
2. **Consistent naming** — all skills prefixed with `erp-*` for the project. No `hahitantsoa-erp-*` or bare names.
3. **Three groups** — onboarding (1), backend/cross-agent (7), frontend (8).
4. **Load on demand** — skills are checklists, not instruction manuals. Agents load only what the current task phase needs.
5. **Canonical docs win** — every skill links to its source document. Source documents remain authoritative.

## 9. Follow-Up Implementation Plan

### Bundle 1: Naming + Cleanup (agent-tools + agent-docs PR)

Scope:
- RENAME all 10 `.agents/skills/` skills to `erp-*` prefix (move directories)
- DELETE `hahitantsoa-erp-backend-validation` and `hahitantsoa-erp-pr-lifecycle`
- Update `agent-shared-skills.md` to list all renamed skills

Allowed files:
- `.agents/skills/` (rename directories, delete old)
- `docs/ai-agents/tooling/agent-shared-skills.md`

Validation:
- `bash scripts/dev/erp-agent-scope-guard agent-docs`
- Confirm no backend/frontend/test/.github/.env mutations
- Confirm skills still loadable by name

### Bundle 2: Frontend Promotion (agent-docs PR)

Scope:
- Copy all 8 frontend skills from `.opencode/skills/` to `.agents/skills/` with `erp-frontend-*` names
- Update reference links in each promoted skill to point to canonical docs
- Delete originals from `.opencode/skills/`
- Update `agent-shared-skills.md` and `frontend-specialist-skills.md`

Allowed files:
- `.agents/skills/` (create new skill dirs)
- `.opencode/skills/` (delete old skill dirs)
- `docs/ai-agents/tooling/agent-shared-skills.md`
- `docs/ai-agents/tooling/frontend-specialist-skills.md`

Validation:
- `bash scripts/dev/erp-agent-scope-guard agent-docs`
- Confirm skills loadable by new name in OpenCode

### Bundle 3: Missing Skills (agent-docs PR)

Scope:
- Create `erp-migration-safety`, `erp-security-review`, `erp-agent-role-assignment`
- Optionally create `erp-api-contracts`, `erp-scope-guard-setup`
- Update `agent-shared-skills.md`

Allowed files:
- `.agents/skills/` (create new skill dirs)
- `docs/ai-agents/tooling/agent-shared-skills.md`

Validation:
- `bash scripts/dev/erp-agent-scope-guard agent-docs`
- Each skill references its canonical source document

### Hard Stops

- Do not touch PR #306 branch/worktree
- Do not touch F147F or F150B worktrees
- Do not modify backend/frontend application code
- Do not read .env or secrets
- Each bundle must have green CI before merge
- Each bundle must have green main CI after merge
- Human merge remains mandatory

## 10. References

- `.agents/skills/` — 10 current skills
- `.opencode/skills/` — 8 current skills
- `docs/ai-agents/tooling/agent-shared-skills.md` — current usage guide
- `docs/ai-agents/tooling/frontend-specialist-skills.md` — frontend skill docs
- `docs/audits/F151A0_AGENT_WORKFLOW_SKILLS_READINESS_REVIEW.md` — prior audit
- `docs/ai-agents/backend-agent-template.md` — backend roles
- `docs/ai-agents/frontend-agent-template.md` — frontend roles
- `docs/ai-agents/agent-command-runbook.md` — standard commands
- `docs/ai-agents/pr-quality-gates.md` — quality gates
- `docs/ai-agents/secret-handling-policy.md` — secret rules
- `AGENTS.md` — concise workflow authority
- `scripts/dev/erp-agent-scope-guard` — scope enforcement
