# Official AI agent workflow

This directory is the only official detailed agent system for Hahitantsoa/Titan ERP.
`AGENTS.md` remains the concise source of truth.

## Execution model

Use native Codex subagents when available. Assign only the roles needed by the task and
give each role a bounded inspection or implementation scope. If native subagents are
unavailable, execute the same roles sequentially.

Reviewers never apply silent corrections. They return findings with severity, evidence,
and a verdict. The implementer fixes valid findings inside the approved scope before
commit. The human decides merge.

When native subagents are unavailable, simulate the required workflow sequentially:

1. Agent A or Agent FE-A implements.
2. Agent B or Agent FE-B performs an independent review.
3. Agent C or Agent FE-D reviews tests and failure modes.
4. Agent D or Agent FE-F checks architecture and scope.
5. Agent E checks migrations and data integrity when relevant.
6. Agent F checks documentation and status.
7. The implementer fixes valid findings inside the approved scope.
8. The final report lists findings, resolutions, validations, and residual risks.

## Official roles

Backend roles:

- Agent A - Backend Implementer
- Agent B - Independent Backend Reviewer
- Agent C - Test and Failure-Mode Reviewer
- Agent D - Architecture and Scope Guardian
- Agent E - Migration and Data Integrity Reviewer
- Agent F - Documentation and Status Reviewer

Frontend roles:

- Agent FE-A - Frontend Implementer
- Agent FE-B - UI/UX Reviewer
- Agent FE-C - Accessibility Reviewer
- Agent FE-D - Frontend Test Reviewer
- Agent FE-E - API Contract Integration Reviewer
- Agent FE-F - Frontend Scope Guardian

## Required documents

- [Backend agent template](backend-agent-template.md)
- [Frontend agent template](frontend-agent-template.md)
- [PR quality gates](pr-quality-gates.md)
- [Task prompt template](task-prompt-template.md)
- [Skill improvement loop](skill-improvement-loop.md)

## Minimum flow

1. Verify baseline, branch, status, scope, and forbidden files.
2. Select required roles in the task prompt.
3. Implement the approved scope.
4. Run focused checks and inspect the diff.
5. Run independent reviewer roles.
6. Fix valid findings without broadening scope.
7. Commit, push, and open a PR only when authorized.
8. Verify CI before human merge.
9. Validate `main` after merge.
10. Capture durable workflow improvements in a later small PR.

## Replaced guidance

F121E-0 replaces the previous competing Codex, two-agent, orchestrator, Aider/Gemini,
and F113 workflow definitions. Git history remains the recovery source; obsolete
definitions are not archived in the working tree.

Task-specific audits and roadmap records may retain historical agent labels as evidence.
Those labels are not reusable workflow policy and do not override this directory.
