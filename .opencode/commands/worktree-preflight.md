---
description: Run erp-worktree-preflight and erp-agent-scope-guard
---

Run the worktree preflight and scope guard for the active task profile.

```sh
scripts/dev/erp-logged-run task-preflight <<'EOF'
set -euo pipefail
scripts/dev/erp-worktree-preflight
scripts/dev/erp-agent-scope-guard backend
EOF
```

Replace `backend` with `frontend` or `agent-tools` as appropriate. Report any mismatch
or forbidden paths immediately.
