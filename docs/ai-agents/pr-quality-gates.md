# PR quality gates

Apply gates proportionally to the touched scope. Record exact commands and results in
the PR body.

Use the standard command patterns in
[`agent-command-runbook.md`](agent-command-runbook.md) and keep prompts short by
referencing the current task state in
[`orchestrator-task-queue.md`](orchestrator-task-queue.md).

## Proportional local validation matrix

Test the changed behavior at the lowest level that proves it, then add only the
mandatory risk overrides below. Do not repeat an unchanged green suite merely because a
reviewer or orchestrator phase changed.

| Level | Change profile | Required local evidence before PR |
|---|---|---|
| `L0 — governance/docs` | Markdown, agent skills, reports, copy, or ignored evidence with no executable/config change | scope guard, relevant document/skill/link validator, `git diff --check`; no backend/frontend application suite |
| `L1 — focused` | Isolated backend function/view/serializer or frontend component behavior | affected focused tests, touched-language lint/type check, and frontend build when shipped frontend source changes |
| `L2 — subsystem` | Several files in one bounded backend app or frontend journey | focused subsystem tests plus applicable Django check, migration check, frontend build, or targeted Playwright journey |
| `L3 — full affected stack` | Cross-cutting framework/config/dependency change or mandatory risk override | complete backend or frontend local gate for each affected stack; backend runtime changes also require explicit Django check |
| `L4 — cross-boundary` | Approved backend/frontend contract or end-to-end workflow change | complete gates for both affected stacks plus targeted E2E/Playwright proof |

Selection rules:

- Start with `L1` during implementation; widen only when changed dependencies or a
  failure demonstrate broader impact.
- `L0` never runs application suites solely for reassurance.
- A frontend source change requires a production build, but not every Playwright suite.
- Run Playwright only for the changed journey, browser-only behavior, responsive/layout
  risk, routing, or a contract integration that component tests cannot prove.
- Reviewers reuse command/result evidence only when it records the tested Git HEAD and
  that HEAD still matches the reviewed diff. Accept logged local evidence tied to that
  SHA or completed PR CI for the exact head. Rerun impacted checks after a code-changing
  commit; rerun otherwise only to reproduce a finding, investigate nondeterminism, or
  cover a missed risk.
- After a documentation-only rebase, rerun document/scope/diff checks, not previously
  green application suites.
- PR CI and exact-SHA `main` CI remain mandatory. The path/risk-aware CI implementation
  must expose one required policy-gate check so skipped inapplicable jobs cannot look
  like missing validation.

### Mandatory risk overrides

| Risk | Minimum level and additional evidence |
|---|---|
| Authentication, session, CSRF, authorization, tenant/object isolation, secrets | `L3` backend; add affected frontend gate and targeted E2E when browser auth behavior changes |
| Model or migration change | `L3` backend plus migration guard and migration/data-integrity review |
| Payment, refund, receipt, cashbox, financial calculation or idempotency | `L3` backend plus payment/idempotency and transaction review |
| Stock, reservation availability, confirmation, allocation, or competing writes | `L3` backend plus transaction/concurrency and rollback evidence |
| Public API contract used by frontend | `L4` unless the change is proven backward-compatible and frontend-neutral by contract tests and independent review |
| Dependency, compiler, bundler, Django settings, test infrastructure, or CI wrapper | `L3` for every affected stack |
| Sensitive upload or private document access | `L3` affected stack plus security and authorization review |

These overrides may increase validation, never decrease trust-boundary, data-loss,
financial, migration, or concurrency proof.

## Phase integration checkpoint

After all approved lots of a phase are merged and their exact-SHA `main` CI runs are
green, run one read-only phase checkpoint before declaring the phase complete. It must
reuse the exact per-PR evidence where the reviewed SHA is unchanged, then add only the
complete affected-stack gates, changed E2E journeys, and role, responsive, or operational
proof that cannot be established by a single lot.

Record ordinary presentation or ergonomic findings for one consolidated corrective bundle
after that checkpoint. Do not defer a security, permission, data-integrity, migration,
financial, concurrency, CI, or release-blocking failure: stop and correct it immediately.

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
- All scripts under `scripts/dev/` that were created or modified have the executable bit set. Directly executed repo helpers must have the executable bit set. Helpers called from another script may be explicitly invoked through bash. Cleanup permission failures (exit code 126) must stop safely and produce an actionable recovery path.
- CI wait policy followed: pre-merge CI green confirmed before merge; post-merge `main` CI
  green confirmed after merge.
- Root-only finalization policy followed: merge from the main-root worktree only, never
  from a temporary task worktree.
- Independent review findings are resolved or explicitly escalated.
- PR targets `main`; automatic merge is forbidden.
- Required CI passes before human merge.
- `main` is validated after merge. The validation must be SHA-bound to the exact HEAD SHA of current main. Relying on the latest main CI run conclusion without HEAD SHA matching is a gate violation.
- `main` CI is green after merge (the run matching current main HEAD SHA must be SUCCESS).
- Human merge remains mandatory unless explicitly authorized.
- When Codex is explicitly authorized to merge, it must use
  `scripts/dev/erp-pr-finalize-from-root` or an equivalent logged root-`main` command.
- PR check status validation: required checks are verified via `gh pr checks` first. If
  required checks are missing or unconfigured, statusCheckRollup must contain
  `CI policy gate` with conclusion `SUCCESS`. That gate fails unless every stack selected
  by the path/risk classifier succeeds; an unselected stack may be `SKIPPED`.
- JSON processing inside helper tools must never call external `jq`. All processing must be handled via `gh --json --jq`.
- Root finalization reports are invalid unless they include the real, synchronous completed `erp-logged-run` terminal log capturing PR state, merge commit, main CI result, cleanup result, and final worktree list. Running in the background without outputting the log violates the gate.
- Windows-to-WSL adapter validation gate: full-cycle operations on Windows-hosted Antigravity must proceed exclusively via the versioned, audited project adapter wrapper, which enforces synchronous execution and logged wrappers inside WSL. Raw `wsl`/`wsl.exe`/`bash -c` executions outside the approved wrapper violate the gates.

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
