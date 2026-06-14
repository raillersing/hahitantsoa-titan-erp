# Agent Prompt Procedure

## Purpose

This document is the canonical procedure for writing bounded agent task prompts in this
repository.

Use it with:

- [Agent command runbook](../agent-command-runbook.md)
- [Worktree registry](../worktree-registry.md)
- [Parallel agent policy](../parallel-agent-policy.md)
- [Recovery playbooks](../recovery-playbooks.md)
- [Task queue schema](../task-queue-schema.md)

Prompts must stay short. They should reference official repository procedure instead of
copying long command blocks, environment rules, or queue state into every task.

## Mandatory Prompt Fields

Every mutating or review task prompt must contain all of the following:

- `task ID`
- `working directory`
- `authorized worktree`
- `forbidden worktrees`
- `agent role/type`
- `autonomy level`
- `files to read first`
- `current repo baseline`
- `dirty-worktree stop condition`
- `allowed scope`
- `forbidden scope`
- `command mode`
- `validation commands`
- `expected output`
- `stop conditions`
- `merge/push policy`

If one field is missing, the prompt is incomplete and must be repaired before the task is
started.

## Canonical Field Meanings

### `task ID`

Use the approved task identifier or PR follow-up identifier exactly as tracked by the
orchestrator.

### `working directory`

State the repository root the agent must `cd` into before any command.

### `authorized worktree`

State the single worktree the agent may mutate or inspect for execution.

### `forbidden worktrees`

List all sibling worktrees that must not be edited, reused, cleaned, or inspected beyond
what the task explicitly authorizes.

### `agent role/type`

State the expected role clearly, for example:

- `backend implementation agent`
- `frontend implementation agent`
- `docs/tools governance agent`
- `review-only agent`

### `autonomy level`

State the allowed autonomy level explicitly. If not stated, treat the task as bounded
Level 1 work only.

### `files to read first`

List the exact runbooks, policies, prompt contracts, audits, or scripts the agent must
read before acting.

### `current repo baseline`

State the baseline facts the task depends on, such as:

- current `main` SHA
- green `main` CI run
- open PR status
- detached or active worktree state
- known dirty files

### `dirty-worktree stop condition`

Say whether the agent must stop on any dirty state or whether specific already-dirty files
are allowed and must be preserved.

### `allowed scope`

List the mutable paths or surfaces the task may change.

### `forbidden scope`

List the paths, systems, and behaviors the task must not touch.

### `command mode`

State the required execution mode exactly as described below.

### `validation commands`

List only the focused repository commands required to validate the task.

### `expected output`

State the minimum reporting required back to the human.

### `stop conditions`

List the conditions that force a stop before any broader mutation or risky recovery step.

### `merge/push policy`

State whether commit, push, PR creation, merge, or cleanup are allowed. If a permission is
not stated, treat it as not allowed.

## Command Mode Rules

### Codex And Native WSL/Bash Agents

Codex and any native WSL/bash agent must run important commands through:

```sh
cd "$HOME/projects/hahitantsoa-titan-erp"

scripts/dev/erp-logged-run task-name <<'EOF'
set -euo pipefail
...
EOF
```

Do not replace this with inline `bash -c`.

### Windows-Hosted Agents

Windows-hosted agents such as Antigravity or OpenCode are plan-only unless a stable,
explicitly approved WSL adapter is part of the task.

They must not improvise a PowerShell-to-WSL bridge on their own.

### No Improvised Bridge Rule

Never rely on ad hoc host-to-WSL bridging such as:

- hand-built PowerShell wrappers for backend validation
- host Python for backend Django tests
- one-off command relays not already approved by the repo workflow

Use repository scripts and runbooks instead.

## Permanent Prohibitions

Every prompt must preserve these permanent prohibitions:

- no `.env` read
- no `.env` source
- no `.env` copy
- no `.env` display
- no `.env` create
- no secrets handling
- no `/tmp` scripts as the primary execution mechanism
- no `chmod` unless explicitly authorized
- no host Python for backend Django tests
- no merge without human approval
- no push without human approval

## Backend Validation Rule

Backend prompts must require repository-approved runners only:

- `scripts/dev/erp-backend-compose-ci`
- `scripts/ci/backend-quality`

Do not use host Python for backend Django tests.

When the task needs backend DB-backed validation, the prompt must point to
`scripts/dev/erp-backend-compose-ci`.

## Deliverable Rule

Deliverables must be returned in one or both of these forms:

- chat output
- approved repository documentation

A private-only off-repo report must never be the sole deliverable.

## Agent Classification

Use these classifications when writing prompts:

- `Codex`: primary bounded mutating agent
- `Antigravity`: review/docs-only unless explicitly promoted
- `OpenCode`: review-only candidate pending stable WSL adapter
- `CrewAI`: future orchestration framework, not an active coding agent yet

## Standard Stop Conditions

Prompts should include the relevant task-specific stop conditions and usually include
these baseline ones:

- stop if the active dirty files are outside approved scope
- stop if the task needs backend or frontend changes not explicitly allowed
- stop if `.env` or secrets would be needed
- stop if `sudo`, `chown`, or `chmod` would be needed
- stop if another active worktree owns the same mutable files
- stop before merge or push unless explicitly authorized

## Prompt Skeleton

Use this structure:

```text
Task: <task ID and title>

Working directory:
- <repo root>

Authorized worktree:
- <single worktree path>

Forbidden worktrees:
- <path>
- <path>

Agent role:
- <role/type>

Autonomy:
- <level>

Read first:
- <file>
- <file>

Current context:
- <baseline fact>
- <baseline fact>

Allowed scope:
- <path/glob>

Forbidden scope:
- <path/glob or behavior>

Command mode:
- important commands run through scripts/dev/erp-logged-run heredoc format

Validation:
- <command>
- <command>

Stop conditions:
- <condition>
- <condition>

Merge/push policy:
- commit: <yes/no>
- push: <yes/no>
- merge: <yes/no>

Expected output:
- <required report item>
- <required report item>
```

## Related Templates

Use this procedure together with:

- [Task prompt template](../task-prompt-template.md)
- [Docs agent prompt contract](docs-agent.md)
- [Review agent prompt contract](review-agent.md)
