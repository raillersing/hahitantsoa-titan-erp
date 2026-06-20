# F153D - Backend Productivity and Skill Adoption

## Purpose

This audit defines a lightweight way to measure whether the backend workflow changes
delivered in F153A, F153B, and F153C actually improve Codex backend productivity,
validation quality, PR success, and merge reliability.

It exists to answer a narrow question:

- are backend tasks using the workflow guidance we added
- are those choices reducing rework and merge friction
- are we seeing safer, more reliable PRs without adding heavy process overhead

This is not a new process gate. It is a measurement aid for future backend bundles.

## Why This Exists Now

F153A added backend validation wrappers.
F153B added backend specialist skills.
F153C made the Backend Skill Plan mandatory in backend orchestration prompts.

At this point, the workflow has enough structure to measure adoption and outcomes. The
right next step is to observe whether agents actually use the guidance and whether that
correlates with fewer avoidable failures.

## What To Measure

For each backend PR, record the following:

- task ID and title
- agent used
- backend worktree and branch
- selected backend skills
- whether the Backend Skill Plan was present before coding
- whether selected skills were actually used
- local validation commands run
- focused validation result
- migration guard result, if applicable
- full backend CI wrapper result
- PR number
- PR CI first-pass result
- number of CI attempts before green
- merge SHA
- exact-SHA main CI result
- total elapsed time, if known
- blockers or hard stops
- rework reason, if any
- final outcome

Keep the data qualitative when a number is not available. The goal is comparison across
bundles, not perfect telemetry.

## How To Report It

After each backend PR finalizes, append a short backend productivity report to the PR
body or to the final repository-facing report.

Keep the report small and factual. Mention:

- what was worked on
- which skills were selected
- which validation wrappers were run
- whether PR CI passed first try
- whether the exact merged SHA was confirmed green on `main`
- whether any rework was required and why

## How To Interpret Results

Good outcome:

- small PR
- skill plan present
- relevant skills only
- focused tests used during development
- backend CI wrapper run before PR
- PR CI green first try or with an understood repair
- exact-SHA main CI green

Warning signs:

- all skills selected by default
- no skill plan
- migration guard skipped on model changes
- only focused pytest run before PR
- PR CI fails from a predictable local issue
- backend and frontend scope mixed

Do not optimize for raw speed alone. Do not reward large PRs. Do not treat PR count as
productivity. Prioritize merge reliability, safety, and reduced rework.

## Risks Of Bad Metrics

Bad metrics can create the wrong incentives. The main risks are:

- overvaluing PR count instead of safe delivery
- overvaluing speed instead of merge reliability
- rewarding large bundles that hide rework
- treating skill selection as success even when the skills were not used
- treating a green PR as success when exact-SHA main CI was never verified

If a metric is easy to game, it should not be treated as a success signal on its own.

## Minimal Future Report Template

```md
### Backend Productivity Report

- Task: F153X - Short title
- Agent: Agent A / Agent B / ...
- Worktree/branch: `...`
- Skills used: `...`
- Skill plan present before coding: yes/no
- Skills actually used: yes/no + short note
- Local validation: `...`
- Focused result: pass/fail
- Migration guard: pass/fail/n-a
- Backend CI wrapper: pass/fail
- PR: #123
- PR CI first pass: pass/fail
- PR CI attempts: 1/2/...
- Merge SHA: `...`
- Exact-SHA main CI: pass/fail
- Elapsed time: `...`
- Blockers/hard stops: `...`
- Rework reason: `...`
- Final outcome: `...`
```

## Reporting Pointer

Backend prompts and finalization reports should reference this audit when summarizing
workflow effectiveness, but they should not turn it into a new approval gate.
