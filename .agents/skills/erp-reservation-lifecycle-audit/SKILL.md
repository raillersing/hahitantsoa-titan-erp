---
name: erp-reservation-lifecycle-audit
description: Audit the real Titan and Hahitantsoa reservation journeys from assistant entry through commercial documents, signature, payments, confirmation, logistics, stock, returns, damage or loss settlement, and contract closeout. Use only for an explicit end-to-end audit or phase acceptance, never for Git-only manoeuvres or unchanged functionality.
---

# ERP Reservation Lifecycle Audit

Use this skill only for an explicit complete-journey audit, a phase acceptance
checkpoint, or a claim that a complete Titan or Hahitantsoa journey works. Do not
load it for a bounded component correction, a documentation-only change, a rebase,
a branch cleanup, or a conflict resolution that leaves product behaviour unchanged.
Remain report-only unless implementation is explicitly authorized.

## Change-aware entry gate

Before selecting evidence, classify the actual product delta against the verified
baseline:

- **No product delta** — rebase, semantic-equivalence cleanup, branch alignment, or
  conflict resolution with no changed runtime code: verify the worktree, final diff,
  and any conflict-specific test only. Do not rerun lifecycle, browser, backend, or
  unrelated frontend suites.
- **Bounded product delta** — one component, handler, or API consumer changed: use
  the relevant focused tests and contract checks. Escalate only for the changed
  persisted transition; do not retest unrelated lifecycle stages.
- **Lifecycle delta or phase acceptance** — a change alters a cross-screen persisted
  transition, shared commercial truth, inventory/financial effects, route reachability,
  or an explicit phase is ready to qualify: apply this full audit to the affected
  domain and journey.

Git history, branch age, or a large historical diff are not evidence of a current
product delta. Compare the final code to the current baseline, not to the branch's
original base.

## Scope baseline

Inspect live code before stale maps. For a lifecycle delta, start with only the
paths relevant to the changed journey:

- `frontend/src/prototype/ReservationNewPage.tsx`
- `frontend/src/prototype/ReservationDetailPage.tsx`
- `frontend/src/prototype/HahitantsoaEventDraftDetailPage.tsx`
- `frontend/src/LogisticsDeliveryPanel.tsx`
- `frontend/src/ReturnsHandlingPanel.tsx`
- `frontend/src/BreakageLossPanel.tsx`
- `frontend/src/CautionRefundPanel.tsx`
- `frontend/src/api.ts` and the corresponding frontend types
- backend models, serializers, views, selectors, and services under
  `reservations`, `hahitantsoa`, `documents`, `payments`, `logistics`,
  `inventory`, and `billing`

For every visible action, trace this chain:

`UI control -> frontend handler -> API function -> route -> serializer -> service -> persisted state -> reload -> next authorized action`

Any missing link is a failed user journey, even if adjacent unit tests pass.
Confirm that `App.tsx` and `AppShell.tsx` route the operator to the audited
component. A well-tested panel that is imported only by another unrouted panel is
dead code, not application capability. Search routed prototype pages for local
toasts, hard-coded quantities, `TODO` availability, and direct DOM changes that
simulate success without an API write.

## Mandatory domain journeys

### Titan

1. Create a customer or select an existing customer.
2. Persist the rental period and only `material`, `article`, or
   `material_pack` lines.
3. Persist commercial prices and generate a proforma from the same values.
4. Record durable signed-contract truth; document generation is not signature.
5. Record the configured deposit through the approved backend payment contract
   before confirmation.
6. Revalidate availability and confirm under backend authorization and locks.
7. Prepare, hand over, and record outbound stock exactly once.
8. Create the linked return operation, inspect all quantities, and validate
   inbound, damaged, and missing stock exactly once.
9. Create, validate, and execute damage/loss settlement, refund, excess debt,
   invoice, receipt, and cash effects as applicable.
10. Show closeout blockers, execute closeout idempotently, reload the closed
    state, and prevent conflicting later writes.

### Hahitantsoa

Apply the same lifecycle, while preserving the distinct event domain:

- only `bare` and `logistics` rental types; `bare` is space-only, accepts no
  inventory line, and must remain confirmable without an inventory line;
- venue price follows the configured guest threshold and excess-pax rule;
- `logistics` may contain articles, customizable packs, and approved services;
- payment behaviour must match the approved backend contract; do not infer
  progressive-deposit support from an assistant-only state;
- operational records, stock, returns, damage/loss, and closeout must remain
  directly attributable to the Hahitantsoa event draft, not inferred through a
  nullable Titan relation.

Do not approve parity when Hahitantsoa stops at confirmation while Titan owns the
only return or closeout path.

## Commercial truth matrix

For one non-trivial fixture in each domain, compare exact values at every layer:

| Value | Assistant | Request | Database | API reload | HTML/PDF | Billing/closeout |
| --- | --- | --- | --- | --- | --- | --- |
| line unit price and quantity | required | required | required | required | required | required |
| pack customisation delta | when used | required | required | required | required | required |
| venue and excess-pax amount | Hahitantsoa | required | required | required | required | required |
| services, delivery, duration | when used | required | required | required | required | required |
| discount, subtotal, total | required | required | required | required | required | required |
| deposit and remaining balance | required | required | required | required | required | required |

Fallback template values such as `0,00` do not count as persisted commercial
truth. A preview computed only in React is not evidence for the issued document.

## Legal and payment gates

- A generated or issued contract is not a signed contract.
- Signed truth needs an explicit action or signed artifact, timestamp, actor,
  and audit event.
- Deposit readiness is derived from the backend's confirmed payment and prerequisite
  truth; the UI must not replace it with a local total.
- Every payment and identity attachment added in the assistant must be uploaded
  and linked before local assistant state is cleared.
- Retrying payment confirmation, stock movement, settlement execution, or
  closeout must not duplicate financial or inventory effects.

## Evidence gates

For a full-lifecycle READY verdict, require all of the following. These gates do not
apply to Git-only manoeuvres or a bounded correction outside its changed transition:

- component tests for validation, loading, error, retry, and permission states;
- backend tests for invariants, authorization, rollback, locking, and replay;
- an authenticated browser journey against the mounted backend for both domains;
- route-reachability evidence showing that the tested operational component is
  the one mounted by the production hash route;
- fixture provisioning owned by the test suite, not an undocumented pre-existing
  user or database row;
- API/network evidence for every write and a reload after each critical state;
- stock-before/after evidence and generated-document value comparison;
- closeout blocker and successful idempotent replay evidence.

A build, mocked API test, healthy endpoint, or backend-only acceptance test cannot
prove the mounted application journey.

## Verdict format

Report each domain separately with `PASS`, `FAIL`, or `UNCONFIRMED` for:

- creation and field validation;
- commercial amount parity;
- attachment persistence;
- signed-contract truth;
- payment recording and confirmation;
- logistics and outbound stock;
- return creation and stock reconciliation;
- damage/loss financial execution;
- closeout and replay safety;
- authorization, attribution, and browser reload.

For every failure, name the first broken link in the trace, the user impact, the
evidence, and the smallest coherent corrective lot. Never call the whole journey
READY while one mandatory gate fails.

## References

- [AGENTS.md](../../../AGENTS.md)
- [Application map index](../../../docs/architecture/application-map/README.md)
- [Frontend agent template](../../../docs/ai-agents/frontend-agent-template.md)
- [Backend agent template](../../../docs/ai-agents/backend-agent-template.md)
- [PR quality gates](../../../docs/ai-agents/pr-quality-gates.md)
