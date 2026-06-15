# PR quality gates

Apply gates proportionally to the touched scope. Record exact commands and results in
the PR body.

Use the standard command patterns in
[`agent-command-runbook.md`](agent-command-runbook.md) and keep prompts short by
referencing the current task state in
[`orchestrator-task-queue.md`](orchestrator-task-queue.md).

## Universal gates

- Baseline commit and dedicated branch verified.
- Integrated task-start baseline executed first for executable agents, or explicitly proposed
  and awaited for plan-only agents.
- Agent profile contract validation passes when agent profiles or delegation entry points
  change: `bash scripts/dev/erp-agent-profile-validate`.
- Repo-scoped skill additions or updates remain docs/tools-governance scope and still
  require green PR CI before merge plus green `main` CI after merge.
- Cross-agent workflow bridge or config changes require `bash scripts/dev/erp-agent-profile-validate`
  and must not broaden into backend or frontend source mutation.
- Changed files match approved scope; forbidden files are untouched.
- No `.env`, secrets, logs, caches, generated junk, or `__pycache__`.
- Important commands ran through `scripts/dev/erp-logged-run` heredoc workflow.
- Focused tests or documentation checks pass when applicable.
- `git diff --check` passes.
- All scripts under `scripts/dev/` that were created or modified have the executable bit set.
- CI wait policy followed: pre-merge CI green confirmed before merge; post-merge `main` CI
  green confirmed after merge.
- Root-only finalization policy followed: merge from the main-root worktree only, never
  from a temporary task worktree.
- Independent review findings are resolved or explicitly escalated.
- PR targets `main`; automatic merge is forbidden.
- Required CI passes before human merge.
- `main` is validated after merge.
- `main` CI is green after merge.
- Human merge remains mandatory unless explicitly authorized.
- When Codex is explicitly authorized to merge, it must use
  `scripts/dev/erp-pr-finalize-from-root` or an equivalent logged root-`main` command.
- PR check status validation: required checks are verified via `gh pr checks` first. If required checks are missing or unconfigured, statusCheckRollup is checked to ensure both `Backend quality` and `Frontend quality` are `SUCCESS`.
- JSON processing inside helper tools must never call external `jq`. All processing must be handled via `gh --json --jq`.
- Root finalization reports are invalid unless they include the real, synchronous completed `erp-logged-run` terminal log capturing PR state, merge commit, main CI result, cleanup result, and final worktree list. Running in the background without outputting the log violates the gate.

## Backend gates

- Ruff format and lint for touched Python scope.
- Focused pytest coverage.
- Django check.
- Migration check when models or app registration change.
- Agent E review for migrations, constraints, or data integrity.
- Transaction/atomicity and rollback review where applicable.
- Authorization/security review where applicable.
- No frontend or API drift unless explicitly required.
- No contracts, payments, deposits, invoices, Celery, event bus, or commercial workflow
  unless explicitly approved.
- Backend work stays in the backend worktree only.
- After merge of F138B/F138C on `main`, use `scripts/dev/erp-backend-compose-ci`,
  `scripts/dev/erp-agent-scope-guard`, and `scripts/dev/erp-worktree-preflight` when
  applicable.

## Frontend gates

- Confirmed API contract alignment.
- TypeScript/build check.
- Lint/format when configured.
- Component/page tests.
- Accessibility review.
- Loading, error, empty, and success states.
- No fake backend data unless explicitly documented as temporary.
- No duplicated backend business rules beyond UI validation.
- No invented endpoints, payloads, permissions, or workflows.
- Frontend work stays in the frontend worktree only.
- After merge of F138B/F138C on `main`, use `scripts/dev/erp-agent-scope-guard` and
  `scripts/dev/erp-worktree-preflight` when applicable.

## PR body

Include:

- summary and objective;
- changed files;
- agent roles used and findings resolved;
- exact tests/checks and results;
- migration/data-integrity result when relevant;
- security/transaction result when relevant;
- explicit scope exclusions;
- risks, limitations, and recommended next slice;
- `No merge was performed.`
- If the task includes finalization, record that PR creation/waiting and PR finalization
  were handled as separate phases.
