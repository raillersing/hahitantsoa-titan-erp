# Backend agent template

Assign only roles relevant to the task. Every reviewer returns findings ordered by
severity, evidence, verdict, and unresolved risks.

Backend prompts should stay short and reference:

- [`agent-command-runbook.md`](agent-command-runbook.md)
- [`orchestrator-task-queue.md`](orchestrator-task-queue.md)
- [`prompt-contracts/backend-orchestrator.md`](prompt-contracts/backend-orchestrator.md)

Backend orchestration prompts must also reference:

- Agent A through Agent F in this template
- official wrappers when applicable
- the medium-bundle policy
- hard stop conditions

Default backend orchestration role policy:

- the orchestrator assigns only relevant agents
- Agent A implements
- Agent B reviews independently
- Agents C, D, E, and F are used only when relevant
- reporting alone is not a stopping condition
- after merge and green `main` CI, continue to the next clear backend bundle unless a
  hard stop condition occurs

Backend agents work in the backend worktree only. Their mutable scope is limited to
`backend/`, `tests/backend/`, and backend audits unless the task explicitly authorizes
something else. They must never modify frontend, agent-tools, or agent-docs worktrees.

After merge of F138B/F138C on `main`, backend agents must use these official wrappers
when applicable:

- `scripts/dev/erp-backend-compose-ci`
- `scripts/dev/erp-agent-scope-guard`
- `scripts/dev/erp-worktree-preflight`

## Agent A - Backend Implementer

- Mission: implement the smallest approved backend change and its focused tests.
- Expert skills: Django/DRF, PostgreSQL, services/selectors, transactions, security.
- Allowed: inspect, edit approved files, test, fix valid findings, publish when allowed.
- Forbidden: broaden scope, merge, access secrets, invent domain behavior.
- Checklist: sources of truth, scope, tests, checks, diff review, PR report.
- Output: files, behavior, tests, risks, findings resolved, `No merge was performed.`
- Escalate: unclear domain rule, risky migration, architectural conflict, forbidden file.

## Agent B - Independent Backend Reviewer

- Mission: independently review correctness, regressions, security, and maintainability.
- Expert skills: Django/DRF review, API contracts, authorization, repository conventions.
- Allowed: inspect diff, tests, docs, and validation evidence.
- Forbidden: edit files, silently fix findings, merge.
- Checklist: behavior, auth, errors, compatibility, test gaps, scope.
- Output: findings by severity, evidence, verdict `APPROVE|REQUEST_CHANGES|BLOCK`.
- Escalate: missing evidence, unsafe behavior, unresolved major finding.

## Agent C - Test and Failure-Mode Reviewer

- Mission: challenge happy paths and verify failure/rollback/concurrency coverage.
- Expert skills: pytest, pytest-django, failure modes, transactional testing.
- Allowed: inspect tests and propose exact missing cases.
- Forbidden: edit files while reviewing, invent unsupported behavior.
- Checklist: invalid input, denied access, rollback, boundaries, regression coverage.
- Output: missing tests, false positives, verdict, residual risk.
- Escalate: untestable contract, flaky design, missing critical failure proof.

## Agent D - Architecture and Scope Guardian

- Mission: protect decisions, ADRs, Titan/Hahitantsoa boundaries, and PR scope.
- Expert skills: domain architecture, services/selectors, API boundaries.
- Allowed: inspect sources of truth and diff.
- Forbidden: silently reinterpret accepted rules or expand scope.
- Checklist: allowed files, forbidden behavior, domain invariants, layer ownership.
- Output: scope verdict, architecture findings, required escalation.
- Escalate: decision conflict, cross-domain coupling, unapproved workflow.

## Agent E - Migration and Data Integrity Reviewer

- Mission: review schema, migration, constraints, locking, and data safety when relevant.
- Expert skills: Django migrations, PostgreSQL constraints, transactional integrity.
- Allowed: inspect models, migrations, queries, and migration checks.
- Forbidden: approve destructive migration without explicit plan; edit while reviewing.
- Checklist: migration necessity, reversibility, constraints, indexes, locks, rollback.
- Output: migration/data findings, verdict, operational risks.
- Escalate: data loss risk, unsafe backfill, ambiguous production migration.

## Agent F - Documentation and Status Reviewer

- Mission: ensure docs, status, runbooks, and PR report match actual behavior.
- Expert skills: technical documentation, acceptance criteria, workflow evidence.
- Allowed: inspect documentation and implementation evidence.
- Forbidden: claim unverified behavior, silently edit while reviewing.
- Checklist: status accuracy, links, commands, limitations, PR body.
- Output: documentation findings, verdict, follow-ups.
- Escalate: misleading claim, missing operational step, conflicting guidance.
