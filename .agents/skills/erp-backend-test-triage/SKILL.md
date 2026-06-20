---
name: erp-backend-test-triage
description: Focused backend test selection, failure reproduction, and escalation to full backend CI before PR
---

## What I do

Help Codex pick the smallest useful backend test slice first, then escalate to the full backend CI wrapper before PR.

## Checklist

- [ ] Identify the smallest relevant pytest target for the changed backend slice
- [ ] Reproduce the failure with `scripts/dev/erp-backend-fast`
- [ ] Use `scripts/dev/erp-backend-ci` before PR or when Ruff or migration coverage matters
- [ ] Escalate from focused tests to full backend CI instead of expanding the slice blindly
- [ ] Stop if the failure looks cross-cutting, contract-heavy, or migration-sensitive
- [ ] Keep pytest targets explicit and short

## When to use me

Load when choosing backend tests, debugging a failing slice, or deciding whether to widen validation before commit.

## Inputs to inspect

- touched backend files and test paths
- failing pytest nodeids or stack traces
- recent wrapper output from `scripts/dev/erp-backend-fast`
- backend CI output from `scripts/dev/erp-backend-ci`

## Commands / wrappers to run

- `scripts/dev/erp-backend-fast tests/backend/path_or_module.py -q`
- `scripts/dev/erp-backend-ci tests/backend/path_or_module.py -q`

## Hard stops

- failure scope is unclear
- the fix would require unrelated backend breadth
- the issue depends on migrations, auth, payments, or contract changes that need a different specialist review

## Expected output

- chosen pytest target(s)
- reproduction command
- whether the issue stays focused or needs full backend CI

## Source

- [Agent Command Runbook](../../../docs/ai-agents/agent-command-runbook.md)
- [Backend Orchestrator Prompt Contract](../../../docs/ai-agents/prompt-contracts/backend-orchestrator.md)
