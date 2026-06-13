# F130E - Agent Adapter Contract

## 1. Status

F130E completes the workflow chain established by:

- F130A - automated ERP delivery workflow
- F130B - multi-agent delivery governance
- F130C - operational roadmap refresh and complex task policy
- F130D - specialized agent routing and business module matrix

F130E adds the adapter contract that allows the ERP workflow to use different
delivery and review agents without weakening scope control, validation, CI
waiting, conditional merge, security, or human decision authority.

## 2. Core principle

- The ERP workflow is tool-agnostic.
- Codex is one possible Delivery Agent, not the only one.
- Any agent must respect the same safety, scope, validation, and reporting
  contract.
- An agent that cannot satisfy the full contract may still be used, but only
  with reduced authority.
- The ERP Task Orchestrator selects the agent according to declared
  capabilities and the risk level of the task.

## 3. Agent Adapter Registry

| Adapter / Agent tool | Runtime type | Can inspect repo | Can modify repo | Can run local tests | Can create PR | Can wait PR CI | Can merge | Can wait main CI | Allowed task levels | Default authority | Human approval required |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Codex Delivery Agent | repository-connected coding agent | yes | yes | yes | yes | yes | yes | yes | T0-T4 by workflow, never T5 full-auto | A4 | yes for T5 and any stop-condition escalation |
| GitHub Copilot coding agent | IDE or GitHub-integrated coding agent | yes if repo access exists | yes if write mode exists | maybe, depends on runtime | maybe | maybe | maybe | maybe | T0-T3 only if capabilities are proven | A2 or A3 by default | yes unless full A3/A4 capabilities are proven |
| Claude Code / CLI coding agent | CLI coding agent | yes | yes | yes if local runtime exists | yes if GitHub CLI access exists | yes if CLI/network access exists | maybe | maybe | T0-T4 if validated in context | A2 or A3 by default | yes before any A4-equivalent use |
| Aider / local coding agent | local CLI patch agent | yes | yes | yes if local runtime exists | maybe | maybe | no by default | no by default | T0-T3 when local validation is reliable | A2 by default | yes for PR or merge steps |
| Cursor-style IDE agent | IDE-integrated coding agent | yes | yes | maybe | maybe | maybe | maybe | maybe | T0-T3 if capabilities are explicit | A1 or A2 by default | yes unless delivery capabilities are explicitly proven |
| Review-only agent | review assistant | yes | no | no | no | no | no | no | T0-T5 as advisory only | A0 | no for advice, yes for acting on findings |
| Security review agent | security-focused reviewer | yes | no by default | maybe read-only validation | no | no | no | no | T1-T5 as review support | A0 | no for review, yes for any implementation change |
| QA/test-only agent | validation-focused agent | yes | no by default | yes | no | no | no | no | T0-T5 as quality support | A0 or A1 | no for review, yes for delivery authority |
| Human expert / Agent B | human review authority | yes | maybe if acting directly | maybe | maybe | maybe | maybe | maybe | T0-T5, depending on human role | advisory or approval authority outside A0-A5 automation levels | always human-owned by definition |

This registry is conceptual. It does not claim that every listed tool is
installed in this repository. It defines the minimum capabilities and possible
authority that the orchestrator may recognize.

## 4. Authority levels

### A0 - Advisory only

The agent may:

- read
- analyze
- recommend
- produce a plan
- produce a report

The agent may not:

- modify the repository
- commit
- push
- create a PR
- merge

### A1 - Patch proposal only

The agent may:

- propose a patch
- produce a diff
- suggest tests

The agent may not:

- apply changes without validation
- commit
- push
- merge

### A2 - Local implementation

The agent may:

- modify approved files
- run local validation
- produce a summary

The agent may not:

- push
- create a PR
- merge

### A3 - PR delivery

The agent may:

- create a branch
- modify files
- run tests
- commit
- push
- create a PR
- wait for PR CI

The agent may not merge.

### A4 - Conditional merge delivery

The agent may:

- do everything allowed in A3
- merge if the PR is green and `MERGEABLE`
- wait for post-merge `main` CI
- clean up local and remote branch state

This is the authority currently granted to Codex for workflow-authorized tasks.

### A5 - Production-sensitive authority

Full automation is forbidden.

Any task touching production, secrets, sensitive data, real deployment, or a
critical environment requires the Human Owner.

## 5. Capability declaration template

```text
Agent adapter:
Tool/runtime:
Mode: advisory / patch / local implementation / PR delivery / conditional merge
Can inspect repository: yes/no
Can modify repository: yes/no
Can run local validation: yes/no
Can run backend quality gate: yes/no
Can run frontend validation: yes/no
Can create branch: yes/no
Can commit: yes/no
Can push: yes/no
Can create PR: yes/no
Can wait PR CI: yes/no
Can merge PR: yes/no
Can wait main CI: yes/no
Can cleanup branches: yes/no
Allowed task levels: T0/T1/T2/T3/T4/T5
Forbidden scopes:
Required human approval points:
Required output format:
Known limitations:
```

## 6. Minimum contract for PR delivery agents

An A3 or A4 agent must:

- start from clean `main`
- verify the expected baseline HEAD
- create a dedicated branch
- respect approved file scope
- stop before any destructive operation unless the workflow explicitly allows it
- never touch `.env`, secrets, or out-of-scope files
- produce logs or an auditable summary
- run the required local validations
- wait for the explicit final PR CI result
- never treat `queued`, `pending`, or `in_progress` as success
- diagnose red CI using logs
- apply the 3-failure rule
- produce a complete final summary

## 7. Minimum contract for conditional merge agents

An A4 agent must also:

- verify that the PR is green
- verify that the PR is `MERGEABLE`
- merge only when scope is still respected
- wait for post-merge `main` CI
- stop immediately if `main` CI fails
- prune and clean branch state
- verify final `git status --short`
- provide the final `main` HEAD

## 8. Agent eligibility by T0-T5

| Task level | Minimum agent authority | Merge allowed | Human approval |
| --- | --- | --- | --- |
| T0 docs-only | A3 or A4 | yes if A4 and CI is green | optional |
| T1 infra/test/CI | A3 or A4 | yes if A4 and CI is green | optional unless CI or secret risk appears |
| T2 bounded backend business without migration | A3 or A4 | yes if tests and CI are green | optional unless ambiguity appears |
| T3 backend with model, migration, or API | A3 or A4 | conditional | Agent B recommended |
| T4 complex documents, payments, RBAC, or lifecycle domain work | A3 or A4 | conditional | Agent B strongly recommended |
| T5 production, secrets, or sensitive data | advisory or local only | no full-auto merge | Human Owner mandatory |

## 9. Adapter selection rules

The ERP Task Orchestrator should choose the delivery adapter according to:

- task level T0-T5
- affected business modules
- approved file scope
- proven agent capabilities
- ability to run the required tests
- ability to create and monitor PR CI
- ability to merge and wait for `main` CI
- business and security risk
- Agent B availability

Rules:

- if the agent cannot run tests, it cannot hold A3 or A4 authority on a backend
  task
- if the agent cannot wait for CI, it cannot merge
- if the agent cannot produce an auditable summary, it cannot serve as Delivery
  Agent
- if the agent has no repository access, it is advisory only
- if the agent cannot respect approved file scope, stop
- if the agent operates through an external UI without reliable logs, reduce its
  authority

## 10. Handoff between agents with adapters

1. The source agent produces its report.
2. The orchestrator validates the report.
3. The orchestrator chooses the target agent.
4. The target agent receives:
   - objective
   - baseline
   - approved files
   - stop conditions
   - required validations
   - prior decisions already taken
   - authority limits
5. The target agent confirms or executes according to its authority.
6. The orchestrator retains the handoff trace in the summary or an audit note.

## 11. Failure and downgrade policy

If an agent fails or cannot satisfy the contract:

- downgrade its authority
- switch to advisory-only if needed
- transfer execution to another agent
- request the Human Owner if business or security risk appears
- stop after 3 mechanical failures
- never continue to merge if the agent has not awaited final CI results

Examples:

- an agent can code but cannot create a PR: A2 only
- an agent can create a PR but cannot watch CI: incomplete A3, merge forbidden
- a security review-only agent: advisory only
- a CLI agent that can produce only a patch without logs: patch proposal only
- an agent that violates scope: immediate stop

## 12. Output contract

Every agent must produce a summary appropriate to its authority.

For A0 and A1:

- findings
- risks
- recommended changes
- stop conditions
- whether the Delivery Agent may proceed

For A2:

- files changed
- local validations executed
- test pass or fail state
- remaining steps

For A3:

- branch
- commit
- PR URL
- PR CI status
- files changed
- validations
- remaining merge decision

For A4:

- branch
- commits
- PR URL
- merge yes or no
- final `main` HEAD
- PR CI result
- `main` CI result
- cleanup status
- files changed
- logs
- roadmap impact
- next recommended task

## 13. Integration with existing docs

- F130B defines the general governance model
- F130C defines the T0-T5 task policy
- F130D defines specialized agents and business-module routing
- F130E defines how different tools or agents attach to that governance model

## 14. Stop conditions specific to the Agent Adapter Contract

Stop immediately when:

- an agent claims authority it cannot prove
- an agent cannot execute the required validations
- an agent cannot wait for CI but still attempts to merge
- an agent modifies files outside scope
- an agent hides logs or results
- an agent cannot produce an auditable summary
- an agent touches secrets or production without the Human Owner
- an agent bypasses required Agent B review
- an agent ignores a stop condition already defined by F130B, F130C, or F130D
