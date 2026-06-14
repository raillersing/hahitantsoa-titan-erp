# Secret Handling Policy

## Purpose

This policy defines the minimum secret and log-hygiene rules for all agents.

## Absolute Rules

- never read `.env`
- never copy `.env`
- never source `.env`
- never display `.env`
- never create `.env`
- never run `env`
- never print raw tokens, passwords, API keys, cookies, or private keys
- never paste logs that may contain secrets without sanitization
- never commit secret-like material to the repository

## Allowed Approach

Agents must prefer:

- path-based secret stops;
- redacted reporting;
- non-mutating local scans;
- explicit human escalation when secret exposure is suspected.

## Local Secret Scan

Use:

```sh
scripts/dev/erp-secret-scan-local --help
scripts/dev/erp-secret-scan-local
scripts/dev/erp-secret-scan-local --paths-only
```

The scanner:

- excludes `.env` and `.env.*`;
- excludes common binary and certificate-like file suffixes from content reads;
- reports only file, line, pattern label, and redacted snippet;
- never prints the full matched value.

## Log Hygiene

Agents must:

- avoid storing sensitive logs when the task can be completed without them;
- redact suspicious values before sharing logs;
- stop if terminal output appears to include secret-like material;
- avoid copying raw logs into chat if they may contain credentials or session tokens.

If `scripts/dev/erp-logged-run` captures sensitive output by accident:

1. stop sharing the log;
2. treat the value as potentially exposed;
3. rotate the secret if it is real;
4. clean up or restrict the log according to human-approved operational policy.

## Rotation Policy

If a secret is exposed in terminal output, logs, screenshots, pasted text, or commit
history:

1. stop the current task;
2. report that exposure may have happened without repeating the value;
3. rotate the secret immediately through the proper human-controlled channel;
4. remove or quarantine the sensitive log or artifact where possible;
5. resume only when the incident is contained.

## CI And GitHub Hygiene

Agents must verify:

- no `.env` usage in CI workflows;
- no unnecessary secret references in PR jobs;
- no unsafe logging of credentials or tokens;
- no untrusted input path that could leak secret material through output.

## Scope Stops

Stop immediately if:

- a task asks to inspect `.env`;
- a path like `.env`, `.env.*`, `.pem`, `.key`, `id_rsa`, or `id_ed25519` enters scope;
- a command sequence would require `env`, `printenv`, or `source .env`;
- a log appears to contain raw credentials.

Use a redacted incident report and the local scan helper instead of deeper inspection.
