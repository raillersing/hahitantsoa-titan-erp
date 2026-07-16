---
name: erp-backend-test-triage
description: Select focused backend tests during development and reproduce or classify failures. Use before implementation stabilizes or when a test fails; use erp-quality-gates for final local readiness.
---

## What I do

Help Codex select the smallest useful backend test slice and the proportional `L0`–`L4`
level, then widen only for demonstrated impact or a mandatory risk override.

## Checklist

- [ ] Identify the smallest relevant pytest target for the changed backend slice
- [ ] Reproduce the failure with `scripts/dev/erp-backend-fast`
- [ ] Record the selected level from `docs/ai-agents/pr-quality-gates.md`
- [ ] Use `scripts/dev/erp-backend-ci` for `L3`/`L4` or a mandatory risk override
- [ ] Widen from focused tests only when dependencies, failures, or risk require it
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
- `scripts/dev/erp-backend-ci` for `L3`/`L4` or a mandatory risk override; never pass a
  focused pytest target when claiming a complete backend suite

## Hard stops

- failure scope is unclear
- the fix would require unrelated backend breadth
- the issue depends on migrations, auth, payments, or contract changes that need a different specialist review

## Expected output

- chosen pytest target(s)
- reproduction command
- selected level, applicable risk override, and whether evidence requires widening

## Source

- [Agent Command Runbook](../../../docs/ai-agents/agent-command-runbook.md)
- [Backend Orchestrator Prompt Contract](../../../docs/ai-agents/prompt-contracts/backend-orchestrator.md)
