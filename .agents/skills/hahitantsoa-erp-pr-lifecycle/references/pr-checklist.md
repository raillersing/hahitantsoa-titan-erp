# PR Checklist

- Validate locally first.
- Keep F140D or other explicitly excluded local reports untracked.
- Open the PR only when the task authorizes it.
- Check `gh pr diff --name-only` before merge decisions.
- Require green `Backend quality` and `Frontend quality` on the PR.
- Finalize only from `/home/raillersing/projects/hahitantsoa-titan-erp` on branch `main`.
- Use `scripts/dev/erp-pr-finalize-from-root` for squash merge, post-merge `main` CI, and cleanup.
- Require green `main` CI after merge before cleanup.
- Report the PR URL, merge commit, main CI run, and final `git status`.
