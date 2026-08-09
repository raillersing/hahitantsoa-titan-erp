---
name: erp-agent-role-assignment
description: Select the minimum relevant Titan ERP roles after classifying a task as audit, diagnosis, implementation, review, cleanup, or monitoring. Use while planning delegation; do not turn a report or review into implementation.
---

# ERP Agent Role Assignment

Classify the task before assigning a role. The requested outcome, not the number
of available agents, determines whether any implementation role is needed.

## Classify first

| Task type | Default owner | Change authority |
|---|---|---|
| Audit or report | Independent reviewer | Read-only; state evidence and unknowns |
| Diagnosis | Reviewer or domain specialist | Read-only unless a fix is explicitly authorized |
| Implementation | Implementer and independent reviewer | Only the approved scope and worktree |
| Review | Independent reviewer | Report-only unless review-side changes are explicitly authorized |
| Cleanup | Cleanup owner | Only exact, authorized targets after classification |
| Monitoring or waiting | Observer | No state change |

Do not assign an implementer because a reviewer found a problem. Record the
finding and wait for explicit authorization when the original task is audit,
diagnosis, review, or monitoring.

## Implementation roles

Assign roles only for an explicitly authorized implementation lot.

### Backend

| Role | Assign when |
|---|---|
| Agent A — Implementer | A backend change is authorized |
| Agent B — Reviewer | Any backend implementation lot; review independently |
| Agent C — Test Reviewer | Failure modes or test strategy need independent scrutiny |
| Agent D — Scope Guardian | Boundaries or architecture choices are material |
| Agent E — Migration Reviewer | Models, migrations, or data integrity change |
| Agent F — Documentation Reviewer | Durable docs, status, or PR evidence change |

### Frontend

| Role | Assign when |
|---|---|
| Agent FE-A — Implementer | A frontend change is authorized |
| Agent FE-B — Fidelity and interaction reviewer | An approved source, print layout, responsive state, or workflow must be preserved |
| Agent FE-C — Accessibility Reviewer | Interaction or visual changes need accessibility review |
| Agent FE-D — Test Reviewer | Journey, visual, or component evidence needs independent scrutiny |
| Agent FE-E — API Contract Reviewer | A real API contract is introduced or changed |
| Agent FE-F — Scope Guardian | Business boundaries or validated UI preservation are material |

Docs and tooling work use an explicitly assigned owner and a proportionate,
independent review. Do not label them Agent A/FE-A by default: their worktree
and allowed paths determine the correct assignment.

## Assignment constraints

- One agent, one worktree, one branch, one non-overlapping scope.
- Select the minimum roles that can prove the approved outcome; unused roles are
  not a quality signal.
- A reviewer inspects and reports; an implementer fixes valid findings in the
  approved scope.
- A new bundle requires its own authorization. Green CI does not authorize a
  new task or a merge.

## Source

- [Backend Agent Template](../../../docs/ai-agents/backend-agent-template.md)
- [Frontend Agent Template](../../../docs/ai-agents/frontend-agent-template.md)
- [AGENTS.md — Official multi-agent workflow](../../../AGENTS.md#official-multi-agent-workflow)
