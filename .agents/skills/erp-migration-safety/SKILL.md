---
name: erp-migration-safety
description: Design migration safety for schema evolution, backfills, reversibility, locking, and destructive-change planning. Use during implementation; use erp-backend-migration-guardian later for drift and non-destructive PR validation.
---

## What I do

Prevent unsafe or unnecessary database migrations by enforcing a structured review of schema changes, data migrations, and operational impact.

## Checklist

- [ ] Migration is truly necessary — model or data change cannot be handled in application code alone
- [ ] New fields have sensible defaults or null=True for existing rows
- [ ] Existing data backfill is included in the same migration (not a separate deploy step) or has an explicit plan
- [ ] Constraints (unique_together, check, FK on_delete) are reviewed for deadlock or long-table-lock risk on large tables
- [ ] Index changes account for table size — large-table index creation/deletion uses CONCURRENTLY or is explicitly planned
- [ ] Migration has a reviewed reverse path; execute reversal only against an explicitly approved disposable database when the task requires it
- [ ] No destructive operations (DROP COLUMN, DROP TABLE) without explicit human approval and a data-preservation plan
- [ ] Migration order is correct — no circular dependencies between apps
- [ ] Inspect generated SQL with the approved backend wrapper when lock or data risk requires it; never use bare host Python
- [ ] Agent E (Migration and Data Integrity Reviewer) reviews all migration files

## Source

- [Backend Agent Template — Agent E](../../../docs/ai-agents/backend-agent-template.md#agent-e---migration-and-data-integrity-reviewer)
- [PR Quality Gates — Backend gates](../../../docs/ai-agents/pr-quality-gates.md#backend-gates)
