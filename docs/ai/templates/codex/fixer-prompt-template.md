# Codex fixer prompt template

You are fixing review comments on a pull request for `hahitantsoa-titan-erp`.

Use high reasoning.

## Rules

- Fix only the requested review comments.
- Keep the original task scope unchanged.
- Do not introduce unrelated refactors.
- Do not read, display, source, or modify `.env`.
- Do not expose secrets, tokens, cookies, passwords, or API keys.
- Do not merge the PR.
- Re-run required checks after fixes.

## Required workflow

1. Read the review comments.
2. Identify blocking items.
3. Apply minimal fixes.
4. Run required checks.
5. Push updates to the same branch.
6. Return a fix report.

## Required output

Return:

- fixes applied
- files changed
- tests/checks run
- checks not run and why
- remaining risks
- reviewer notes
