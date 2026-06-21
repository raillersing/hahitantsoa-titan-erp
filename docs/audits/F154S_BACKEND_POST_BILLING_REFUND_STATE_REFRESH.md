# F154S - Backend Post-Billing Refund State Refresh

## 1. Audit Scope and Baseline

**Inspected:** 2026-06-21  
**HEAD:** `65370edd89113499ec9bc0a4ead096441bc8fee6` - merge of PR #377  
**Branch:** `main`  
**Status:** clean  
**Main CI:** green for exact merged SHA `65370edd89113499ec9bc0a4ead096441bc8fee6` at GitHub Actions run `27906283923`

### Reference Baselines

- Document A remains the product target.
- F152 remains the broad product-truth audit, but is materially stale in billing depth.
- F153 remains the workflow and execution standard.
- F154I remains the last accepted backend refresh before the billing refund-obligation sequence.
- Live `main` is the implementation truth.

### Billing Sequence Considered Here

The refresh is based on the live billing sequence now present on `main`:

| PR | Merge SHA | Scope |
|---|---|---|
| #371 | `d11d10a` | installment auto-settlement and overdue lifecycle read exposure |
| #373 | `1fe24d1` | cancellation guard when installment payments already exist |
| #376 | `91484ab` | refund-obligation foundation for partially-paid installment cancellation |
| #377 | `65370ed` | refund-obligation execution |

No separate repository-local audit artifacts for `F154N`, `F154O`, `F154P`, `F154Q`, and `F154R`
were found in `docs/audits/`; this refresh therefore treats the merged live code and commit
history as the authoritative context for that billing sequence.

---

## 2. Current Main and CI State

### Current Main HEAD

- `main` HEAD is `65370edd89113499ec9bc0a4ead096441bc8fee6`
- PR #377 is merged
- latest `main` CI is green for the exact merge SHA

### Active Worktrees Observed

| Worktree | Branch | Notes |
|---|---|---|
| `/home/raillersing/projects/hahitantsoa-titan-erp` | `main` | clean |
| `//wsl.localhost/Ubuntu/home/raillersing/projects/hahitantsoa-titan-erp-f157o-logistics-passation-delivery` | `opencode/f157o-logistics-passation-delivery` | parallel logistics/backend track, separate scope |
| `/home/raillersing/projects/hahitantsoa-titan-erp-f157a-billing-installment-enforcement` | `codex/f157a-billing-installment-enforcement` | clean, blocked earlier on INV-009 applicability |

### Open PRs

- none

---

## 3. Billing Lifecycle Status After the Billing Refund Sequence

### Gaps from F152/F154I now satisfied

Compared with F152 and F154I, the following billing gaps are now clearly satisfied on live `main`:

| Area | Previous state | Current live state |
|---|---|---|
| Installment schedule foundation | missing / shallow | present with durable installments, allocation records, and lifecycle state |
| Installment lifecycle read exposure | missing | present (`open`, `partially_paid`, `paid`, `overdue`) |
| Auto-settlement from installments | missing | present when all installments are paid |
| Cancellation guard after installment payments | missing | present and tested |
| Partial-payment correction path | missing | present via billing refund obligation creation |
| Refund-obligation execution | missing | present with positive refund payment, receipt generation, execution markers, idempotence, and audit |

### Evidence anchors

- [backend/apps/billing/models.py](/home/raillersing/projects/hahitantsoa-titan-erp-f154s-backend-post-billing-refund-state-refresh/backend/apps/billing/models.py:16)
- [backend/apps/billing/urls.py](/home/raillersing/projects/hahitantsoa-titan-erp-f154s-backend-post-billing-refund-state-refresh/backend/apps/billing/urls.py:1)
- [backend/apps/payments/urls.py](/home/raillersing/projects/hahitantsoa-titan-erp-f154s-backend-post-billing-refund-state-refresh/backend/apps/payments/urls.py:1)
- [tests/backend/test_billing_installments.py](/home/raillersing/projects/hahitantsoa-titan-erp-f154s-backend-post-billing-refund-state-refresh/tests/backend/test_billing_installments.py:1)
- [tests/backend/test_billing_installment_lifecycle.py](/home/raillersing/projects/hahitantsoa-titan-erp-f154s-backend-post-billing-refund-state-refresh/tests/backend/test_billing_installment_lifecycle.py:1)
- [tests/backend/test_billing_refund_obligation.py](/home/raillersing/projects/hahitantsoa-titan-erp-f154s-backend-post-billing-refund-state-refresh/tests/backend/test_billing_refund_obligation.py:1)

### Billing gaps still not satisfied

The billing sequence does **not** yet satisfy the broader billing target implied by Document A and
F152:

| Gap | Current live state | Why it still remains |
|---|---|---|
| Legal invoice numbering | absent | no legal numbering model, sequence, or issuance policy present |
| Accounting/export | absent | no accounting-like export surface, ledger export, or downstream contract |
| General pre-event billing schedule enforcement (`INV-009`) | not safely applicable yet | current billing source is still bounded to `inventory_damage_loss_excess_receivable` |
| Full operator billing lifecycle | partial | billing remains focused on excess receivable / damage-loss closeout, not the full reservation commercial path |

### Net assessment

The recent billing work materially closes the **refund-obligation and installment integrity** gap,
but it does **not** make billing fully operator-ready or fully aligned with the broader commercial
path expected by Document A.

---

## 4. Remaining Backend Gaps After PR #377

### High-confidence remaining gaps

| Area | Current state | Gap |
|---|---|---|
| Commercial closeout coherence | several bounded building blocks now exist | caution, excess, refund, settlement, invoice, and downstream operator flow are still fragmented across apps |
| Logistics breadth | foundations present | delivery / passation / broader operator logistics flow still incomplete |
| Legal invoice numbering | absent | no legal numbering policy or implementation |
| Accounting/export | absent | no accounting-like or export-facing backend capability |
| Queue / audit freshness | stale | orchestration truth still lags live repo state |

### Lower-priority but still open

| Area | Current state | Gap |
|---|---|---|
| Reservation commercial billing path | not yet modeled in live billing source kinds | current billing remains tied to excess receivable closeout |
| PDF / operator-managed billing artifacts | still outside current billing scope | document breadth remains partial |

---

## 5. Which Backend Theme Should Come Next

### Decision

The next backend task should be: **commercial closeout coherence**

### Why commercial closeout coherence wins now

- the billing sequence now proves that the repository can handle installment settlement,
  guarded cancellation, refund-obligation creation, and refund execution safely;
- however, those capabilities still live inside a **bounded excess-receivable closeout slice**,
  not a unified operator-facing commercial flow;
- legal numbering and accounting/export would be premature on top of a billing model that is still
  intentionally narrow;
- logistics expansion is still important, but the newly-merged billing/refund pieces now make the
  fragmentation between settlement, excess, invoice, and refund the more immediate backend
  coherence gap;
- Document A expects the commercial path after return/damage settlement to feel operationally
  unified, not just technically possible through isolated endpoints.

### Why not legal invoice numbering next

- current billing issuance is still restricted to one source kind:
  `inventory_damage_loss_excess_receivable`;
- adding legal numbering before broader commercial closeout coherence would risk hardening
  numbering rules onto a still-incomplete billing boundary.

### Why not accounting/export next

- accounting/export depends on a more stable operator-facing commercial lifecycle;
- exporting a fragmented internal flow would lock in premature contracts and make later
  rework more expensive.

### Why not logistics expansion first

- logistics remains a major gap, but a parallel logistics track is already active in a separate
  worktree;
- from a backend sequencing standpoint, the newly merged billing/refund sequence makes the
  unresolved closeout fragmentation more immediate for the Codex-owned critical-financial track.

---

## 6. Updated Backend Completion Estimate

### Previous accepted reference

- F154I backend completion estimate: **81%**

### Updated estimate after PR #376 and PR #377

- updated backend completion estimate: **84%**

### Rationale

Positive movement since F154I:

- installment schedule creation, payment allocation, overdue/paid lifecycle exposure, and
  auto-settlement are now live;
- billing cancellation no longer silently crosses installment-payment state;
- partial-payment refund-obligation creation is now durable and tested;
- refund-obligation execution is now live with:
  - positive outgoing refund payment only;
  - generated refund receipt linkage;
  - execution attribution;
  - idempotent re-execution behavior;
  - transaction-safe audit.

Remaining drag:

- billing is still not a full pre-event commercial billing system;
- legal numbering and accounting/export remain absent;
- logistics breadth remains incomplete;
- cross-app commercial closeout remains fragmented.

Confidence:

- **medium-high**
- confidence is high for the billing/refund-obligation slice itself
- confidence is lower for the final percentage because Document A’s broader commercial path still
  spans multiple not-yet-unified apps

---

## 7. Final Audit Verdict

- live `main` is healthy at `65370edd89113499ec9bc0a4ead096441bc8fee6`
- exact-SHA `main` CI is green
- the billing installment/refund sequence materially closes several billing lifecycle gaps that
  were still open in F152 and F154I
- the billing domain is now stronger on **integrity and correction**, but still not complete on
  broader operator billing
- the next backend priority should move to **commercial closeout coherence**
- legal numbering and accounting/export should wait until the commercial closeout path is more
  unified
