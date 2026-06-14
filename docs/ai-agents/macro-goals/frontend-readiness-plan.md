# Frontend Readiness Plan - MG-FRONTEND-FINALIZATION

This plan defines the readiness checklist and micro-task sequencing for finalizing the frontend module.

## Frontend State

- The frontend worktree at `/home/raillersing/projects/hahitantsoa-titan-erp-frontend` is currently detached and must be verified and resynced to the latest `origin/main` before any implementation begins.

## Backend Dependencies

### Available Backend Capabilities
- `F135B`: Private reservation confirmation API is successfully merged and verified on `main`.
- `F126B`: Commercial document context service is successfully merged and verified on `main`.

### Pending Backend Capabilities
- `F126C` (PR #174): The commercial document service completion is currently open and must be merged with its `main` CI green before dependent frontend tasks can start.

## Micro-Task Sequence

1. **F138E**: Perform worktree checks, verify that the frontend worktree is clean, and synchronize it to the latest `origin/main` in detached HEAD mode.
2. **F137C**: Approved frontend shell and module integration task. This task is blocked until F126C (PR #174) is fully merged.

## Stop Conditions

- Frontend worktree is not clean or has untracked modifications.
- Attempting to proceed with F137C before F126C (PR #174) is merged and its `main` CI is green.
- Any backend or shared index files are modified during a frontend-focused task.
- Any attempt to read, write, or query `.env` files or other secret-like configurations.

## Proposed Actions for the Supervisor

**1. Execute worktree check and sync (F138E)**:
```bash
cd "$HOME/projects/hahitantsoa-titan-erp"

scripts/dev/erp-logged-run f138e-frontend-sync <<'EOF'
set -euo pipefail

echo "============================================================"
echo "1. VERIFY FRONTEND WORKTREE CLEANSTATE"
echo "============================================================"
cd /home/raillersing/projects/hahitantsoa-titan-erp-frontend
git status --short

if [ -n "$(git status --short)" ]; then
  echo "STOP: Frontend worktree has uncommitted or untracked changes."
  exit 1
fi

echo
echo "============================================================"
echo "2. FETCH AND SWITCH TO DETACHED MAIN"
echo "============================================================"
git fetch origin main --prune
git switch --detach origin/main
git log --oneline -5
EOF
```

**2. Initialize the branch for F137C**:
```bash
cd "$HOME/projects/hahitantsoa-titan-erp"

scripts/dev/erp-logged-run f137c-frontend-start <<'EOF'
set -euo pipefail

echo "============================================================"
echo "1. CHECK IF BRANCH ALREADY EXISTS"
echo "============================================================"
cd /home/raillersing/projects/hahitantsoa-titan-erp-frontend

if git show-ref --verify --quiet refs/heads/feat/f137c-frontend-integration; then
  echo "STOP: Branch 'feat/f137c-frontend-integration' already exists."
  echo "Please request manual human inspection."
  exit 1
fi

echo
echo "============================================================"
echo "2. CREATE DEVELOPMENT BRANCH"
echo "============================================================"
git switch -c feat/f137c-frontend-integration
git status --short
EOF
```
