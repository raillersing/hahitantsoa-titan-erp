---
name: erp-migration-safety
description: Migration necessity, reversibility, constraints, indexes, locking, and rollback checklist for model or data changes
---

## What I do

Prevent unsafe or unnecessary database migrations by enforcing a structured review of schema changes, data migrations, and operational impact.

## Checklist

- [ ] Migration is truly necessary — model or data change cannot be handled in application code alone
- [ ] New fields have sensible defaults or null=True for existing rows
- [ ] Existing data backfill is included in the same migration (not a separate deploy step) or has an explicit plan
- [ ] Constraints (unique_together, check, FK on_delete) are reviewed for deadlock or long-table-lock risk on large tables
- [ ] Index changes account for table size — large-table index creation/deletion uses CONCURRENTLY or is explicitly planned
- [ ] Migration is reversible — `migrate app zero` or a reverse migration path exists
- [ ] No destructive operations (DROP COLUMN, DROP TABLE) without explicit human approval and a data-preservation plan
- [ ] Migration order is correct — no circular dependencies between apps
- [ ] Run `python manage.py makemigrations --check` to verify no uncreated migrations
- [ ] Run `python manage.py migrate --plan` to preview the SQL before applying
- [ ] Agent E (Migration and Data Integrity Reviewer) reviews all migration files

## When to use me

Load when a task introduces new models, fields, constraints, indexes, or data migrations. Use during implementation (before commit) and during Agent E review.

## Source

- [Backend Agent Template — Agent E](../backend-agent-template.md#agent-e---migration-and-data-integrity-reviewer)
- [PR Quality Gates — Backend gates](../pr-quality-gates.md#backend-gates)
