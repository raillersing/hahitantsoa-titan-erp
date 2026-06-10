# Codex task specification template

## Metadata

- task_id:
- task_title:
- target_level:
- requested_by:
- date:
- repository:
- base_branch:
- target_branch:

## Objective

Describe the exact outcome expected from this task.

## Business context

Explain why this task matters for the Hahitantsoa/Titan ERP MVP.

## Scope

Allowed files or directories:

- path/to/allowed/file-or-directory

Forbidden files or directories:

- .env
- .env.*
- secrets
- unrelated modules

Forbidden actions:

- Do not read, display, source, or modify .env.
- Do not expose secrets, tokens, cookies, passwords, or API keys.
- Do not commit directly to main.
- Do not merge pull requests.
- Do not run destructive commands.
- Do not expand scope without human approval.

## Expected changes

List the expected changes in plain language.

## Acceptance criteria

- Criterion 1
- Criterion 2
- Criterion 3

## Required checks

- backend tests:
- frontend tests:
- lint:
- build:
- other:

If a check cannot be run, Codex must explain why.

## Rollback plan

Explain how to revert the task safely if needed.

## Review focus

Reviewer should focus on:

- business rule correctness
- scope control
- tests
- security
- non-regression
- readability
- maintainability

## Required Codex output

Codex must return:

- branch name
- commit hash
- PR URL
- changed files
- tests/checks run
- checks not run and why
- known risks
- reviewer focus
