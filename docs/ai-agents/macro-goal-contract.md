# Macro-Goal Contract

## Template

Use this contract before creating a multi-step task queue.

```text
Macro-goal ID:
<stable identifier>

Goal statement:
<high-level outcome>

Domain:
<backend|frontend|docs|tools|business>

Allowed agent types:
<backend agent, frontend agent, docs agent, tools agent, review agent, business-rules agent>

Initial context documents:
<required docs to read before planning>

Output expected:
<queue, plan, audits, PRs, merged state, final report>

Planning depth:
<audit-only, coarse queue, detailed queue>

Task size limits:
<max mutable scope and expected PR size>

Maximum autonomy level:
<allowed level from autonomous-agent-policy.md>

Required approval gates:
<review-only gate, PR gate, main CI gate, human merge>

Stop conditions:
<scope drift, contract ambiguity, secrets, blocked CI, worktree conflict>

Done definition:
<when the macro-goal is complete>
```

## Example - MG-BACKEND-FINALIZATION

- Macro-goal ID: `MG-BACKEND-FINALIZATION`
- Goal statement: finalize the backend through a validated sequence of bounded backend
  micro-tasks
- Domain: `backend`
- Allowed agent types: backend agent, review agent, docs agent
- Initial context documents: `orchestrator-state.md`, `orchestrator-task-queue.md`,
  `macro-goals/backend-completion-plan.md`, `recovery-playbooks.md`
- Output expected: validated backend micro-task queue plus implementation PRs
- Planning depth: coarse queue first, then detailed queue per backend slice
- Task size limits: one backend slice per branch, no unverified bulk rewrite
- Maximum autonomy level: `Level 1` until review-only gate is complete for each slice
- Required approval gates: review-only, PR CI green, human merge, main CI green
- Stop conditions: backend scope expansion, hidden dependency on frontend changes,
  repeated failing repair cycles
- Done definition: active backend queue reaches `done` or documented blocked state

## Example - MG-FRONTEND-FINALIZATION

- Macro-goal ID: `MG-FRONTEND-FINALIZATION`
- Goal statement: finalize the frontend through bounded UI and integration micro-tasks
- Domain: `frontend`
- Allowed agent types: frontend agent, review agent, docs agent
- Initial context documents: `orchestrator-state.md`, `orchestrator-task-queue.md`,
  `macro-goals/frontend-completion-plan.md`, `parallel-agent-policy.md`
- Output expected: validated frontend micro-task queue plus implementation PRs
- Planning depth: coarse queue first, detailed queue after backend contract audit
- Task size limits: one UI or integration slice per branch
- Maximum autonomy level: `Level 1` until review-only gate is complete for each slice
- Required approval gates: review-only, PR CI green, human merge, main CI green
- Stop conditions: missing backend contract, endpoint ambiguity, scope overlap
- Done definition: queued frontend tasks reach `done` or explicit blocked state

## Example - MG-RESERVATIONS-MODULE

- Macro-goal ID: `MG-RESERVATIONS-MODULE`
- Goal statement: finish the reservations module end to end without crossing into
  unrelated domains
- Domain: `business`
- Allowed agent types: backend agent, frontend agent, review agent, business-rules
  agent
- Initial context documents: backend and frontend completion plans, runbook, prompt
  contracts, business rules references
- Output expected: synchronized backend and frontend queues plus review evidence
- Planning depth: audit current state, then sequence backend before dependent frontend
- Task size limits: one backend slice or one frontend slice per task
- Maximum autonomy level: `Level 1`
- Required approval gates: review-only on code slices, PR CI green, human merge
- Stop conditions: unclear business rules, contract conflicts, overlapping mutable globs
- Done definition: reservation flow slices are merged and `main` CI is green

## Example - MG-DOCUMENTS-MODULE

- Macro-goal ID: `MG-DOCUMENTS-MODULE`
- Goal statement: finish the document-related workflow and supporting orchestration docs
- Domain: `docs`
- Allowed agent types: docs agent, frontend agent, review agent
- Initial context documents: task queue, frontend completion plan, agent runbook
- Output expected: docs queue and any approved frontend follow-up references
- Planning depth: detailed queue if scope is docs-only; coarse queue otherwise
- Task size limits: one bounded docs area per task
- Maximum autonomy level: `Level 2` for docs-only work, `Level 1` when frontend is
  involved
- Required approval gates: docs review or frontend review as applicable, PR CI green
- Stop conditions: ownership conflict on shared index files, hidden backend dependency
- Done definition: scoped docs tasks complete and linked code dependencies are either
  done or explicitly deferred
