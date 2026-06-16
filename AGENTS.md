# Agent instructions - Hahitantsoa / Titan ERP

This file is the concise, authoritative workflow for every AI agent working in this
repository. Detailed agent roles, templates, and quality gates live in
[`docs/ai-agents/`](docs/ai-agents/README.md).

Use these two documents as the standard operational references for future tasks:

- [`docs/ai-agents/agent-command-runbook.md`](docs/ai-agents/agent-command-runbook.md)
- [`docs/ai-agents/agent-profiles.md`](docs/ai-agents/agent-profiles.md)
- [`docs/ai-agents/orchestrator-task-queue.md`](docs/ai-agents/orchestrator-task-queue.md)
- [`docs/ai-agents/cross-agent-compatibility.md`](docs/ai-agents/cross-agent-compatibility.md)

Task prompts should stay short and reference these documents instead of copying large
command blocks or queue state into every prompt.

Backend orchestration prompts must follow
[`docs/ai-agents/prompt-contracts/backend-orchestrator.md`](docs/ai-agents/prompt-contracts/backend-orchestrator.md).
They must reference the runbook, task queue, backend Agent A-F template, official
wrappers when applicable, medium-bundle policy, and hard stop conditions.

## Sources of truth

Apply the following priority when instructions conflict:

1. Accepted decisions in `docs/decisions/`.
2. Accepted ADRs in `docs/adr/`.
3. Approved source references in `docs/references/source/`.
4. Business rules in `docs/business-rules/`.
5. Architecture documentation.
6. The approved task scope.

Never weaken a higher-priority rule to satisfy a lower-priority request.

## Business boundaries

- Titan is pure rental and accepts only `material`, `article`, and `material_pack`.
- Titan must never expose `venue`, `local`, `room`, `hall`, `service`,
  `event_service`, ancillary services, or event services.
- Hahitantsoa is distinct from Titan and may cover the complete event domain.
- Shared inventory rules must not collapse the Hahitantsoa/Titan boundary.
- Reservation confirmation requires signed contract, received deposit, successful
  availability revalidation, explicit backend authorization, durable attribution,
  transaction-safe audit, and transactional conflict protection.

## Official multi-agent workflow

The official system is defined in [`docs/ai-agents/README.md`](docs/ai-agents/README.md).
No other agent roster or prompt collection is authoritative.

- Use Codex and Codex subagents only.
- Use native Codex subagents when available.
- If native Codex subagents are unavailable, execute the same roles sequentially in
  Codex.
- Review agents inspect and report; they do not silently modify files.
- Valid findings are fixed by the implementer within the approved scope.
- The human remains the final merge authority.

Required backend roles are selected from Agent A through Agent F in
[`backend-agent-template.md`](docs/ai-agents/backend-agent-template.md).
Required frontend roles are selected from Agent FE-A through Agent FE-F in
[`frontend-agent-template.md`](docs/ai-agents/frontend-agent-template.md).

For backend orchestration:

- the orchestrator assigns only relevant agents
- Agent A implements
- Agent B reviews independently
- Agents C, D, E, and F are used only when relevant
- reporting alone is not a stopping condition
- after merge and green `main` CI, continue to the next clear backend bundle unless a
  hard stop condition occurs

## Worktree matrix

One agent equals one worktree equals one branch equals one non-overlapping scope.

- `backend` agent: backend worktree, one backend branch, `backend/`, `tests/backend/`,
  and backend audits only.
- `frontend` agent: frontend worktree, one frontend branch, `frontend/` and frontend
  audits only.
- `agent-tools` agent: agent-tools worktree, one agent-tools branch,
  `scripts/dev/`, `compose.agent-ci.yaml`, and F138 agent-tools audit files only.
- `agent-docs` agent: agent-docs worktree, one docs branch, `docs/ai-agents/` and docs
  audits only.
- future `business-rules` agent: business-documentation worktree, one docs branch,
  business docs only.
- review agent: non-mutating by default and may edit only when the task explicitly
  authorizes review-side changes.

Never modify another active worktree. Never put two agents on the same files. Never mix
backend, frontend, agent-tools, and agent-docs edits in the same task branch.

## Mandatory task workflow

- The orchestrator assigns an explicit agent profile before delegating a task.
- Every executable agent task starts with `bash scripts/dev/erp-agent-task-start` inside
  `scripts/dev/erp-logged-run`.
- Live baseline wins over stale static docs; report any mismatch.
- One task, one branch, one controlled PR.
- Verify branch, baseline commit, and Git status before editing.
- Keep the diff limited to explicitly allowed files and behavior.
- Do not broaden scope without human approval.
- Run relevant local checks before push.
- Review the final diff before commit.
- Open the PR only when authorized.
- CI must pass before merge.
- Validate `main` after merge.
- Confirm CI on `main` after merge.
- Clean local task and review branches after merge when the human authorizes cleanup.
- Never merge automatically.

Every task prompt must state:

- baseline and expected branch;
- objective and approved scope;
- allowed and forbidden files or areas;
- required agent roles;
- required tests and quality gates;
- PR body and final report requirements;
- whether commit, push, and PR creation are authorized.

Use [`docs/ai-agents/task-prompt-template.md`](docs/ai-agents/task-prompt-template.md).

Prompts should reference the runbook and task queue instead of repeating all standard
commands, stop conditions, and CI follow-up instructions inline.

Use the applicable orchestrator contract for the task:

- backend orchestration: `docs/ai-agents/prompt-contracts/backend-orchestrator.md`
- frontend orchestration: `docs/ai-agents/prompt-contracts/frontend-orchestrator.md`
- Antigravity or tooling orchestration: the applicable docs in `docs/ai-agents/tooling/`

Keep backend, frontend, and Antigravity/tooling orchestration separate. Backend agents
must not fix frontend. Frontend agents must not mutate backend unless an explicit API
contract mismatch authorization allows the minimum required cross-boundary change.

## Terminal and environment rules

Run every important terminal command through the logged heredoc workflow:

```sh
scripts/dev/erp-logged-run task-name <<'EOF'
commands
EOF
```

- Do not use `scripts/dev/erp-logged-run task-name bash -c '...'`.
- Use `.venv/bin/python`, `.venv/bin/pytest`, or Docker Compose instead of bare
  `python`.
- Never read, display, source, inspect, copy, or modify `.env` or secrets.
- Never touch secrets, tokens, private keys, or secret-like files.
- Never commit generated junk, logs, caches, or `__pycache__`.
- If an important command is accidentally run outside the wrapper, immediately run a
  logged recovery check and report the incident.

The standard operational command set is defined in
[`docs/ai-agents/agent-command-runbook.md`](docs/ai-agents/agent-command-runbook.md).
The standard task ordering and current queue are defined in
[`docs/ai-agents/orchestrator-task-queue.md`](docs/ai-agents/orchestrator-task-queue.md).
Repo-scoped Codex accelerators may live under
[`/.agents/skills/`](.agents/skills), but they are optional helpers and never replace the
canonical workflow docs above.
Cross-agent tool bridges live in `docs/ai-agents/tooling/` and remain concise entry points, not replacement authorities.

After merge of F138B/F138C on `main`, these official wrappers are required when
applicable:

- `scripts/dev/erp-backend-compose-ci`
- `scripts/dev/erp-agent-scope-guard`
- `scripts/dev/erp-worktree-preflight`

OpenClaw is decommissioned from the active Hahitantsoa/Titan ERP workflow.

- Do not create, modify, resync, commit, push, merge, or rely on OpenClaw sandbox
  output for this project.
- Historical OpenClaw references may remain only in past audit records or task evidence;
  they are not workflow authority.

## Engineering rules

- Put business writes and state transitions in explicit services.
- Put complex reads in selectors.
- Keep backend authorization authoritative; frontend visibility is not security.
- Sensitive writes require explicit authorization, durable attribution, and audit.
- Use `transaction.atomic()` and locking where concurrent writes can conflict.
- Use `transaction.on_commit()` for success effects that must not survive rollback.
- Do not invent endpoints, payloads, roles, models, migrations, or workflows outside
  the approved task.
- Do not duplicate backend business rules in the frontend beyond UI validation.
- Protect private documents and never expose permanent public URLs for sensitive files.

## Quality gates

Apply the relevant gates in
[`docs/ai-agents/pr-quality-gates.md`](docs/ai-agents/pr-quality-gates.md):

- scope and forbidden-file verification;
- focused tests;
- Django check and migration verification when applicable;
- transaction, authorization, security, and data-integrity review when applicable;
- Ruff format/check for Python;
- TypeScript, lint/build, tests, accessibility, and UI-state review for frontend;
- `git diff --check`;
- independent review findings and resolutions;
- CI result before merge;
- post-merge `main` validation.

PR CI must be green before merge. `main` CI must be green after merge. Human merge
control remains mandatory unless a task explicitly authorizes otherwise.

## Continuous improvement

After each PR, record durable lessons when useful: mistakes, false positives, missed
tests, unclear scope, repeated environment failures, and new guardrails. Improve the
relevant official agent document later in a separate small PR. See
[`skill-improvement-loop.md`](docs/ai-agents/skill-improvement-loop.md).
