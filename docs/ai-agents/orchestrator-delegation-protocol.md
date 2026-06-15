# Orchestrator Delegation Protocol

## Purpose

The orchestrator delegates only bounded micro-tasks. Each delegation packet must be
short, reference the official docs, and define one mutable scope.

The orchestrator must assign one explicit agent profile from
[`agent-profiles.md`](agent-profiles.md) before assigning a task.

The orchestrator must not assume current state from static docs alone. A live baseline
wins over stale docs and must be referenced when state-sensitive delegation decisions are
made.

For Codex tasks, the orchestrator may additionally request explicit invocation of an
approved repo-scoped skill under [`.agents/skills/`](../../.agents/skills) when that helps
the agent follow the bounded repo workflow more reliably.

## Common delegation packet

Every delegated micro-task should include:

- micro-task ID and parent macro-goal
- assigned agent profile
- worktree and branch
- task-start baseline expectation
- scope allowed and scope forbidden
- files or docs to read first
- required scripts and validations
- required report format
- explicit stop conditions

## Minimal prompt structure

```text
You are <agent role>.

Assigned profile:
<profile from docs/ai-agents/agent-profiles.md>

Authorized worktree only:
<path>

Branch:
<branch>

Mission:
Execute micro-task <task-id> from <macro-goal-id>.

Read first:
- docs/ai-agents/agent-command-runbook.md
- docs/ai-agents/<relevant contract or plan>.md
- docs/ai-agents/task-queue-schema.md

Task-start baseline:
- executable agents run `bash scripts/dev/erp-agent-task-start` inside `scripts/dev/erp-logged-run` as the first command
- plan-only agents propose that baseline and wait

Use:
- scripts/dev/<required helper>

Stop if:
- forbidden scope appears
- .env or secret-like path appears
- another live task owns the same mutable file
- the contract is ambiguous

Final report:
- branch
- commit
- files changed
- validations
- findings or blockers
- PR URL if opened
```

## Backend agent delegation

- goal contract: backend prompt contract plus the active macro-goal contract
- files to read: runbook, backend prompt contract, backend completion plan, queue item,
  recovery playbooks when WIP repair is involved
- scripts to use: `erp-worktree-preflight backend`,
  `erp-agent-scope-guard backend`, `erp-backend-compose-ci`
- report format: branch, commit, backend checks, PR URL, reviewer findings, residual
  risks
- stop rules: stop if frontend changes are required, if backend WIP repair exceeds the
  approved task, or if private API scope broadens

## Frontend agent delegation

- goal contract: frontend prompt contract plus the active macro-goal contract
- files to read: runbook, frontend prompt contract, frontend completion plan, queue item
- scripts to use: `erp-worktree-preflight frontend`,
  `erp-agent-scope-guard frontend`
- report format: branch, commit, tests, build, PR URL, integration risks
- stop rules: stop if backend API is unavailable, if a new endpoint must be invented, or
  if `frontend/dist/` changes

## Docs agent delegation

- goal contract: docs-agent prompt contract plus the active macro-goal contract
- profile: usually `codex-native-wsl-mutating` for mutating docs work, or
  `antigravity-review-docs` / `opencode-web-wsl-review` for review/docs-only work
- files to read: runbook, queue item, relevant workflow docs, shared index ownership
  rules
- scripts to use: `erp-worktree-preflight agent-tools` only when a docs task also owns
  script wrappers; otherwise plain status and diff checks are enough
- report format: files changed, validation commands, references updated, open questions
- stop rules: stop if a shared index file is already owned by another live task

## Tools agent delegation

- goal contract: tools-agent prompt contract plus the active macro-goal contract
- files to read: runbook, queue item, security policy, recovery playbooks, relevant
  audits
- scripts to use: `erp-worktree-preflight agent-tools`,
  `erp-agent-scope-guard agent-tools`
- report format: files changed, syntax checks, dry runs, PR URL, operational limits
- stop rules: stop if backend or frontend source edits would be required

## Review agent delegation

- goal contract: review-agent prompt contract
- profile: `antigravity-review-docs`, `opencode-web-wsl-review`,
  `opencode-desktop-windows-plan-only`, or `windows-hosted-agent-plan-only`
- files to read: diff, PR context, queue item, review template
- scripts to use: non-mutating checks only
- report format: findings first, verdict, residual risks, no edits performed
- stop rules: stop if asked to mutate files or if evidence is missing

## Business-rules agent delegation

- goal contract: relevant macro-goal contract plus business-rule references
- files to read: queue item, domain-specific docs, audits, contracts
- scripts to use: usually none beyond non-mutating validation
- report format: rule clarifications, ambiguities, decisions, downstream impacts
- stop rules: stop if implementation changes are requested or source evidence is absent

## Shared stop rules

All delegated agents stop immediately when:

- `.env` or secret-like paths appear in status
- forbidden files appear in scope
- a live PR or live task already owns the same mutable files
- recovery would require destructive cleanup
- CI failures point outside the approved task
