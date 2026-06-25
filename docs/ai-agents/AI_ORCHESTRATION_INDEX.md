# AI Orchestration Index

## Purpose

Use this index to route a new AI conversation to the correct repository workflow without
inventing a parallel prompt system.

Prompts should stay short. They should reference the canonical runbook, task queue, and
the correct contract/template pair instead of embedding long command blocks.

## Canonical Baseline

Every executable workflow starts from:

- `AGENTS.md` (includes knowledge graph consultation order)
- `docs/ai-agents/agent-command-runbook.md`
- `docs/ai-agents/orchestrator-task-queue.md`
- `docs/ai-agents/tooling/graphify.md` (Graphify knowledge graph pilot)

## Task Routing

### Backend work

Use this route when the task changes backend behavior, backend tests, backend API
contracts, migrations, selectors, services, or backend audits explicitly tied to the
implementation.

- prompt contract:
  `docs/ai-agents/prompt-contracts/backend-orchestrator.md`
- agent template:
  `docs/ai-agents/backend-agent-template.md`
- required wrappers when applicable:
  - `scripts/dev/erp-backend-compose-ci`
  - `scripts/dev/erp-agent-scope-guard`
  - `scripts/dev/erp-worktree-preflight`
- key policy:
  - medium backend bundles only
  - Agent A implements
  - Agent B reviews independently
  - Agents C/D/E/F only when relevant
  - reporting alone is not a stopping condition
  - after merge and green `main` CI, continue to the next clear backend bundle unless a
    hard stop condition occurs

### Frontend work

Use this route when the task changes React/TypeScript UI behavior, frontend tests,
frontend audits, or frontend/API integration behavior that stays within an approved
backend contract.

- prompt contract:
  `docs/ai-agents/prompt-contracts/frontend-orchestrator.md`
- agent template:
  `docs/ai-agents/frontend-agent-template.md`
- required wrappers when applicable:
  - `scripts/dev/erp-agent-scope-guard`
  - `scripts/dev/erp-worktree-preflight`
- key policy:
  - Agent FE-A implements
  - Agent FE-B/FE-C/FE-D/FE-E/FE-F only when relevant
  - frontend agents must not mutate backend unless an explicit API contract mismatch
    authorization allows the minimum required cross-boundary fix
  - reporting alone is not a stopping condition
  - after merge and green `main` CI, continue to the next clear frontend bundle unless a
    hard stop condition occurs

### Antigravity or tooling work

Use this route when the task is docs/tools governance, adapter governance, workflow
policy, orchestration validation, or approved tooling-only work.

- primary governance docs:
  - `docs/ai-agents/tooling/antigravity-workflow.md`
  - `docs/ai-agents/tooling/antigravity-orchestration-capability-model.md`
  - `docs/ai-agents/tooling/antigravity-windows-wsl-adapter.md`
- supporting contract docs:
  - `docs/ai-agents/prompt-contracts/agent-prompt-procedure.md`
  - `docs/ai-agents/task-prompt-template.md`
- approved modes are defined by the assigned profile
- do not reuse backend or frontend orchestrator contracts for tooling-only work

### OpenCode work

Use this route only for the approved OpenCode profiles and environment modes already
documented in the repository.

- primary governance docs:
  - `docs/ai-agents/tooling/opencode-workflow.md`
  - `docs/ai-agents/tooling/graphify.md` — knowledge graph consultation order
  - `docs/ai-agents/cross-agent-compatibility.md`
  - `docs/ai-agents/agent-profiles.md`
  - `docs/ai-agents/prompt-contracts/agent-prompt-procedure.md`
- repo instruction bundle:
  - `AGENTS.md`
  - `docs/ai-agents/agent-command-runbook.md`
  - `docs/ai-agents/orchestrator-task-queue.md`
- compatibility status:
  - OpenCode Web / WSL-backed mode: compatible for repository-instruction reading and
    task classification in bounded review/docs governance smoke coverage
  - OpenCode Desktop Windows: not confirmed for mutation; plan-only only

## Boundary Rules

- backend work must not fix frontend unless the task explicitly authorizes the minimum
  required cross-boundary API contract repair
- frontend work must not mutate backend unless the task explicitly authorizes the
  minimum required cross-boundary API contract repair
- tooling governance work must not drift into backend or frontend feature delivery
- OpenCode Desktop Windows remains plan-only unless a future accepted profile promotes it

## Starter Prompts

Official short starter prompts live in:

- `docs/ai-agents/NEW_CONVERSATION_STARTERS.md`

Use those starters as entry points for new conversations instead of copying large prompt
blocks by hand.
