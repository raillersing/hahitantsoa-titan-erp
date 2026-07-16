---
name: erp-backend-migration-guardian
description: Validate migration drift and schema consistency non-destructively at the backend PR gate. Use after migration implementation; use erp-migration-safety earlier for design, backfill, reversibility, and locking decisions.
---

## What I do

Prevent migration drift and unsafe schema changes before PR.

## Checklist

- [ ] Confirm a migration is actually needed
- [ ] Run `scripts/dev/erp-backend-migration-guard`
- [ ] Verify Django system checks pass
- [ ] Verify `makemigrations --check --dry-run` is clean
- [ ] Confirm validation is non-destructive only
- [ ] Stop on any model/migration mismatch that would need manual intervention

## When to use me

Load when models, fields, constraints, indexes, or migration files change, or when the task might alter database shape.

## Inputs to inspect

- model diffs
- migration files
- app registration changes
- the backend migration guard output

## Commands / wrappers to run

- `scripts/dev/erp-backend-migration-guard`
- `scripts/dev/erp-backend-ci`

## Hard stops

- destructive migration behavior
- unknown database impact
- drift that cannot be explained by the changed model files

## Expected output

- migration necessity verdict
- drift status
- whether the change is safe to proceed

## Source

- [Agent Command Runbook](../../../docs/ai-agents/agent-command-runbook.md)
- [Backend Orchestrator Prompt Contract](../../../docs/ai-agents/prompt-contracts/backend-orchestrator.md)
