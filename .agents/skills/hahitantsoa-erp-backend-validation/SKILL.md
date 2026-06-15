---
name: hahitantsoa-erp-backend-validation
description: Run approved Titan ERP backend validation through repo wrappers instead of host Python. Use when a Codex task needs backend quality checks, focused backend tests, or Compose-backed backend commands in this repository. Do not use for frontend-only or docs-only tasks, and do not bypass the project wrappers.
---

# Hahitantsoa ERP Backend Validation

Use this skill for backend validation only within approved backend scope.

## Workflow

1. Run the task-start baseline first if it has not already been run for the current task.
2. Use `scripts/dev/erp-backend-compose-ci` for Compose-backed backend commands.
3. Use `scripts/ci/backend-quality` for the standard backend quality gate.
4. Do not use host Python for backend Django tests or checks.
5. Stop if validation would require `.env`, secrets, unapproved migrations, or non-backend scope.

## References

- Read [references/backend-validation.md](references/backend-validation.md) for approved command examples.
- Use [scripts/dev/erp-backend-compose-ci](../../../../scripts/dev/erp-backend-compose-ci) for local Compose-backed checks.
- Use [scripts/ci/backend-quality](../../../../scripts/ci/backend-quality) for the standard backend quality gate.
