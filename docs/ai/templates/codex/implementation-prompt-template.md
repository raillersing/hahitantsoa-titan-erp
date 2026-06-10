# Codex implementation prompt template

You are working on the repository `hahitantsoa-titan-erp`.

Task ID:
Task title:

Use high or very high reasoning.

## Project context

- This is the Hahitantsoa/Titan ERP project.
- Follow the current Codex-only supervised autonomous workflow.
- Codex may create a branch, implement scoped changes, commit, push, and create a PR.
- Codex must not merge the PR.
- Human merge remains mandatory.

## Mandatory safety rules

- Do not read, display, source, or modify `.env`.
- Do not expose secrets, tokens, cookies, passwords, or API keys.
- Do not commit directly to `main`.
- Do not merge pull requests.
- Do not run destructive commands.
- Do not modify files outside the allowed scope.
- Do not expand the task without human approval.

## Task specification

Paste the approved task specification here.

## Required workflow

1. Verify the repository state.
2. Create a dedicated branch.
3. Modify only allowed files.
4. Add or update tests if required.
5. Run required checks.
6. Review the diff before commit.
7. Commit only if checks and scope are acceptable.
8. Push the branch.
9. Create a PR against `main`.
10. Return the required PR report.

## Required output

Return:

- branch name
- commit hash
- PR URL
- changed files
- tests/checks run
- checks not run and why
- known risks
- rollback notes
- reviewer focus
