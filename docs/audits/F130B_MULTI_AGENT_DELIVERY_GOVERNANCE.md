# F130B - Multi-agent delivery governance

## 1. Agent 0 - ERP Task Orchestrator / Program Orchestrator

Role:

- direct progressive ERP finalization from the real repository state;
- maintain the operational finalization roadmap across backend, frontend,
  documents, payments, permissions, quality, and production preparation;
- transform the roadmap into small, verifiable, mergeable, ordered tasks;
- decide which task should run next based on business value, dependencies, and
  risk;
- generate the full bounded Codex prompt for each task;
- determine whether a task can run under full Codex autonomy through final
  merge plus green `main` CI;
- determine whether Agent B / independent review is mandatory before merge;
- prevent loops, duplicate tasks, regressions, and out-of-scope changes;
- produce or update progress state after each merge.

Authority:

The ERP Task Orchestrator has coordination authority, not absolute business
authority.

It may:

- propose the next task;
- split work into smaller tasks;
- select the appropriate workflow;
- authorize Codex to execute the full loop when the task is bounded;
- require a non-mutating inspection;
- require Agent B review;
- stop a task when stop conditions are met.

It must not decide alone:

- a major business change;
- a major architecture change;
- a product arbitration;
- a business-priority change;
- a quality-vs-speed compromise;
- a security-rule change;
- work involving secrets, production, or sensitive data.

## 2. Human Owner / Product Decision Owner

Role:

- define business priorities;
- approve product, architecture, scope, or risk decisions;
- delegate full execution to Codex when appropriate;
- take over when Codex or the orchestrator reaches a stop condition.

Reserved decisions:

- business ambiguity;
- scope change;
- major architecture change;
- quality/delivery tradeoff;
- risky merge;
- secrets, security, or sensitive data;
- post-merge `main` CI failure;
- business-priority change.

## 3. ChatGPT Supervisor / Workflow Orchestrator

Role:

- prepare Codex prompts;
- define scope;
- control the decision chain;
- interpret logs pasted by the user;
- propose next tasks;
- retain the validated workflow rules;
- never invent repository state without logs or repository evidence.

Responsibilities:

- recommend a non-mutating inspection when needed;
- verify that scope remains small and controlled;
- decide when human input is required;
- restate immediate stop rules;
- avoid oversized or mixed tasks;
- avoid implicit business decisions.

## 4. Codex Delivery Agent

Role:

- execute one precise task in the repository;
- go through final merge plus green `main` CI when the workflow allows it;
- apply mechanical corrections up to 3 attempts maximum;
- produce a final summary with logs, PR, commit, CI, merge, and final state.

Codex is authorized to:

- create a branch from clean `main`;
- implement only within approved scope;
- run local validations;
- fix format/lint/mechanical test issues;
- commit;
- push;
- create a PR;
- wait for PR CI;
- merge if the PR is green and `MERGEABLE`;
- wait for post-merge `main` CI;
- prune/clean branches;
- produce the final summary.

Codex must use:

- `scripts/dev/erp-logged-run <task-name> <<'EOF' ... EOF`
- `bash scripts/ci/backend-quality`
- `docker compose --profile test run --rm backend-test`
- `gh pr checks \"$PR_NUMBER\" --watch --fail-fast --interval 10`
- `gh run watch \"$RUN_ID\" --exit-status`
- `gh run view \"$RUN_ID\" --log-failed` on CI failure
- `gh pr merge \"$PR_NUMBER\" --merge --delete-branch` only if green and
  mergeable

Codex must never treat `queued`, `pending`, or `in_progress` as success or
failure. It must wait for an explicit final result.

Observed CI durations:

- `Frontend quality`: about 20-25s when green;
- `Backend quality`: about 1m40-1m55 when green.

## 5. Agent B / Independent Reviewer

Role:

- provide independent review when useful, especially for sensitive domain work;
- validate scope and architecture coherence;
- be temporarily replaced by explicit ChatGPT/Codex review if quota is
  unavailable, but that substitution must be stated.

Recommended for:

- models/migrations;
- public API;
- permissions/RBAC;
- payments;
- runtime documents;
- reservation lifecycle;
- cross-cutting changes;
- non-trivial refactors.

Optional for:

- docs-only tasks;
- small tests;
- mechanical CI fixes;
- README/audit docs;
- simple infra scripts already validated by CI.

## 6. Decision chain

1. The Human Owner defines the business goal or priority.
2. The ERP Task Orchestrator identifies the next useful task from the real
   project state.
3. The ChatGPT Supervisor turns that task into a bounded prompt with scope,
   allowed files, and stop conditions.
4. The Codex Delivery Agent executes through final merge if everything stays
   green, mergeable, and in scope.
5. Agent B intervenes if the task is sensitive or the workflow requires it.
6. PR CI must be green before merge.
7. `main` CI must be green after merge.
8. If a stop condition appears, Codex stops and reports the state.
9. After merge plus green `main` CI, the orchestrator evaluates roadmap impact
   and recommends the next task.

## 7. Project finalization mode

Full ERP finalization must not be one giant Codex mission.

It must run in cycles:

1. read the real repository state;
2. identify the next priority task;
3. define strict scope;
4. launch the Codex Delivery Agent;
5. wait for local validation;
6. wait for PR CI;
7. merge if green and mergeable;
8. wait for `main` CI;
9. clean up;
10. evaluate roadmap impact;
11. update roadmap if needed and allowed;
12. recalculate the next task.

## 8. Immediate stop conditions

Codex must stop immediately if:

- an out-of-scope file changes;
- `.env`, a secret, or a credential is touched;
- an unexpected migration appears;
- a real Git conflict appears;
- the PR is not `MERGEABLE`;
- CI is red and the cause is not clearly understood;
- `main` CI is red after merge;
- a business decision is needed;
- an unplanned architecture change appears;
- a test fails without a clear mechanical cause;
- destructive behavior or sensitive data risk appears;
- scope becomes doubtful.

The orchestrator must also stop and request a human decision if:

- the roadmap is ambiguous;
- two possible tasks have unclear ordering;
- a task becomes too large;
- a business dependency is missing;
- the actual scope differs from the planned scope;
- a product decision is required;
- an architecture decision is required;
- the task requires production access, secrets, or sensitive data;
- Codex fails 3 times on test, validation, pull/sync, or merge;
- `main` CI fails after merge.

## 9. Three-failure rule

Codex may attempt up to 3 corrections only for:

- format/lint;
- targeted mechanical test issues;
- missing import;
- temporary push issue;
- too-short GitHub run wait;
- pull/sync timing/network issue;
- non-destructive quoting issue.

After 3 consecutive failures on test, validation, merge, or pull/sync, Codex
must stop and request intervention.

## 10. Merge authority

Codex has conditional execution authority, not absolute product authority.

Codex may merge only if:

- scope is respected;
- no forbidden file is touched;
- local validations passed;
- PR CI is green;
- PR is `MERGEABLE`;
- no stop condition is active;
- the task belongs to a workflow-authorized category;
- post-merge `main` CI will be monitored;
- no business, architecture, or security decision is required.

## 11. Task classes

| Task class | Merge autonomy |
| --- | --- |
| Docs-only | Codex may go through final merge. |
| Infra/test/CI | Codex may go through final merge if CI is green. |
| Backend business without migration | Full autonomy is possible if scope, tests, and CI stay green. |
| Backend with migration/model | Full autonomy is possible only when migrations are expected, tests are complete, CI is green, and no business doubt remains. |
| API/RBAC/payment/runtime documents | Agent B strongly recommended before merge. |
| Frontend UI | Autonomy possible if tests/build are green; stop on UX or business ambiguity. |
| Production/deploy/secrets/sensitive data | Human intervention mandatory. |

## 12. Continuous roadmap update / Roadmap State Keeper

The ERP Task Orchestrator is also responsible for maintaining the operational
finalization roadmap state.

After each merged task with green `main` CI, the orchestrator must evaluate
whether the finalization roadmap should be updated.

Roadmap update is mandatory if the task:

- completes a business capability;
- adds or changes a backend/frontend foundation;
- changes task dependencies;
- changes the risk level;
- unlocks a next task;
- makes a planned task obsolete;
- changes the recommended order of next tasks;
- introduces a new technical or quality constraint.

Roadmap update is optional if the task is purely mechanical and does not change
finalization state, for example:

- formatting correction;
- small CI fix;
- minor documentation without roadmap impact;
- cleanup without functional change.

Roadmap updates must stay short and operational. They should record:

- completed task;
- impact on global state;
- unlocked tasks;
- remaining risks;
- recommended next task;
- whether Agent B is needed;
- qualitative class: docs-only, infra, backend business, frontend, payment,
  runtime document, production.

The roadmap must not become a verbose journal. Logs stay in `logs/terminal/`;
the roadmap remains a decision tool.

## 13. Roadmap update authority

Codex may update the roadmap in the same PR only if:

- the task explicitly requires it; and
- the roadmap file is in the allowed scope.

Codex must not update the roadmap if:

- the roadmap file is not authorized;
- the task is too ambiguous;
- the ordering of next tasks needs a human decision;
- a business priority must be arbitrated;
- the update would broadly rewrite project strategy.

## 14. Recommended roadmap file policy

F128 remains the initial strategic application-wide finalization snapshot.

Continuous updates should either:

- be added to a dedicated operational document, if one exists;
- be handled in a dedicated roadmap-refresh task;
- or be explicitly included in the scope of a business PR when the impact is
  direct and clear.

The orchestrator should avoid large roadmap rewrites in business PRs. Prefer
short, dated, verifiable deltas tied to `main` after merge.

## 15. Expected summary after each orchestrated cycle

After each merged task, the orchestrator should produce:

- completed task;
- PR;
- commit;
- final `main` HEAD;
- PR CI;
- `main` CI;
- modified files;
- roadmap impact;
- roadmap updated: yes/no;
- justification if no;
- recommended next task;
- whether Agent B is needed for that next task.

## 15.1 Pointer to F130C

F130C defines the operational roadmap delta, the complex task policy, and the
T0-T5 execution levels.

F130D defines the specialized agent routing matrix, business module agents, the
handoff contract, and module-level agent requirements.

F130E defines the Agent Adapter Contract used to connect Codex or any other
delivery or review agent to the ERP governance workflow with explicit authority
levels and validation requirements.
