# Pursue Goal Contract

## Template

Use this template when Codex is allowed to continue iterating toward a measurable goal.

```text
Goal statement:
<what must become true>

Worktree:
<single approved worktree>

Branch:
<single approved branch>

Scope allowed:
<files or globs>

Scope forbidden:
<files or globs>

Outcome:
<measurable end condition>

Verification surface:
<commands, CI, checks, visual verification, docs inspection>

Constraints:
<safety, policy, architecture, secret rules>

Boundaries:
<what must not be changed or invented>

Iteration policy:
<how far the agent may continue before stopping>

Stop conditions:
<when the agent must stop and escalate>

Required final report:
<exact output sections>

Human approval gates:
<commit, push, PR, merge, cleanup, branch deletion>
```

## Example - Backend F135B

- Goal statement: deliver the bounded private reservation confirmation API slice
- Worktree: backend worktree only
- Branch: `feat/f135b-reservation-confirmation-private-api`
- Scope allowed: `backend/**`, `tests/backend/**`, approved backend audits
- Scope forbidden: `frontend/**`, `.github/**`, `.env`, unrelated docs
- Outcome: API slice implemented and validated
- Verification surface: backend static checks, focused tests, PR CI
- Constraints: no secret access, no unapproved lifecycle expansion
- Boundaries: no frontend work, no finance workflow, no auth scope broadening
- Iteration policy: continue until the bounded API objective is satisfied or blocked
- Stop conditions: wrong worktree, scope expansion, repeated failing repair cycles
- Required final report: branch, commit, PR, checks, findings, risks, no merge
- Human approval gates: commit, push, PR yes only when authorized; merge no

## Example - Frontend F137C

- Goal statement: deliver the next bounded frontend slice after F137B
- Worktree: frontend worktree only
- Branch: approved frontend task branch
- Scope allowed: `frontend/**`, approved frontend audits
- Scope forbidden: backend, scripts, workflows, `.env`
- Outcome: UI slice delivered against approved backend contract
- Verification surface: tests, build, PR CI
- Constraints: no invented endpoint, no public artifact URL exposure
- Boundaries: no backend edits, no commercial workflow broadening
- Iteration policy: continue until bounded UI outcome is complete or blocked
- Stop conditions: backend change required, contract ambiguity, scope conflict
- Required final report: branch, commit, PR, tests/build, findings, risks, no merge
- Human approval gates: commit, push, PR yes only when authorized; merge no

## Example - Docs-Only Task

- Goal statement: update approved agent docs
- Worktree: docs worktree only
- Branch: approved docs branch
- Scope allowed: approved docs files only
- Scope forbidden: backend, frontend, scripts, workflows, `.env`
- Outcome: docs complete and internally consistent
- Verification surface: `git diff --check`, reference checks, PR CI if applicable
- Constraints: no secret material, no code changes
- Boundaries: no scope expansion outside docs
- Iteration policy: continue until docs are complete or blocked by source ambiguity
- Stop conditions: overlap with another docs agent on shared index files
- Required final report: files changed, validations, PR, remaining limits, no merge
- Human approval gates: commit, push, PR yes only when authorized; merge no

## Example - Review-Only Task

- Goal statement: produce a bounded independent review
- Worktree: relevant task worktree or read-only inspection context
- Branch: PR branch under review
- Scope allowed: inspection only
- Scope forbidden: any file mutation
- Outcome: findings and verdict delivered
- Verification surface: diff, docs, tests, CI evidence
- Constraints: non-mutating, no secret exposure
- Boundaries: no edits, no commit, no push, no merge
- Iteration policy: stop after findings are complete
- Stop conditions: missing evidence, scope ambiguity, secret-like material
- Required final report: findings, verdict, residual risks, no edits performed
- Human approval gates: no mutation authorized
