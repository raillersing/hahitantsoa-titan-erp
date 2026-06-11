# Two-agent Codex workflow

## Purpose

The two-agent workflow separates implementation from critical review when an independent
quality check reduces meaningful risk. Human approval and Git operations remain mandatory.

This classic mode remains valid. For tasks changing business rules, permissions, transactions,
migrations, APIs or Hahitantsoa/Titan scope, use the orchestrated multi-agent mode documented in
[orchestrated-multi-agent-workflow.md](orchestrated-multi-agent-workflow.md).

## Agent A - Implementer

Agent A implements or documents only the human-approved plan.

Agent A may inspect approved sources, modify approved files, execute approved validations
through `scripts/dev/erp-logged-run`, and summarize the diff and residual risks.

Agent A must never access `.env`, expand scope, weaken business guards, or perform `git add`,
commit, push, PR creation or merge.

## Agent B - Reviewer/QA

Agent B performs an independent, critical review of the proposed change and its validation
evidence.

Agent B may review the diff, sources of truth and logs; verify scope, business rules, tests and
documentation; identify defects; and return `APPROVE`, `REQUEST CHANGES` or `BLOCK`.

Agent B must never silently implement fixes while acting as reviewer, access `.env`, perform
Git publication operations, or approve violations of validated Hahitantsoa or Titan rules.

## Recommended Workflow

1. The human approves the plan and scope.
2. Agent A performs the approved implementation or documentation.
3. Agent A executes validations with `scripts/dev/erp-logged-run`.
4. The human shares the diff and validation logs with Agent B.
5. Agent B performs critical review only.
6. The human decides whether changes are required.
7. The human performs commit, push and PR creation manually.
8. The human performs merge manually.
9. The human performs post-merge validation manually.

## When To Use One Agent

Use one agent for small, low-risk documentation corrections or narrow mechanical changes with
clear validation.

## When To Use Two Agents

Use two agents for business-rule decisions, models, migrations, transactions, permissions,
security, write APIs, persistent behavior, cross-scope behavior, broad integrations or large
diffs.

## Mandatory Guards

- Every agent terminal command must use `scripts/dev/erp-logged-run`.
- Agents must never access `.env` or expose secrets.
- Agents must never perform commit, push, PR creation or merge.
- Human validation remains mandatory before publication and after merge.
- Titan remains limited to `material`, `article` and `material_pack`.
- Titan must never include local, salle, lieu, venue, room, hall, ancillary service or event
  service.
- The first Hahitantsoa slice remains read-only discovery and planning until explicitly
  approved otherwise.
- Reviewers never apply silent corrections. Any correction requires a separate approved
  implementation action.
