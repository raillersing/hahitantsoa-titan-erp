# Official AI agent workflow

This directory is the only official detailed agent system for Hahitantsoa/Titan ERP.
`AGENTS.md` remains the concise source of truth.

## Execution model

The active project workflow uses Codex and Codex subagents only. Use native Codex
subagents when available. Assign only the roles needed by the task and give each role a
bounded inspection or implementation scope. If native Codex subagents are unavailable,
execute the same roles sequentially in Codex.

OpenClaw is decommissioned from this project workflow. Do not create, modify, resync,
commit, push, merge, or rely on OpenClaw sandbox output. Historical OpenClaw references
may remain only in past audit records or task evidence and are not workflow authority.

Reviewers never apply silent corrections. They return findings with severity, evidence,
and a verdict. The implementer fixes valid findings inside the approved scope before
commit. The human decides merge.

When native subagents are unavailable, simulate the required workflow sequentially:

1. Agent A or Agent FE-A implements.
2. Agent B or Agent FE-B performs an independent review.
3. Agent C or Agent FE-D reviews tests and failure modes.
4. Agent D or Agent FE-F checks architecture and scope.
5. Agent E checks migrations and data integrity when relevant.
6. Agent F checks documentation and status.
7. The implementer fixes valid findings inside the approved scope.
8. The final report lists findings, resolutions, validations, and residual risks.

## Official roles

Backend roles:

- Agent A - Backend Implementer
- Agent B - Independent Backend Reviewer
- Agent C - Test and Failure-Mode Reviewer
- Agent D - Architecture and Scope Guardian
- Agent E - Migration and Data Integrity Reviewer
- Agent F - Documentation and Status Reviewer

Frontend roles:

- Agent FE-A - Frontend Implementer
- Agent FE-B - UI/UX Reviewer
- Agent FE-C - Accessibility Reviewer
- Agent FE-D - Frontend Test Reviewer
- Agent FE-E - API Contract Integration Reviewer
- Agent FE-F - Frontend Scope Guardian

## Required documents

- [AI orchestration index](AI_ORCHESTRATION_INDEX.md)
- [Agent command runbook](agent-command-runbook.md)
- [Backend agent template](backend-agent-template.md)
- [Autonomous agent policy](autonomous-agent-policy.md)
- [New conversation starters](NEW_CONVERSATION_STARTERS.md)
- [Frontend agent template](frontend-agent-template.md)
- [GitHub repository rules checklist](github-repository-rules-checklist.md)
- [Macro-goal contract](macro-goal-contract.md)
- [Macro-goal orchestrator](macro-goal-orchestrator.md)
- [Orchestrator action ledger](orchestrator-action-ledger.md)
- [Orchestrator delegation protocol](orchestrator-delegation-protocol.md)
- [Orchestrator state](orchestrator-state.md)
- [Pursue Goal contract](pursue-goal-contract.md)
- [Recovery playbooks](recovery-playbooks.md)
- [Worktree registry](worktree-registry.md)
- [Orchestrator task queue](orchestrator-task-queue.md)
- [Task queue schema](task-queue-schema.md)
- [Parallel agent policy](parallel-agent-policy.md)
- [PR quality gates](pr-quality-gates.md)
- [Review agent template](review-agent-template.md)
- [Secret handling policy](secret-handling-policy.md)
- [Task prompt template](task-prompt-template.md)
- [Prompt contracts](prompt-contracts/backend-orchestrator.md)
- [Macro-goal backend completion plan](macro-goals/backend-completion-plan.md)
- [Macro-goal frontend completion plan](macro-goals/frontend-completion-plan.md)
- [Prototype-to-production roadmap](macro-goals/prototype-to-production-roadmap.md)
- [Skill improvement loop](skill-improvement-loop.md)
- [Application cartography](../architecture/application-map/README.md) — point d'entrée obligatoire avant toute tâche d'implémentation
- [Graphify knowledge graph](tooling/graphify.md) — consultation order: cartography → Graphify → raw search

## Worktree and prompt policy

One agent equals one worktree equals one branch equals one non-overlapping scope.

- backend agent: backend worktree, `backend/`, `tests/backend/`, backend audits
- frontend agent: frontend worktree, `frontend/`, frontend audits
- agent-tools agent: agent-tools worktree, `scripts/dev/`, `compose.agent-ci.yaml`,
  F138 agent-tools audit files
- agent-ci agent: dedicated CI worktree, canonical `.github/workflows/ci.yml`, exact
  CI/finalization helpers, and directly related agent-governance documents
- agent-docs agent: agent-docs worktree, `docs/ai-agents/`, docs audits
- future business-rules agent: business docs only
- review agent: non-mutating unless explicitly authorized

Prompts should stay short and reference the
[AI orchestration index](AI_ORCHESTRATION_INDEX.md),
[Agent command runbook](agent-command-runbook.md),
[Macro-goal orchestrator](macro-goal-orchestrator.md),
[Task queue schema](task-queue-schema.md), and the applicable prompt contract instead of
repeating all standard commands and queue state inline.

For backend orchestration, the canonical prompt contract is
[prompt-contracts/backend-orchestrator.md](prompt-contracts/backend-orchestrator.md). It
defines the required references to the runbook, queue, backend agent template, official
wrappers, medium-bundle policy, hard stop conditions, relevant-agent assignment, and the
rule that reporting alone is not a stopping condition.

For frontend orchestration, the canonical prompt contract is
[prompt-contracts/frontend-orchestrator.md](prompt-contracts/frontend-orchestrator.md).
It defines the required references to the runbook, queue, frontend agent template,
official wrappers, hard stop conditions, relevant-agent assignment, cross-boundary
backend/frontend limits, and the rule that reporting alone is not a stopping condition.

Antigravity or tooling orchestration is separate from backend and frontend
orchestration. Use the applicable docs in `docs/ai-agents/tooling/` instead of reusing
backend or frontend prompt contracts for tooling-only work.

## Minimum flow

1. Verify baseline, branch, status, scope, and forbidden files.
1b. Consult knowledge graph: cartography → Graphify report → raw search (see AGENTS.md).
2. Select required roles in the task prompt.
3. Implement the approved scope.
4. Run focused checks and inspect the diff.
5. Run independent reviewer roles.
6. Fix valid findings without broadening scope.
7. Commit, push, and open a PR only when authorized.
8. Verify CI before human merge.
9. Validate `main` and confirm CI on `main` after merge.
10. Clean local task and review branches after merge when the human authorizes cleanup.
11. Capture durable workflow improvements in a later small PR.

After merge of F138B/F138C on `main`, these wrappers are official and required when
applicable:

- `scripts/dev/erp-backend-compose-ci`
- `scripts/dev/erp-agent-scope-guard`
- `scripts/dev/erp-worktree-preflight`

## Replaced guidance

F121E-0 replaces the previous competing Codex, two-agent, orchestrator, Aider/Gemini,
and F113 workflow definitions. Git history remains the recovery source; obsolete
definitions are not archived in the working tree.

Task-specific audits and roadmap records may retain historical agent labels as evidence.
Those labels are not reusable workflow policy and do not override this directory.
