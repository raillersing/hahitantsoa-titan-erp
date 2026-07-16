---
name: erp-backend-pr-finalizer
description: Confirm backend diff, local evidence, migration status, scope, and independent review before PR creation. Use only for backend pre-PR readiness; later CI, merge, exact-SHA validation, and cleanup have dedicated skills.
---

## What I do

Standardize backend readiness after implementation and independent review, before PR creation.

## Checklist

- [ ] Run focused tests with `scripts/dev/erp-backend-fast`
- [ ] Run `scripts/dev/erp-backend-migration-guard`
- [ ] Run `scripts/dev/erp-backend-ci`
- [ ] Run `scripts/dev/erp-agent-scope-guard backend`
- [ ] Confirm independent-review findings are resolved and the reviewed diff is unchanged
- [ ] Hand off the PR and exact-SHA lifecycle to `erp-ci-workflow`

## When to use me

Load when backend implementation and independent review are ready for the PR gate.

## Inputs to inspect

- branch name and head SHA
- focused and complete local validation evidence
- independent review verdict

## Commands / wrappers to run

- `scripts/dev/erp-backend-fast`
- `scripts/dev/erp-backend-migration-guard`
- `scripts/dev/erp-backend-ci`
- `scripts/dev/erp-agent-scope-guard backend`

## Hard stops

- required local evidence is failing or missing
- independent review is missing or unresolved
- the diff changed after review

## Expected output

- validation summary
- independent review and scope verdict
- readiness or hard-stop decision

## Source

- [Backend Orchestrator Prompt Contract](../../../docs/ai-agents/prompt-contracts/backend-orchestrator.md)
- [Agent Command Runbook](../../../docs/ai-agents/agent-command-runbook.md)
