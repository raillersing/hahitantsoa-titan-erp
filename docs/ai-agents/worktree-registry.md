# Worktree Registry

## Purpose

This registry defines the standard mapping between worktrees, agents, branches, and
allowed mutable scope.

Use it together with:

- [Agent command runbook](agent-command-runbook.md)
- [Orchestrator task queue](orchestrator-task-queue.md)
- [Recovery playbooks](recovery-playbooks.md)

## Core Rule

One agent equals one worktree equals one branch equals one non-overlapping mutable scope.

Never assign two active agents to the same files. Never modify another active worktree.
Never remove a dirty worktree without an explicit stop and human confirmation.

## Registry Matrix

| Worktree | Agent profile | Branch pattern | Mutable scope | Persistence |
| --- | --- | --- | --- | --- |
| `/home/raillersing/projects/hahitantsoa-titan-erp` | main-root | `main` | none by default; integration and detached post-merge checks only | persistent |
| `/home/raillersing/projects/hahitantsoa-titan-erp-backend` | backend | `feat/f135b-*` and later backend task branches | `backend/`, `tests/backend/`, backend audits | persistent |
| `/home/raillersing/projects/hahitantsoa-titan-erp-frontend` | frontend | detached or future `feat/f137*` frontend branches | `frontend/`, frontend audits | persistent |
| `/home/raillersing/projects/hahitantsoa-titan-erp-agent-tools` | agent-tools | `chore/f138-agent-ready-*` | `scripts/dev/`, `compose.agent-ci.yaml`, F138 tools audit files | persistent |
| `/home/raillersing/projects/hahitantsoa-titan-erp-agent-docs` | agent-docs | `docs/f138-*` docs branches | `docs/ai-agents/`, docs audits, minimal approved agent doc links | persistent |
| `/home/raillersing/projects/hahitantsoa-titan-erp-agent-lifecycle` | agent-lifecycle | `chore/f138f-*` | lifecycle scripts and lifecycle/recovery docs only | persistent |
| `/home/raillersing/projects/hahitantsoa-titan-erp-agent-security` | agent-security | `chore/f138g-*` | security hygiene docs or approved workflow files only | persistent |
| `/home/raillersing/projects/hahitantsoa-titan-erp-agent-prompts` | agent-prompts | `docs/f138i-*` | prompt contracts and related docs only | persistent |
| temporary review or repair worktree | review or repair | task-specific review branch | explicitly approved review or repair scope only | temporary |
| `/home/raillersing/projects/hahitantsoa-titan-erp-openclaw-sandbox` | forbidden | none | none | forbidden |

## Persistent Worktrees

Persistent worktrees are long-lived operator-managed workspaces for recurring streams:

- main-root
- backend
- frontend
- agent-tools
- agent-docs
- agent-lifecycle
- agent-security
- agent-prompts

Persistent does not mean reusable for unrelated scope. Each task still requires a
dedicated branch and a non-overlapping file surface.

## Temporary Worktrees

Temporary worktrees are acceptable for:

- short-lived review branches;
- focused recovery work;
- isolated repair slices;
- one-off documentation or audit follow-ups.

Temporary worktrees must still follow:

- no `.env` access;
- no secret handling;
- no overlapping mutable files with another active agent;
- post-merge cleanup only when clean and human-approved.

## Validated Listing Command

Use:

```sh
scripts/dev/erp-worktree-list-validated
```

This command reports:

- worktree path;
- branch or detached state;
- inferred profile;
- persistence class;
- clean or dirty status;
- ahead/behind divergence from upstream when available.

## Safe Post-Merge Cleanup Command

Use:

```sh
scripts/dev/erp-worktree-clean-after-merge --help
scripts/dev/erp-worktree-clean-after-merge branch-name
scripts/dev/erp-worktree-clean-after-merge --apply branch-name
```

The cleanup helper is safe by default because it:

- runs in dry-run mode unless `--apply` is passed;
- stops if the target branch is not merged into `origin/main`;
- stops if the worktree is dirty;
- stops on secret-like paths in status;
- stops if the branch is still the current branch or still bound to an unsafe context.

## Secret And `.env` Stop Policy

Any worktree lifecycle operation must stop immediately if:

- `.env` or `.env.*` appears in status or intended scope;
- private keys or secret-like files appear in status;
- a task would require reading, sourcing, copying, printing, or creating `.env`.

Recovery for these cases is documented in
[Recovery playbooks](recovery-playbooks.md).
