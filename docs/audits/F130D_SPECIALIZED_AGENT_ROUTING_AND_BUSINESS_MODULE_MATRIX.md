# F130D - Specialized agent routing and business module matrix

## 1. Status

F130D completes the governance chain established by:

- F130A - automated ERP delivery workflow
- F130B - multi-agent delivery governance
- F130C - operational roadmap refresh and complex task policy

F130D adds the specialized agent registry and the routing matrix that tells the
ERP Task Orchestrator which agents should be called for each business module,
task class, and T0-T5 execution level.

## 2. Operating principle

- The ERP Task Orchestrator remains the supervising role.
- The Codex Delivery Agent remains the primary execution role.
- Specialized agents are bounded roles used for review, analysis, planning, or
  specialized execution support.
- They may be used inside one structured Codex prompt or across separate prompts
  when the task is complex.
- Specialized agents never replace the Human Owner for business decisions,
  architecture decisions, security decisions, prioritization, or production
  decisions.

## 3. Agent registry

| Agent | Domain | Primary responsibility | Typical modules/files | When the orchestrator calls it | Level | Specific stop condition |
| --- | --- | --- | --- | --- | --- | --- |
| Agent 0 - ERP Task Orchestrator / Program Orchestrator | Workflow governance | Select the next bounded task and control the delivery chain | audits, plans, prompts, PR workflow | Every non-trivial task | Required | Task ordering is ambiguous or scope cannot stay bounded |
| ChatGPT Supervisor / Workflow Orchestrator | Prompt governance | Build the bounded task prompt and keep the workflow coherent | prompts, summaries, logs, audit notes | When the task needs structured execution control | Required | Repository evidence is missing or workflow authority is unclear |
| Codex Delivery Agent | Delivery execution | Implement the approved slice and carry validation through merge when authorized | task-scoped code or docs | Every delivery task | Required | Scope drift, forbidden files, failed quality gates, or mergeability issues |
| Agent B - Independent Reviewer | Independent review | Review architecture, scope, risks, and correctness independently | sensitive backend/frontend/docs diffs | Sensitive T3-T5 work or when explicitly requested | Recommended or required by policy | A blocking review finding remains unresolved |
| Backend Domain Agent | Backend domain logic | Verify service boundaries, models, selectors, transactions, and API behavior | `backend/apps/**`, backend tests | Backend business tasks | Required for backend tasks | Backend change requires a broader architectural rewrite |
| Frontend Business Flow Agent | Frontend UX and flow | Verify business flow coherence, UI state, and frontend boundaries | `frontend/src/**`, frontend tests | Frontend tasks or mixed UI tasks | Required for frontend tasks | UI flow implies unapproved business behavior or broad refactor |
| QA/Test Agent | Validation and failure modes | Define and assess focused tests, regressions, and quality gates | tests, CI outputs, validation commands | Every non-trivial task | Required | Required tests are missing, weak, or failing |
| Security/RBAC/Audit Agent | Access and sensitive writes | Verify permissions, data access, audit, attribution, and sensitive action boundaries | auth, permissions, audit, sensitive services, API access | API, RBAC, audit, payments, document access, sensitive lifecycle writes | Recommended or required by task class | Sensitive access is under-specified or unsafe |
| DevOps/CI Agent | Validation infrastructure | Verify local/CI commands, workflow reliability, and containerized checks | CI scripts, compose validation paths, workflow run expectations | Infra, CI, test workflow, delivery automation tasks | Required for T1 infra/CI tasks | Validation workflow is unreliable or green status cannot be trusted |
| Documentation/Roadmap Agent | Project documentation | Keep audits, roadmaps, runbooks, and post-merge deltas coherent | audits, README, runbooks, plans | Docs-only tasks and post-merge updates | Required for T0 docs-only tasks and roadmap deltas | Documentation contradicts current code, decisions, or audits |
| Data Migration/Import Agent | Data movement | Review imports, bulk changes, mapping rules, and migration safety | migrations, import helpers, spreadsheets, seed/import docs | Data import, migration, bulk backfill work | Recommended or required by context | Data mapping or migration assumptions are unverified |
| Production Readiness Agent | Production operations | Review deployment, observability, rollback, and production safety | deploy docs, CI/CD, ops runbooks | Production-sensitive or T5 tasks | Required for T5 tasks | Production or secret-handling risk appears |
| Business Specification Agent - Documents A/B Guardian | Business source-of-truth guard | Enforce business rules and A/B document alignment | business rules, decisions, A/B documents, audits, affected modules | Any task with business scope | Required for T2-T5 business tasks | Business rule ambiguity or Titan/Hahitantsoa boundary drift appears |
| Titan Commercial Chain Agent | Titan commercial workflow | Guard Titan quotation, commercial docs, customer-to-document chain, and rental-only commercial rules | billing, documents, customers, reservations | Document, payment, commercial chain, or pricing-adjacent tasks | Required when Titan commercial chain is touched | Task drifts into unapproved commercial or non-rental scope |
| Inventory & Asset Agent | Inventory operations | Guard inventory kinds, availability, asset handling, and Titan-only inventory rules | `backend/apps/inventory/**`, related tests | Inventory or asset tasks | Required for inventory tasks | Non-Titan inventory kinds or unapproved asset rules appear |
| Customer/CRM Agent | Customer domain | Guard customer data flow, CRM boundaries, and customer-facing dependencies | `backend/apps/customers/**`, related docs/tests | Customer and CRM tasks | Required for customer tasks | Customer scope expands into unapproved commercial or privacy-sensitive behavior |
| Reservation Lifecycle Agent | Reservation workflow | Guard draft, preflight, confirmation, cancellation, and lifecycle invariants | `backend/apps/reservations/**`, reservation tests | Reservation lifecycle tasks | Required for reservation tasks | Lifecycle change weakens invariants or introduces unapproved writes |
| Documents Runtime Agent | Runtime document generation | Guard runtime document generation, storage, access, and contract output boundaries | `backend/apps/documents/**`, document tests | Document generation, storage, or access tasks | Required for document runtime tasks | Runtime document scope expands into external provider or unsafe access |
| Payments/Billing/Cashbox Agent | Money handling | Guard deposits, payments, billing foundations, and cashbox boundaries | billing/payment modules, docs, tests | Payment/deposit/billing tasks | Required for payment tasks | Task expands into provider integration or accounting beyond approved scope |
| Logistics/Delivery/Return Agent | Physical operations | Guard dispatch, delivery, return, and logistical status boundaries | logistics modules, inventory/reservation integration | Logistics, return, or delivery tasks | Required for logistics tasks | Logistics task requires unapproved operational workflow or cross-domain rewrite |
| Hahitantsoa Domain Agent | Hahitantsoa business domain | Guard Hahitantsoa-specific concepts and the separation from Titan | `backend/apps/hahitantsoa/**`, Hahitantsoa docs/tests | Hahitantsoa tasks or shared concept tasks | Required for Hahitantsoa tasks | Shared concept work collapses the Titan/Hahitantsoa boundary |

## 4. Business Specification Agent - Documents A/B Guardian

This is the most important business guard role.

Its job is to:

- verify that each task remains aligned with Documents A/B
- verify that accepted business rules are still respected
- prevent historical ambiguities from re-entering the active scope
- protect the Titan / Hahitantsoa separation
- signal when a human decision is required

Key rules it must keep visible:

- Titan covers pure rental of materials, articles, and material packs
- Titan must not silently expand into local, salle, venue, room, hall, event
  service, or ancillary service scope without explicit human approval
- Hahitantsoa remains a separate domain
- Documents A/B are a business source, but the current operational state must
  also be checked against F128, F130C, and the real codebase
- if Documents A/B, the roadmap, and the code diverge, the orchestrator must
  stop and request arbitration

Immediate stop conditions:

- ambiguous business rule
- implicit Titan / Hahitantsoa scope change
- addition of an unapproved business module
- contradiction with accepted current decisions
- scope expansion without human validation

## 5. Business module routing matrix

| Domain / task | Required agents | Recommended agents | Not required by default |
| --- | --- | --- | --- |
| Documents runtime | Documents Runtime Agent, Backend Domain Agent, Business Specification Agent, QA/Test Agent | Security/RBAC/Audit Agent, Agent B | Frontend Business Flow Agent, Payments/Billing/Cashbox Agent, Logistics/Delivery/Return Agent |
| Document access / download / API | Documents Runtime Agent, Backend Domain Agent, Security/RBAC/Audit Agent, QA/Test Agent | Agent B, Frontend Business Flow Agent if UI scope exists | Payments/Billing/Cashbox Agent, Logistics/Delivery/Return Agent |
| Payment / deposit foundation | Payments/Billing/Cashbox Agent, Backend Domain Agent, Business Specification Agent, QA/Test Agent, Security/RBAC/Audit Agent | Reservation Lifecycle Agent, Documents Runtime Agent, Agent B | Frontend Business Flow Agent unless API/UI scope exists |
| Reservation lifecycle | Reservation Lifecycle Agent, Backend Domain Agent, Business Specification Agent, Security/RBAC/Audit Agent, QA/Test Agent | Payments/Billing/Cashbox Agent, Documents Runtime Agent, Agent B | Frontend Business Flow Agent unless UI scope exists |
| Inventory operations | Inventory & Asset Agent, Backend Domain Agent, Business Specification Agent, QA/Test Agent | Data Migration/Import Agent, Security/RBAC/Audit Agent | Payments/Billing/Cashbox Agent, Documents Runtime Agent |
| Customer / CRM | Customer/CRM Agent, Backend Domain Agent, Business Specification Agent, QA/Test Agent | Security/RBAC/Audit Agent, Frontend Business Flow Agent | Payments/Billing/Cashbox Agent unless billing scope exists |
| Logistics / delivery / return | Logistics/Delivery/Return Agent, Inventory & Asset Agent, Reservation Lifecycle Agent, Business Specification Agent, QA/Test Agent | Documents Runtime Agent, Payments/Billing/Cashbox Agent, Agent B | Frontend Business Flow Agent unless UI scope exists |
| Hahitantsoa domain | Hahitantsoa Domain Agent, Business Specification Agent, Backend Domain Agent, QA/Test Agent | Frontend Business Flow Agent, Security/RBAC/Audit Agent | Titan-specific agents unless the task touches shared `material` or `article` concepts |
| Frontend business flow | Frontend Business Flow Agent, Business Specification Agent, QA/Test Agent | Backend Domain Agent, Security/RBAC/Audit Agent | DevOps/CI Agent unless build or CI scope exists |
| Data import / Excel reprise | Data Migration/Import Agent, Inventory & Asset Agent, Business Specification Agent, QA/Test Agent | Security/RBAC/Audit Agent, Backend Domain Agent | Frontend Business Flow Agent unless UI scope exists |
| Production readiness | Production Readiness Agent, DevOps/CI Agent, Security/RBAC/Audit Agent, Human Owner | QA/Test Agent, Documentation/Roadmap Agent | Business module agents unless they are directly impacted |

## 6. Routing by T0-T5 task level

- `T0` docs-only / roadmap
  - Documentation/Roadmap Agent required
  - QA/Test Agent smoke review recommended
  - Agent B optional
- `T1` infra / test / CI
  - DevOps/CI Agent required
  - QA/Test Agent required
  - Security/RBAC/Audit Agent recommended if CI, config, or secrets boundaries
    are touched
- `T2` bounded backend business without migration
  - Backend Domain Agent required
  - relevant Business Module Agent required
  - QA/Test Agent required
  - Business Specification Agent required
- `T3` backend with model, migration, or API
  - Backend Domain Agent required
  - relevant Business Module Agent required
  - QA/Test Agent required
  - Security/RBAC/Audit Agent required when API or data access is touched
  - Agent B recommended
- `T4` complex domain work across documents, payments, RBAC, or lifecycle
  - relevant Business Module Agent required
  - Backend Domain Agent required
  - QA/Test Agent required
  - Security/RBAC/Audit Agent required
  - Business Specification Agent required
  - Agent B strongly recommended before merge
- `T5` production, secrets, or sensitive data
  - Production Readiness Agent required
  - Security/RBAC/Audit Agent required
  - Human Owner mandatory
  - full-auto merge forbidden

## 7. Handoff contract

Every specialized agent should provide a short structured handoff before Codex
continues:

```text
Agent:
Task reviewed:
Scope reviewed:
Files/modules reviewed:
Findings:
Risks:
Required changes:
Stop condition triggered: yes/no
Agent B required: yes/no
Can Codex proceed: yes/no
```

This handoff may appear:

- as a section inside the Codex summary
- as a dedicated audit note for sensitive tasks
- as a review comment when the toolchain supports it

## 8. Agent disagreement rule

- if the QA/Test Agent says no, Codex must not merge
- if the Security/RBAC/Audit Agent says no, Codex must not merge
- if the Business Specification Agent says the task violates business rules,
  Codex must stop
- if Agent B requests a correction, Codex must either fix it or request human
  arbitration
- if two agents contradict each other, the Human Owner decides
- if Codex cannot determine which agent is correct, it must stop immediately

## 9. Agent routing for F131

**F131 - Document runtime generation backend phase 1**

Required agents:

- Documents Runtime Agent
- Backend Domain Agent
- Business Specification Agent
- QA/Test Agent
- Documentation/Roadmap Agent for the post-merge roadmap impact

Recommended agents:

- Security/RBAC/Audit Agent; required if storage behavior, document access, or
  public API exposure is touched
- Agent B; recommended if storage behavior, runtime generation, document access
  policy, or public API exposure is touched

Not required by default:

- Frontend Business Flow Agent
- Payments/Billing/Cashbox Agent
- Logistics/Delivery/Return Agent
- Production Readiness Agent

F131 must remain:

- backend-only
- without frontend
- without payment
- without reservation lifecycle work
- without an external provider
- without a public API unless explicitly approved
- validated by targeted tests plus full `backend-test` plus CI

## 10. How the orchestrator calls agents

### Mode A - Single Codex prompt with internal agent phases

Use this for most bounded tasks:

1. Business Specification Agent review
2. relevant Business Module Agent review
3. Backend Domain Agent or Frontend Business Flow Agent planning pass
4. Security/RBAC/Audit Agent risk pass when needed
5. QA/Test Agent validation plan
6. Codex Delivery implementation
7. Documentation/Roadmap Agent post-merge delta

### Mode B - Separate prompts per agent

Use this for complex or ambiguous tasks:

- one inspection prompt for the relevant Business Module Agent
- one Security/RBAC/Audit review prompt if access or sensitive writes matter
- one QA/Test planning prompt
- one Codex implementation prompt

### Mode C - Human / Agent B escalation

Use this when:

- a business decision is needed
- agents disagree
- CI is red without a clear mechanical cause
- migration, API, RBAC, payment, or runtime document risk is high
- the task becomes too large

## 11. Required agent routing section in future prompts

Every complex Codex prompt should contain this section:

```text
Agent routing:
- Required agents:
- Recommended agents:
- Optional agents:
- Not in scope agents:
- Agent B required: yes/no + reason
- Human Owner decision required: yes/no + reason
```

## 12. Roadmap and documentation integration

- F130B defines the general multi-agent governance model
- F130C defines the operational roadmap and the T0-T5 execution policy
- F130D defines specialized agents and their routing
- F130E defines the tool-agnostic adapter contract used to determine which
  specialized agents can inspect, implement, create PRs, merge, or review only
- future T2, T3, T4, and T5 tasks should point to F130D when routing is part of
  the delivery contract

## 13. Stop conditions specific to F130D policy

Stop immediately when:

- a required business agent is missing from the routing
- the task touches a business module not covered by an agent
- Documents A/B are required but unavailable
- Documents A/B, the roadmap, and the code diverge
- the routing does not identify who must validate the task
- Agent B is recommended but explicitly ignored without justification
