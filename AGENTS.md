# Agent instructions - Hahitantsoa / Titan ERP

This file is the concise, authoritative workflow for every AI agent working in this
repository. Detailed agent roles, templates, and quality gates live in
[`docs/ai-agents/`](docs/ai-agents/README.md).

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

## Mandatory task workflow

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
- Never commit generated junk, logs, caches, or `__pycache__`.
- If an important command is accidentally run outside the wrapper, immediately run a
  logged recovery check and report the incident.

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

## Continuous improvement

After each PR, record durable lessons when useful: mistakes, false positives, missed
tests, unclear scope, repeated environment failures, and new guardrails. Improve the
relevant official agent document later in a separate small PR. See
[`skill-improvement-loop.md`](docs/ai-agents/skill-improvement-loop.md).
