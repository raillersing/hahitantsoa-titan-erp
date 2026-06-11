# Orchestrated multi-agent Codex workflow

## Purpose

This workflow lets one approved prompt coordinate several bounded specialist reviews while
preserving strict scope, traceable validation and a human merge decision.

It complements the classic two-agent workflow. It does not authorize autonomous publication or
silent reviewer fixes.

## When to use each mode

### Classic two-agent mode

Use the classic mode when independent implementation and review are sufficient:

1. Agent A implements or documents the approved scope.
2. Agent B reviews without changing files.
3. The human decides whether corrections, commit, push, PR and merge are allowed.

### Orchestrated multi-agent mode

Use this mode when the task changes or reviews:

- business rules or validated invariants;
- permissions or security;
- transactions or concurrency;
- models or migrations;
- APIs or write behavior;
- Hahitantsoa/Titan scope or cross-scope behavior.

The orchestrated mode may also be selected for broad or high-risk audits.

## Mandatory prompt contract

One orchestrator prompt must include:

- expected branch;
- approved scope and allowed files;
- forbidden files and behavior;
- specialist subagent roles;
- required verdict format;
- required validations;
- prohibition of `.env` access and secret exposure;
- prohibition of commit, push and PR creation unless explicitly authorized;
- explicit statement that merge remains human;
- recovery rule for an accidental direct terminal command.

Every important terminal command must use stdin/heredoc:

```sh
scripts/dev/erp-logged-run <task-name> <<'EOF'
<commands>
EOF
```

Do not invoke the wrapper with `bash -c`. If an important command runs directly by accident,
the orchestrator must stop, report the deviation, run a journaled recovery validation, and
continue only after confirming branch, status and scope.

## Required subagents

### Domain/Business reviewer

Checks:

- validated decisions, ADRs and invariants;
- Titan limited to `material`, `article` and `material_pack`;
- Hahitantsoa/Titan separation and approved shared concepts;
- absence of unapproved commercial or cross-scope behavior.

Output:

- confirmed conformities;
- findings ordered by severity;
- business-rule verdict.

### Technical reviewer

Checks:

- architecture and established project patterns;
- implementation behavior, tests and CI evidence;
- transaction, permission, migration and API implications;
- missing or weak validations.

Output:

- technical findings ordered by severity;
- missing validation evidence;
- technical verdict.

### Scope/Security reviewer

Checks:

- active branch and approved file scope;
- forbidden files and forbidden behavior;
- wrapper use and recovery evidence;
- absence of `.env` access, secret exposure and unauthorized Git publication.

Output:

- changed-file assessment;
- command and secret-safety assessment;
- scope/security verdict.

### Consolidator

The Consolidator merges specialist findings, removes duplicates and resolves contradictions by
using repository sources of truth.

Output exactly one final verdict:

- `APPROVE`: no blocking or required correction remains;
- `REQUEST_CHANGES`: scoped corrections are required;
- `BLOCK`: progress requires human decision, broader scope or resolution of a critical conflict.

The Consolidator must list required corrections separately from optional recommendations.

## Correction policy

Reviewer subagents never modify files or apply silent corrections.

The orchestrator may apply a correction only when all conditions are true:

1. the Consolidator explicitly requests it;
2. the correction is inside the approved scope;
3. no forbidden file or behavior is involved;
4. the correction is minimal and does not introduce a new decision;
5. the relevant validations can be rerun.

Otherwise the orchestrator must return `REQUEST_CHANGES` or `BLOCK` and wait for human approval.

After an allowed correction, all affected specialist checks and the Consolidator verdict must
run again.

## Final orchestrator report

The final report must include:

- assigned subagents and bounded roles;
- specialist findings;
- consolidated verdict;
- corrections applied or confirmation that none were applied;
- modified files and scope confirmation;
- validations and terminal log locations;
- residual risks and human decisions required;
- confirmation of no unauthorized commit, push, PR or merge.

## Reusable orchestrator prompt

```text
You are Codex Orchestrator for Hahitantsoa/Titan ERP.

Task: Fxx - <name>
Expected branch: <branch>
Approved scope: <allowed files and behavior>
Forbidden scope: <forbidden files and behavior>

Create and assign these bounded subagents:
- Domain/Business reviewer;
- Technical reviewer;
- Scope/Security reviewer;
- Consolidator.

Reviewer subagents must not modify files.
The Consolidator must return APPROVE, REQUEST_CHANGES or BLOCK.
Apply a correction only when requested by the Consolidator, minimal, inside approved scope and
outside forbidden files. Rerun affected reviews after any correction.

Use scripts/dev/erp-logged-run with stdin/heredoc for every important terminal command.
If a direct command runs accidentally, stop, report it and perform a logged recovery validation.
Never access .env or expose secrets.
Do not commit, push, create a PR or merge unless explicitly authorized.
Merge remains human.

Return the specialist findings, consolidated verdict, corrections, changed files, validation
logs, residual risks and required human decisions.
```
