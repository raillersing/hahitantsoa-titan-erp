# F89 - Codex-only supervised autonomous ERP workflow

## Status

Result: DRAFT workflow definition for the next automation phase.

Decision: the next supervised autonomous workflow for Hahitantsoa/Titan ERP will use Codex only.

Aider remains documented as experimental and read-only only after F88. Gemini CLI remains optional and is not part of the next automation architecture. The goal is to reduce repetitive manual copy/paste work while keeping quality, auditability, and human merge control.

## Current project state

The latest validated state before F89 is:

- Main branch is clean and up to date with origin/main.
- Latest known main commit after F88: 92fe6a8 Merge pull request #85 from raillersing/docs/local-aider-ollama-experiment-f88.
- MVP read-only Hahitantsoa/Titan was accepted locally before this automation phase.
- F88 documented the Aider/Ollama experiment and kept Aider read-only only.
- The next implementation task is not authorized yet.

## Why Codex-only

The project will use Codex-only for the next automation phase because:

- Codex is the preferred senior coding agent for this ERP project.
- Codex can be assigned clear roles through prompts.
- Codex can work from a GitHub repository context.
- Codex can create implementation branches and pull requests when authorized.
- Codex can also be used for PR review flows.
- Keeping one agent family reduces coordination complexity.

This does not mean Codex can merge automatically. Merge remains human-controlled.

## Codex roles

The workflow uses one Codex tool with multiple operational roles.

### Codex Planner

Responsibilities:

- Read the approved project context.
- Identify the next useful MVP task.
- Produce a scoped task specification.
- Define allowed files and forbidden files.
- Define acceptance criteria.
- Define required checks.
- Define rollback expectations.
- Define review focus.

The Planner must not implement code.

### Codex Implementer

Responsibilities:

- Create a dedicated branch.
- Modify only files allowed by the task specification.
- Add or update tests when required.
- Run the required checks.
- Produce a clear implementation report.
- Commit and push only if the local gates pass.
- Create a pull request.

The Implementer must not merge.

### Codex Reviewer

Responsibilities:

- Review the pull request diff.
- Check that the implementation matches the task specification.
- Check business rules.
- Check tests and validation evidence.
- Check security and secret-safety.
- Request changes if needed.

The Reviewer must not merge.

### Codex Fixer

Responsibilities:

- Apply only the corrections requested by review.
- Keep the scope unchanged.
- Re-run required checks.
- Push updates to the same PR branch.
- Report what was fixed.

The Fixer must not expand the task.

### Human Supervisor

Responsibilities:

- Approve the initial task.
- Approve the task specification.
- Review the PR summary and validation output.
- Decide whether to merge.
- Keep final authority over the MVP direction.

The Human Supervisor remains the final decision maker.

## Autonomy levels

### Level 0 - Manual ChatGPT-guided workflow

This is the current baseline.

- ChatGPT prepares commands.
- Human executes commands in WSL.
- Logs are copied to clipboard.
- Human pastes outputs back into the conversation.
- ChatGPT reviews and guides the next step.
- Human performs final merge.

### Level 1 - Codex creates scoped documentation PRs

Codex receives one detailed prompt for a documentation-only task.

Allowed:

- Create a branch.
- Add or update one expected documentation file.
- Commit.
- Push.
- Open PR.

Forbidden:

- Application code changes.
- Direct main commits.
- Automatic merge.

### Level 2 - Codex implements small scoped tasks with tests

Codex receives one detailed implementation prompt for a small task.

Allowed:

- Create a branch.
- Implement within allowed files.
- Add or update tests.
- Run checks.
- Commit.
- Push.
- Open PR.

Required:

- Clear diff.
- Clear validation report.
- Human review before merge.

### Level 3 - Codex implements one complete module from an approved module spec

Codex may implement a complete module only after a human-approved module specification exists.

Required:

- Module spec approved first.
- Allowed files listed.
- Forbidden files listed.
- Backend and frontend acceptance criteria defined.
- Tests and validation checks defined.
- PR must remain reviewable.

The module can be large, but it must still be split into auditable commits or sections when possible.

### Level 4 - Automatic merge

Not authorized.

Codex must not merge pull requests automatically. Automatic merge may be reconsidered only after multiple successful Level 2 and Level 3 cycles with stable CI and no regressions.

## Mandatory guardrails

The following rules are mandatory for all Codex tasks:

- Do not read, display, source, or modify .env.
- Do not expose secrets, tokens, cookies, passwords, or API keys.
- Do not commit directly to main.
- Do not merge pull requests.
- Do not run destructive commands.
- Do not modify files outside the allowed scope.
- Do not expand the task without human approval.
- Keep branches small and auditable.
- Prefer one task, one branch, one PR.
- Add or update tests when implementation changes require it.
- Run required checks before commit when possible.
- Document any check that could not be run.
- Keep the human as final merge authority.

## Recommended Codex task flow

The standard Codex-only task flow is:

1. Human approves the task objective.
2. Codex Planner creates a task specification.
3. Human approves or edits the task specification.
4. Codex Implementer creates the implementation branch.
5. Codex Implementer modifies only allowed files.
6. Codex Implementer runs required checks.
7. Codex Implementer commits and opens a PR.
8. Codex Reviewer reviews the PR.
9. Codex Fixer addresses requested changes if needed.
10. Human and ChatGPT do final validation.
11. Human merges manually.

## Codex task specification format

Each Codex implementation task should include:

- task_id
- task_title
- objective
- business_context
- allowed_files
- forbidden_files
- forbidden_actions
- expected_changes
- acceptance_criteria
- required_checks
- rollback_plan
- review_focus
- output_required

Example fields:

- task_id: F92
- objective: Implement one approved ERP micro-feature.
- allowed_files: explicit list of paths or directories.
- forbidden_files: .env, secrets, unrelated modules.
- required_checks: backend tests, frontend checks, lint, build.
- rollback_plan: revert the PR branch if checks fail.
- review_focus: business rule, security, regression risk.

## Codex PR report format

Each Codex PR should include:

- Summary
- Changed files
- Tests run
- Checks passed
- Checks not run and why
- Risks
- Known limitations
- Security notes
- Rollback notes
- Reviewer focus
- Human validation required

## Quality gates

The expected quality gates are:

- Git status clean before starting.
- Dedicated branch.
- No direct main commit.
- No .env access.
- Scope matches the task specification.
- Tests run or explicitly documented as not run.
- Diff reviewed before commit.
- PR created against main.
- Human merge only.

When GitHub Actions are available, the PR should rely on CI checks as an independent quality gate.

## Codex prompt strategy

For documentation tasks:

- Use high reasoning.
- Ask for one expected file.
- Require ASCII-only text if encoding risk exists.
- Require no application code changes.
- Require PR creation.

For implementation tasks:

- Use high or very high reasoning.
- Provide the task specification.
- Require tests.
- Require a PR report.
- Forbid merge.
- Forbid .env access.
- Forbid broad refactors.

## First pilot sequence

The recommended sequence is:

- F89: document this Codex-only autonomous workflow.
- F90: add Codex task templates and prompt templates.
- F91: add or strengthen CI quality gates.
- F92: run first Codex-only implementation pilot on a small task.
- F93: run first Codex module-level implementation pilot after a module spec is approved.

## Explicit decision

Codex can be authorized to:

- Create branches.
- Modify scoped files.
- Run tests and checks.
- Commit changes.
- Push branches.
- Create pull requests.
- Review pull requests.
- Fix review comments.

Codex is not authorized to:

- Merge pull requests.
- Commit directly to main.
- Modify .env.
- Expose secrets.
- Change task scope without approval.
- Implement a full module without an approved module spec.

## Current operating mode until Codex quota resets

Until Codex is available again, ChatGPT and the human operator may prepare documentation and workflow scaffolding using the existing WSL logged-run method.

The current manual execution method remains:

- Use scripts/dev/erp-logged-run with heredoc input.
- Copy logs automatically to the Windows clipboard.
- Paste outputs back into ChatGPT.
- Review before commit.
- PR and merge remain manual.
