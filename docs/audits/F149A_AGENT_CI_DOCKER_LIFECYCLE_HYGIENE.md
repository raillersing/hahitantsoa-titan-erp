# F149A — Agent CI Docker Lifecycle Hygiene

## Objective

Implement project-level safeguards so agent CI Docker containers, networks, stale
worktrees, and merged branches do not accumulate across agent sessions.

## Background

Multiple backend validation sessions (F145B through F145H, F148C through F148D)
created and left behind Docker containers, networks, and volumes via
`compose.agent-ci.yaml`. Over time these resources accumulated without a safe,
standardized cleanup mechanism. Agents either ran `docker compose down` directly
or left cleanup to the human.

Additionally, merged branches and stale worktrees required manual cleanup.
The existing `erp-pr-worktree-finalize` and `erp-worktree-clean-after-merge`
wrappers addressed worktree/branch cleanup but no equivalent existed for Docker.

## Pre-F149A Docker State

- No running ERP agent CI containers (all previously cleaned manually).
- n8n running as the only non-ERP container — must never be touched by cleanup.
- Docker build cache had been reduced in a prior independent cleanup.
- Local backend/frontend dependency caches (`.venv`, `~/.cache/pip`,
  `node_modules`, `~/.npm`) persisted independent of Docker state.
- No orphan volumes or networks detected.

## Deliverables

### 1. `scripts/dev/erp-docker-agent-cleanup`

A dry-run-safe wrapper for cleaning ERP agent CI Docker resources.

**Safety guarantees:**
- Never removes Docker volumes without `--dangerous-allow-volume-removal`.
- Never touches n8n or non-ERP containers (filters by Docker Compose project label).
- Never affects backend/frontend dependency caches.
- Dry-run by default; use `--apply` to perform changes.
- Exits cleanly when no ERP resources exist.

**Compose project name derivation:**
- Uses `git rev-parse --git-common-dir` to locate the main repo root regardless of
  whether the script runs from a linked worktree or the main working tree.
- Uses the main repo directory basename as the Docker Compose project name, ensuring
  `com.docker.compose.project` label matching works correctly across worktrees.

### 2. `docs/ai-agents/agent-command-runbook.md` updates

Added:
- **Standard Docker Agent Cleanup** section with usage examples and rules.
- **Branch and Worktree Cleanup** subsection under Post-Merge Cleanup Commands,
  documenting safe branch deletion (no `gh pr merge --delete-branch`) and worktree
  removal via `erp-worktree-clean-after-merge` or `erp-pr-worktree-finalize`.
- **Docker Container Cleanup After Backend Sessions** subsection with 6 cleanup rules
  to prevent accumulation.
- **Secret And Scope Reminder** section mentions `erp-docker-agent-cleanup` as the
  standard wrapper for Docker cleanup after F149A merge.

### 3. `docs/audits/F149A_AGENT_CI_DOCKER_LIFECYCLE_HYGIENE.md` (this file)

## Cleanup Rules (Codified)

| Rule | Guard | Effect |
|------|-------|--------|
| Volume removal requires explicit flag | `--dangerous-allow-volume-removal` | Prevents accidental postgres/redis data loss |
| n8n and non-ERP containers never touched | Label-based filtering | n8n always stays up |
| Dependency caches never affected | No Docker volume/cache operations | `.venv`, `node_modules`, pip/npm caches preserved |
| Dry-run by default | `--dry-run` (implicit) | Agent inspects before acting |
| Branch deletion never uses `gh pr merge --delete-branch` | Manual `git branch -d` / `git push origin --delete` | Safe with active worktrees |
| Worktree removal uses dedicated wrapper | `erp-worktree-clean-after-merge` or `erp-pr-worktree-finalize` | Refuses dirty/secret-like paths |

## Integration with Existing Wrappers

- `erp-docker-agent-cleanup` is independent of `erp-backend-compose-ci` (which
  orchestrates containers) and `erp-pr-worktree-finalize` (which handles PR
  finalization). All three can be composed in a cleanup sequence.
- The compose project label filter aligns with the labels Docker Compose applies when
  running with `compose.agent-ci.yaml`.

## Post-Merge Validation

- `bash scripts/dev/erp-agent-scope-guard agent-tools` — PASS
- `git diff --check` — PASS
- `scripts/dev/erp-docker-agent-cleanup --help` — shows usage
- `scripts/dev/erp-docker-agent-cleanup` — dry-run output confirms correct compose
  project derivation and no unexpected container touches
- `bash -n scripts/dev/erp-docker-agent-cleanup` — syntax check PASS
- No backend, frontend, test, `.github`, `.env`, dependency manifest, F147F worktree,
  or `docs/audits/F140D_OPENCODE_WSL_NATIVE_EVALUATION.md` modifications
