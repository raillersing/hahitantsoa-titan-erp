---
description: Run integrated task-start baseline per agent-command-runbook.md
---

Run the project-approved task-start baseline as the first command.

```sh
scripts/dev/erp-logged-run task-start <<'EOF'
set -euo pipefail
bash scripts/dev/erp-agent-task-start
EOF
```

Then confirm: branch, baseline commit, and clean status. Report any mismatch between
live baseline and static docs.
