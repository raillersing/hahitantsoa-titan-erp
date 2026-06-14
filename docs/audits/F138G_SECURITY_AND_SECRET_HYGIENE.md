# F138G Security And Secret Hygiene

## Status

Implemented for the agent-security worktree.

## Objective

Provide two missing safety layers:

- F138G: repository-rules and CI-security review guidance;
- F138H: local secret-scan and log-hygiene guardrails.

## Delivered Files

- `scripts/dev/erp-secret-scan-local`
- `scripts/dev/erp-github-repo-rules-audit`
- `docs/ai-agents/github-repository-rules-checklist.md`
- `docs/ai-agents/secret-handling-policy.md`
- this audit

Minimal README links may be added so these documents become part of the official agent
workflow corpus.

## Why A Secret Policy Was Needed

The project already prohibited `.env` access, but the rules were scattered across prompts
and workflow docs. A dedicated policy was needed to centralize:

- no `.env` reading, copying, sourcing, printing, or creation;
- no `env` command usage;
- no raw secret sharing in logs or chat;
- mandatory rotation when a real secret is exposed.

## Why A Local Scanner Was Needed

Agents need a safe way to detect suspicious material without printing it back.

The local scanner is intentionally conservative:

- non-mutating;
- excludes `.env` and `.env.*`;
- prints only file, line, label, and redacted snippet;
- can report path-only mode for extra caution.

This keeps the tool useful for hygiene checks without becoming a disclosure vector.

## Why A GitHub Rules Checklist Was Needed

The repository CI exists, but CI safety is broader than whether jobs happen to pass.
Agents also need a stable checklist for:

- branch protection;
- required checks;
- squash merge policy;
- least-privilege Actions permissions;
- avoiding `pull_request_target`;
- avoiding PR-job secrets;
- action version review;
- post-merge main CI verification.

## Non-Goals

- no workflow mutation;
- no repository settings mutation;
- no dependency changes;
- no `.env` inspection;
- no secret display.

## Validation Target

F138G/F138H is considered ready when these checks pass:

- `bash -n scripts/dev/erp-secret-scan-local`
- `bash -n scripts/dev/erp-github-repo-rules-audit`
- `git diff --check`
- anti-mojibake check
- `scripts/dev/erp-secret-scan-local --help`
- `scripts/dev/erp-github-repo-rules-audit --help`
- no changes in `backend/`, `frontend/`, `.github/workflows/`, Compose, dependencies, or `.env`
