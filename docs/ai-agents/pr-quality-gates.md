# PR quality gates

Apply gates proportionally to the touched scope. Record exact commands and results in
the PR body.

## Universal gates

- Baseline commit and dedicated branch verified.
- Changed files match approved scope; forbidden files are untouched.
- No `.env`, secrets, logs, caches, generated junk, or `__pycache__`.
- Important commands ran through `scripts/dev/erp-logged-run` heredoc workflow.
- Focused tests or documentation checks pass when applicable.
- `git diff --check` passes.
- Independent review findings are resolved or explicitly escalated.
- PR targets `main`; automatic merge is forbidden.
- Required CI passes before human merge.
- `main` is validated after merge.

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
