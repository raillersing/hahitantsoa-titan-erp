---
name: erp-scope-guard-setup
description: Troubleshoot ERP scope-guard profiles and failures. Use when selecting a non-obvious profile or when erp-agent-scope-guard fails; do not load merely to run the standard guard documented by erp-task-start.
---

## What I do

Help agents understand when and how to run `erp-agent-scope-guard`, what each profile enforces, and how to fix common failures.

## Available Profiles

| Profile | Guard behavior | Allowed paths after blocked-path checks |
|---------|----------------|------------------------------------------|
| `backend` | Denies frontend, `.env`-like, and secret-looking paths | Path guard is a deny-list; the approved task scope remains authoritative |
| `frontend` | Denies backend, `tests/backend`, `frontend/dist`, `.env`-like, and secret-looking paths | Path guard is a deny-list; the approved task scope remains authoritative |
| `agent-tools` | Denies application, GitHub workflow, dependency-manifest, `.env`-like, and secret-looking paths | Only `scripts/dev/`, `compose.agent-ci.yaml`, `docs/audits/`, and `docs/ai-agents/` |
| `agent-docs` | Denies application, tests, GitHub workflow, dependency-manifest, `.env`-like, and secret-looking paths | `AGENTS.md`, approved agent/design/application-map docs, `.agents/skills/`, OpenCode/Claude compatibility governance, `compose.agent-ci.yaml`, and ERP-prefixed workflow helpers under `scripts/dev/` |

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
| Script not found or permission denied | Missing path or executable bit | Stop and report it; change permissions only in an explicitly authorized tooling-governance task, otherwise use `bash` when the runbook documents that invocation |

## Source

- [scripts/dev/erp-agent-scope-guard](../../../scripts/dev/erp-agent-scope-guard)
- [Agent Command Runbook — Secret And Scope Reminder](../../../docs/ai-agents/agent-command-runbook.md#secret-and-scope-reminder)
