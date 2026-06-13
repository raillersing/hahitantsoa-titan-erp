# F130C - Operational roadmap refresh and complex task policy

## 1. Status

- Documentation-only roadmap refresh.
- Operational follow-up to F128, F129, F129S, F130A, and F130B.
- No runtime behavior changed.

## 2. Current operational baseline

The current operational baseline after F130B is:

- `main` expected at this stage: `5318d1fb0d28f4fc39ccbdcf314be09b942fb6b3`
- canonical backend quality gate: `bash scripts/ci/backend-quality`
- canonical containerized backend quality gate:
  `docker compose --profile test run --rm backend-test`
- PR CI and `main` CI must always be awaited until an explicit final result
  exists
- Codex may execute through final merge plus green `main` CI when the task stays
  green, mergeable, and in scope
- the ERP Task Orchestrator remains responsible for selecting the next bounded
  task
- F128 remains the initial strategic finalization snapshot
- F130C adds the operational roadmap delta and the policy for complex task
  execution

## 3. Roadmap delta since F128

Since the original F128 roadmap snapshot:

- F129 added the persisted `DocumentInstance` backend foundation
- F129S stabilized and accelerated the backend validation workflow
- F130A documented the automated ERP delivery workflow
- F130B documented the multi-agent governance model, merge authority, and
  continuous roadmap-update responsibility

This means the project can now use a controlled automated delivery loop for
small and medium bounded tasks, while still escalating product, architecture,
security, and scope decisions when needed.

## 4. Current finalization priorities

The current practical priority order is:

1. Document runtime generation phase 1
   - generate a first Titan commercial document from `DocumentInstance`
   - reuse F126BC and F129 foundations
   - keep the slice backend-only
   - keep storage and metadata controlled
   - keep tests targeted and CI strict
2. Document access / download / API decision
   - define the private access boundary before broad API exposure
   - keep permissions explicit
   - avoid a large frontend refactor
3. Payment / deposit foundation
   - define the first durable payment or deposit foundation
   - connect it to reservations and documents only when the boundary is clear
   - avoid provider integration in the first slice
4. Reservation lifecycle controlled exposure
   - expose confirm/cancel API surfaces only after document and payment
     prerequisites are coherent
   - keep permissions, audit, and tests strict
5. Frontend business-chain integration
   - connect reservation, document, payment/deposit, and status flows in small
     UI slices
   - avoid one large frontend rewrite
   - validate each micro-flow incrementally

## 5. Complex task policy / Epic execution mode

Complex tasks are allowed, but they must run under explicit execution levels
T0-T5.

- `T0` - docs-only, infra, tests, mechanical work
  - Codex full autonomy is allowed
- `T1` - backend business changes without migration
  - Codex full autonomy is allowed when scope, tests, and CI stay green
- `T2` - backend changes with migration or model changes
  - allowed only when migrations are expected, tests are complete, CI is green,
    and no business doubt remains
- `T3` - API, RBAC, payments, runtime document generation
  - allowed only with independent review strongly recommended before merge
- `T4` - frontend UI and user-facing workflow changes
  - allowed when tests and build are green, but must stop on UX or business
    ambiguity
- `T5` - production, deployment, secrets, or sensitive data
  - human intervention is mandatory

The purpose of T0-T5 is not to slow work down. It is to keep large slices
bounded and to stop hidden scope expansion before it becomes expensive.

## 6. Complex task internal phase requirements

When a task is complex enough to behave like an epic, it must still be executed
as controlled internal phases:

1. inspect the real repository state
2. confirm dependencies and stop conditions
3. define the exact file scope
4. implement the smallest coherent slice
5. run local validation
6. wait for PR CI to finish explicitly
7. merge only if green and mergeable
8. wait for `main` CI explicitly
9. clean up
10. record the roadmap delta if the task changed operational priorities

Complex work must not bypass the final quality gate just because it was planned
as an epic.

## 7. Complex task stop conditions

Complex tasks must stop immediately when one of these conditions appears:

- out-of-scope file changes
- `.env`, secrets, or credential exposure risk
- unexpected migration
- real Git conflict
- PR not `MERGEABLE`
- CI red without a clearly understood cause
- `main` CI red after merge
- business decision required
- architecture change required
- destructive behavior risk
- sensitive data concern
- unclear scope expansion

The 3-failure rule remains limited to clear mechanical failures such as format,
lint, import ordering, timing, or non-destructive command issues.

## 8. Roadmap update rule after each merge

After each merge with green `main` CI, the orchestrator must evaluate whether
the operational roadmap needs an update.

An update is mandatory when the merged task:

- completes a capability
- unlocks a next task
- changes dependency ordering
- changes risk level
- introduces a new technical constraint
- makes a previously planned task obsolete

An update is optional when the merged task is purely mechanical and does not
change finalization state.

Roadmap updates must stay short, operational, and verifiable. They should state:

- the completed task
- the impact on current finalization state
- any unlocked next work
- remaining risks
- the recommended next task
- whether Agent B is recommended

## 9. Recommended next task

Recommended next task:

**F131 - Document runtime generation backend phase 1**

Recommended F131 scope:

- backend-only
- reuse F126BC and F129
- generate a first Titan commercial document from `DocumentInstance`
- no frontend
- no payment
- no reservation lifecycle API changes
- no external provider
- targeted tests plus full `backend-test` validation plus CI

Agent B is recommended for F131 if the slice touches storage behavior, runtime
document generation, document access policy, or any public API exposure.

For T2-T5 tasks, F130D defines the specialized agent routing matrix and the
required business module agents.
