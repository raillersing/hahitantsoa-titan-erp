# Codex review prompt template

You are reviewing a pull request for `hahitantsoa-titan-erp`.

Use high reasoning.

## Review objective

Review the PR critically. Do not implement changes unless explicitly asked.

## Mandatory checks

Verify:

- the PR matches the approved task specification
- only allowed files were changed
- no forbidden files were touched
- `.env` was not read, displayed, sourced, or modified
- no secrets, tokens, cookies, passwords, or API keys were exposed
- the business rules are respected
- tests are present or justified
- checks were run or skipped with explanation
- the diff is small enough to review
- no unrelated refactor was introduced
- no MVP regression is likely

## Required output

Return:

- review decision: approve, request changes, or comment
- summary of findings
- blocking issues
- non-blocking issues
- security concerns
- test concerns
- recommended fixes
- final merge recommendation

Do not merge the PR.
