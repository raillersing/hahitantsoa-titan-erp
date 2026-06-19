# F151A-0 — Agent Workflow & Skills Readiness Review

## Purpose

This audit inventories the current agent governance files, wrappers, and existing
skills, identifies which repeated procedures are good skill candidates versus which
must remain in docs or wrappers, checks scope-guard compatibility for `.agents/skills/`,
and recommends a minimal first skill set for F151B implementation.

## Current State

- **Main HEAD:** `cd8a9a4`
- **Main CI:** Green
- **Main status:** Clean
- **Active worktrees:** 14 (main + 13 draft-PR worktrees)
- **Paused worktrees:** F147F (`...-f147f-antigravity-frontend`) — must not be touched
- **Active Codex worktree:** F150B (not listed in current worktrees — assumed active per task context)
- **Open PRs:** 6 (PR #294 non-draft, PRs #295–#299 draft)

## 1. Current Agent Governance Inventory

### Core Workflow Files

| File | Lines | Role |
|------|-------|------|
| `AGENTS.md` | 218 | Concise workflow authority — sources of truth, business boundaries, worktree matrix, mandatory task workflow, quality gates |
| `CLAUDE.md` | 115 | Claude Code WSL-native instructions — references AGENTS.md, adds Claude-specific rules |
| `.github/copilot-instructions.md` | 58 | Copilot instructions — references AGENTS.md and docs/ai-agents/ |
| `docs/ai-agents/README.md` | 144 | Official agent system overview — execution model, roles, required documents, minimum flow |
| `docs/ai-agents/backend-agent-template.md` | 98 | Agent A–F role definitions with missions, checklists, outputs, escalation rules |
| `docs/ai-agents/frontend-agent-template.md` | 94 | Agent FE-A–FE-F role definitions with missions, checklists, outputs, escalation rules |
| `docs/ai-agents/prompt-contracts/backend-orchestrator.md` | 148 | Backend orchestration contract — required references, inputs, scope, stop conditions, medium-bundle policy |
| `docs/ai-agents/prompt-contracts/frontend-orchestrator.md` | 142 | Frontend orchestration contract — required references, inputs, scope, stop conditions, agent assignment |
| `docs/ai-agents/agent-command-runbook.md` | 747 | Standard command patterns — task-start, backend/frontend commands, Docker cleanup, PR/CI commands, cleanup, forbidden commands |
| `docs/ai-agents/orchestrator-task-queue.md` | 575 | Task queue state — current HEAD, open PRs, backend/frontend status, governance queue, validation policy |

### OpenCode-Specific Files

| File | Lines | Role |
|------|-------|------|
| `opencode.json` | 159 | OpenCode project config — instructions, agents, commands, permissions |
| `.opencode/agents/backend-orchestrator.md` | 28 | Backend orchestration adapter |
| `.opencode/agents/frontend-orchestrator.md` | 28 | Frontend orchestration adapter |
| `.opencode/agents/docs-agent.md` | — | Docs/audit adapter |
| `.opencode/agents/review-agent.md` | — | Review adapter |
| `.opencode/commands/` | 3 files | task-start, worktree-preflight, pr-create command templates |
| `.opencode/skills/` | 8 files | F150A frontend specialist skills (see below) |

### Claude Code-Specific Files

| File | Lines | Role |
|------|-------|------|
| `CLAUDE.md` | 115 | Claude Code instructions |
| `.claude/settings.json` | — | Claude Code project settings (hooks deferred) |
| `docs/ai-agents/tooling/claude-code-orchestration.md` | 114 | Claude Code orchestration bridge |

### Existing Skills (F150A)

| Skill | Purpose |
|-------|---------|
| `frontend-scope-guard` | Verify frontend changes stay in approved scope |
| `react-typescript-quality` | TypeScript strictness and React patterns |
| `frontend-api-contracts` | API call correctness against backend contracts |
| `frontend-testing` | Vitest + RTL test quality |
| `frontend-accessibility-ux` | WCAG and UX consistency |
| `frontend-error-recovery` | Graceful error handling |
| `frontend-state-forms` | Form and state management |
| `frontend-performance-maintainability` | Render perf and code hygiene |

### Wrappers (scripts/dev/)

| Wrapper | Purpose |
|---------|---------|
| `erp-logged-run` | Command logging with heredoc stdin |
| `erp-agent-task-start` | Integrated task-start baseline |
| `erp-agent-scope-guard` | Scope enforcement per agent profile |
| `erp-worktree-preflight` | Worktree validation |
| `erp-backend-compose-ci` | Backend Docker Compose CI |
| `erp-pr-worktree-finalize` | PR finalization from task worktree |
| `erp-pr-finalize-from-root` | PR finalization from root worktree |
| `erp-docker-agent-cleanup` | Docker container/network cleanup |
| `erp-quality-check` | Quality gate runner |
| `erp-frontend-quality` | Frontend quality wrapper |
| `erp-task-queue-validate` | Task queue schema validation |
| `erp-orchestrator-state-check` | Live state check |
| `erp-worktree-list-validated` | Validated worktree listing |
| `erp-worktree-clean-after-merge` | Safe worktree cleanup |
| `erp-agent-profile-validate` | Agent profile validation |
| `erp-secret-scan-local` | Local secret scanning |
| `erp-github-repo-rules-audit` | GitHub repo rules audit |

## 2. Skill Candidates vs Must-Stay-in-Docs

### Good Skill Candidates (repeated, checklist-driven, load-on-demand)

| Candidate | Source | Why a skill |
|-----------|--------|-------------|
| Backend quality gates | `pr-quality-gates.md`, `backend-agent-template.md` Agent A checklist | Repeated per PR; checklist-driven; agents need it on-demand |
| Frontend quality gates | `pr-quality-gates.md`, `frontend-quality-workflow.md` | Repeated per PR; checklist-driven |
| CI workflow | `agent-command-runbook.md` CI Wait Policy section | Repeated per PR; procedural checklist |
| Post-merge cleanup | `agent-command-runbook.md` Post-Merge Cleanup section | Repeated per merge; procedural |
| Worktree discipline | `AGENTS.md` Worktree Matrix section | Repeated per task; rules-driven |
| Secret handling | `secret-handling-policy.md`, `AGENTS.md` | Repeated per task; safety-critical |
| Business boundaries | `AGENTS.md` Business Boundaries section | Repeated per task; domain-critical |
| Agent role checklists | `backend-agent-template.md`, `frontend-agent-template.md` | Each agent has a checklist; load-on-demand per role |
| PR quality gates | `pr-quality-gates.md` | Repeated per PR; checklist-driven |

### Must Stay in Docs or Wrappers (not skill candidates)

| Item | Why not a skill |
|------|-----------------|
| `erp-logged-run` heredoc pattern | Must be executed, not read — stays in runbook |
| Wrapper scripts (`scripts/dev/*`) | Executable code — stays as scripts |
| Task queue state | Live data — stays in `orchestrator-task-queue.md` |
| Agent role definitions | Structural definitions — stays in templates |
| Prompt contracts | Contractual documents — stays as contracts |
| Sources of truth hierarchy | Foundational rule — stays in `AGENTS.md` |
| Engineering rules | Foundational rules — stays in `AGENTS.md` |
| Worktree matrix | Structural mapping — stays in `AGENTS.md` |
| Forbidden commands | Safety rules — stays in runbook |
| CI wait policy (SHA-bound validation) | Procedural with live data — stays in runbook |
| Medium-bundle policy | Orchestration rule — stays in contract |

## 3. Scope Guard Compatibility for `.agents/skills/`

The `agent-docs` profile in `scripts/dev/erp-agent-scope-guard` currently allows:

```
^(docs/ai-agents/|docs/audits/|opencode\.json$|\.opencode/|CLAUDE\.md$|\.claude/)
```

`.agents/skills/` is **not** in the allowed list. The scope guard would block any PR
that adds files under `.agents/skills/` when run with the `agent-docs` profile.

**Required follow-up:** Before F151B can add `.agents/skills/`, the scope guard must
be updated to include `.agents/skills/` in the `agent-docs` allowed pattern. This is
a small, safe change — adding one path prefix to the regex.

The updated pattern would become:

```
^(docs/ai-agents/|docs/audits/|opencode\.json$|\.opencode/|\.agents/skills/|CLAUDE\.md$|\.claude/)
```

This change should be made in a dedicated agent-tools PR (since it modifies
`scripts/dev/erp-agent-scope-guard`), not in the agent-docs PR that adds the skills.

## 4. Recommended Minimal First Skill Set (F151B)

### Priority 1 — Backend Agent Skills

| Skill | Source material | Purpose |
|-------|----------------|---------|
| `backend-quality-gates` | `pr-quality-gates.md`, Agent A checklist | Pre-commit quality verification for backend PRs |
| `backend-agent-roles` | `backend-agent-template.md` Agent A–F checklists | Role-specific checklists for each backend agent |
| `backend-ci-workflow` | `agent-command-runbook.md` CI sections | CI wait, merge, and post-merge validation procedure |

### Priority 2 — Shared Cross-Agent Skills

| Skill | Source material | Purpose |
|-------|----------------|---------|
| `worktree-discipline` | `AGENTS.md` Worktree Matrix | One-agent-one-worktree rules |
| `secret-handling` | `secret-handling-policy.md` | Never-read-.env rules |
| `business-boundaries` | `AGENTS.md` Business Boundaries | Titan vs Hahitantsoa domain rules |
| `post-merge-cleanup` | `agent-command-runbook.md` Cleanup section | Branch/worktree/Docker cleanup procedure |

### Priority 3 — Frontend Agent Skills (already exist in `.opencode/skills/`)

The 8 F150A frontend specialist skills already cover the frontend agent workflow.
These can be mirrored or symlinked to `.agents/skills/` for Codex/Claude Code access,
or kept in `.opencode/skills/` for OpenCode-only use.

## 5. Where Skills Should Live

| Location | Agent access | Recommendation |
|----------|-------------|----------------|
| `.opencode/skills/` | OpenCode only | Keep F150A frontend skills here |
| `.agents/skills/` | Codex, Claude Code, OpenCode (all) | Add F151B shared skills here |
| `.claude/skills/` | Claude Code only | Not needed — use `.agents/skills/` for cross-agent |

**Recommendation:** Place F151B shared skills in `.agents/skills/` for maximum
cross-agent compatibility. OpenCode reads `.agents/skills/` per its skill discovery
rules. Codex and Claude Code also support this location. This avoids duplication
across `.opencode/skills/`, `.claude/skills/`, and `.agents/skills/`.

The existing F150A frontend skills in `.opencode/skills/` can remain there for
OpenCode-specific use, or be migrated to `.agents/skills/` in a later PR if
cross-agent access is desired.

## 6. Token/Context Impact Analysis

### Expected Savings

| Scenario | Without skills | With skills | Savings |
|----------|---------------|-------------|---------|
| Backend PR quality check | ~200 tokens embedded in prompt | ~30 tokens to load skill + ~500 tokens skill content | Net: +330 tokens one-time, but reusable across sessions |
| Agent role assignment | ~150 tokens per role checklist in prompt | ~30 tokens to load skill | Net: -120 tokens per role |
| CI workflow reminder | ~100 tokens in prompt | ~30 tokens to load skill | Net: -70 tokens |
| Post-merge cleanup | ~80 tokens in prompt | ~30 tokens to load skill | Net: -50 tokens |

### Risks

1. **Over-loading:** If an agent loads all skills at session start, context grows by
   ~4,000 tokens (8 skills × ~500 tokens). Mitigation: skills should be loaded
   on-demand, only when relevant to the current task phase.
2. **Staleness:** Skills may drift from canonical docs if not updated together.
   Mitigation: each skill must reference its source document; the source document
   remains authoritative.
3. **Discovery gap:** Agents must know skills exist to load them. Mitigation: the
   `skill` tool lists available skills; orchestrator prompts should mention which
   skills are relevant.

### When Skills May Increase Context

- Loading a skill for a one-time check that could be stated in 1-2 lines
- Loading multiple skills when only one checklist item is relevant
- Loading skills that duplicate content already in the agent's system prompt

## 7. F151B Implementation Plan

### Phase 1 — Scope Guard Update (agent-tools PR)

- Update `scripts/dev/erp-agent-scope-guard` to add `.agents/skills/` to the
  `agent-docs` allowed pattern
- This is a prerequisite — F151B skill files cannot pass scope guard without it

### Phase 2 — Backend Agent Skills (agent-docs PR)

- Create `.agents/skills/backend-quality-gates/SKILL.md`
- Create `.agents/skills/backend-agent-roles/SKILL.md`
- Create `.agents/skills/backend-ci-workflow/SKILL.md`
- Add `docs/ai-agents/tooling/agent-shared-skills.md` usage guide

### Phase 3 — Cross-Agent Skills (agent-docs PR)

- Create `.agents/skills/worktree-discipline/SKILL.md`
- Create `.agents/skills/secret-handling/SKILL.md`
- Create `.agents/skills/business-boundaries/SKILL.md`
- Create `.agents/skills/post-merge-cleanup/SKILL.md`
- Update usage guide

### Phase 4 — Optional: Migrate F150A Skills

- Move or symlink F150A frontend skills from `.opencode/skills/` to `.agents/skills/`
  for cross-agent access
- Update `docs/ai-agents/tooling/frontend-specialist-skills.md` to reflect new location

### Hard Stops for F151B

- Do not touch F147F or F150B worktrees
- Do not modify backend/frontend application code
- Do not modify wrapper scripts (except scope guard in Phase 1)
- Do not rewrite AGENTS.md or existing agent governance
- Do not expose secrets or .env
- Each skill must reference its canonical source document
- Skills must be model-agnostic

## Validation

- `bash scripts/dev/erp-agent-scope-guard agent-docs` — PASS (this audit only touches
  `docs/audits/` and `docs/ai-agents/`)
- `git diff --check` — to be run before commit
- No backend/frontend/test/.github/.env/dependency manifest mutations

## References

- `AGENTS.md` — concise workflow authority
- `CLAUDE.md` — Claude Code instructions
- `docs/ai-agents/README.md` — official agent system
- `docs/ai-agents/backend-agent-template.md` — Agent A–F roles
- `docs/ai-agents/frontend-agent-template.md` — Agent FE-A–FE-F roles
- `docs/ai-agents/prompt-contracts/backend-orchestrator.md` — backend contract
- `docs/ai-agents/prompt-contracts/frontend-orchestrator.md` — frontend contract
- `docs/ai-agents/agent-command-runbook.md` — standard commands
- `docs/ai-agents/orchestrator-task-queue.md` — task queue
- `opencode.json` — OpenCode config
- `scripts/dev/erp-agent-scope-guard` — scope enforcement
- `scripts/dev/erp-pr-worktree-finalize` — PR finalization
- `scripts/dev/erp-docker-agent-cleanup` — Docker cleanup
- [OpenCode Skills Documentation](https://opencode.ai/docs/skills/)
