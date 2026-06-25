---
description: Push branch, create PR, wait for checks — no merge
---

Push the current branch and create a PR following the runbook convention.

1. `git push -u origin $(git branch --show-current)`
2. `gh pr create --base main --head $(git branch --show-current) --title "type(scope): concise summary" --body "PR body following task-prompt-template.md"`
3. `gh pr checks PR-NUMBER --watch --interval 30`

Do NOT merge automatically. Report the PR URL and CI results.
