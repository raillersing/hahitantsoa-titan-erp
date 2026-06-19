---
name: erp-scope-guard-setup
description: Quick reference for running and troubleshooting the ERP agent scope guard
---

## What I do

Help agents understand when and how to run `erp-agent-scope-guard`, what each profile enforces, and how to fix common failures.

## Available Profiles

| Profile | Forbids | Allows |
|---------|---------|--------|
| `backend` | Frontend paths, .env-like files, dist output, secret-looking files | Backend paths |
| `frontend` | Backend paths, .env-like files, dist output, secret-looking files | Frontend paths |
| `agent-tools` | Backend, frontend, .github, dependency manifests, .env, secrets | scripts/dev, compose.agent-ci.yaml, docs/audits, docs/ai-agents |
| `agent-docs` | Backend, frontend, tests, scripts/dev, .github, dependency manifests, .env, secrets | docs/ai-agents, docs/audits, opencode.json, .opencode/, .agents/skills/, CLAUDE.md, .claude/ |

## How to Run

```sh
bash scripts/dev/erp-agent-scope-guard <profile>
```

The guard compares the current diff against the allowed paths for the given profile.

## Common Failures

| Error | Cause | Fix |
|-------|-------|-----|
| `forbidden paths detected` | Diff contains files outside the profile's allowed scope | Move or revert the offending files; ensure the correct profile is selected |
| `no changed paths detected` | Nothing to check (clean worktree) | No action needed — this is normal after a fresh checkout |
| Script not found or permission denied | Missing executable bit | Run `chmod +x scripts/dev/erp-agent-scope-guard` |

## When to use me

Load when setting up a new agent session, troubleshooting a scope guard failure, or selecting the correct profile for a task.

## Source

- [scripts/dev/erp-agent-scope-guard](../../scripts/dev/erp-agent-scope-guard)
- [Agent Command Runbook — Secret And Scope Reminder](../agent-command-runbook.md#secret-and-scope-reminder)
