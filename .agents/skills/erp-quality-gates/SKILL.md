---
name: erp-quality-gates
description: Run the complete applicable backend pre-commit quality gate after implementation stabilizes. Use for final local readiness; use erp-backend-test-triage during development or failure diagnosis.
---

# ERP Quality Gates

Use after implementing a backend change, before commit and push.

## What I do

Verify that all backend quality gates pass before opening a PR.

## Checklist

- [ ] Ruff format and lint pass for touched Python scope
- [ ] Focused pytest coverage for the change
- [ ] Django check passes (`python backend/manage.py check`)
- [ ] Migration check when models or app registration change (`python backend/manage.py makemigrations --check --dry-run`)
- [ ] Transaction/atomicity review where applicable
- [ ] Authorization/security review where applicable
- [ ] No frontend or API drift unless explicitly required
- [ ] No contracts, payments, deposits, invoices, Celery, event bus, or commercial workflow unless explicitly approved
- [ ] Backend work stays in the backend worktree only
- [ ] `git diff --check` passes
- [ ] Agent scope guard passes for the active profile
- [ ] No host Python — use `scripts/dev/erp-backend-compose-ci` or `scripts/ci/backend-quality` for backend validation

## When to use me

Load before every backend commit and before opening a PR.

## References

- [docs/ai-agents/pr-quality-gates.md](../../../docs/ai-agents/pr-quality-gates.md) — canonical quality gate document
- [docs/ai-agents/agent-command-runbook.md](../../../docs/ai-agents/agent-command-runbook.md) — standard command patterns
