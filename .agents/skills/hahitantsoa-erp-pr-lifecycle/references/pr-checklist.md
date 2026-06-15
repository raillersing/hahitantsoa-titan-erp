# PR Checklist

- Validate locally first.
- Keep F140D or other explicitly excluded local reports untracked.
- Open the PR only when the task authorizes it.
- Check `gh pr diff --name-only` before merge decisions.
- Require green `Backend quality` and `Frontend quality` as a fallback when required checks are unconfigured. Required checks are preferred when set up.
- Finalize only from `/home/raillersing/projects/hahitantsoa-titan-erp` on branch `main`. No external jq usage allowed; gh CLI filter option must be used.
- Use `scripts/dev/erp-pr-finalize-from-root` for squash merge, post-merge `main` CI, and cleanup.
- Require green `main` CI after merge before cleanup (the run must be bound strictly to the exact HEAD SHA of current main).
- Report the PR URL, merge commit, main CI run, and final `git status`.
