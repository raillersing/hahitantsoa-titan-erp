# Workflow Summary

- Use only the authorized worktree.
- Use native WSL/bash only.
- Run `bash scripts/dev/erp-agent-task-start` inside `scripts/dev/erp-logged-run` before trusting repository state.
- Report any mismatch between live baseline and static docs.
- Stop on `.env`, secrets, forbidden paths, or scope overlap.
- Keep the task bounded to the approved files and validations.
