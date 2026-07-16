---
name: erp-secret-handling
description: Respond to suspected Titan ERP secret exposure and perform secret-specific review. Use when a path, diff, log, or scanner finding may expose secrets; routine baseline protection belongs to erp-task-start.
---

# ERP Secret Handling

Load when a secret-like path or value is detected, when reviewing log hygiene, or when
triaging `erp-secret-scan-local`. Do not load this specialist for every ordinary command.

## What I do

Prevent accidental secret exposure through terminal commands, logs, or diffs.

## Absolute Rules

- [ ] Never read, copy, source, display, or create `.env` or `.env.*`
- [ ] Never run `env` or `printenv`
- [ ] Never print raw tokens, passwords, API keys, cookies, or private keys
- [ ] Never commit secret-like files (`.pem`, `.key`, `id_rsa`, `id_ed25519`, etc.)
- [ ] Never paste logs containing secrets without sanitization

## Allowed Actions

- [ ] Path-based secret stops (check for `.env` in `git status` or `git diff`)
- [ ] Redacted reporting (mask sensitive values when reporting)
- [ ] Use `scripts/dev/erp-secret-scan-local` for local scans
- [ ] Escalate to human when secret exposure is suspected

## If a Secret Is Exposed

1. Stop the current task
2. Report exposure without repeating the value
3. Rotate the secret through human-controlled channel
4. Remove or quarantine the sensitive artifact
5. Resume only when the incident is contained

## References

- [docs/ai-agents/secret-handling-policy.md](../../../docs/ai-agents/secret-handling-policy.md) — canonical policy (authoritative)
- [docs/ai-agents/agent-command-runbook.md](../../../docs/ai-agents/agent-command-runbook.md) — Forbidden Commands section
