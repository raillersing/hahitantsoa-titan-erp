# PR Checklist

- Validate locally first.
- Keep F140D or other explicitly excluded local reports untracked.
- Open the PR only when the task authorizes it.
- Check `gh pr diff --name-only` before merge decisions.
- Require green `Backend quality` and `Frontend quality` on the PR.
- Require green `main` CI after merge before cleanup.
- Report the PR URL, merge commit, main CI run, and final `git status`.
