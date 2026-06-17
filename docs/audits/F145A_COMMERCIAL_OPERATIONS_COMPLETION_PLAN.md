# F145A - Commercial Operations Source-Trace And Completion Plan

## Purpose

F145A defines the source-traced backend-first implementation plan for completing the ERP
commercial operations track across:

- documents and commercial artifacts;
- payment and billing foundations;
- logistics and stock movement foundations;
- delivery and return operations;
- damage, loss, and repair recovery flows;
- end-to-end commercial acceptance.

F145A is planning and audit only. It does not implement application behavior.

## Source Baseline

Primary source-traced inputs used for this plan:

- `docs/references/source/Document_A_CDC_Technique_Evenementiel_v3.4.pdf`
- `docs/references/source/Document_B_Presentation_Metier_Evenementiel_v3.4.pdf`
- `docs/references/source/Guide_Developpement_Hahitantsoa_Titan_v1.8.pdf`
- `docs/business-rules/scope.md`
- `docs/business-rules/reservations.md`
- `docs/business-rules/billing-and-payments.md`
- `docs/business-rules/logistics.md`
- `docs/business-rules/sensitive-documents-and-audit.md`
- `docs/decisions/DEC-002-inventory-availability-domain.md`
- `docs/decisions/DEC-003-hahitantsoa-mvp-scope.md`
- `docs/decisions/DEC-004-inventory-availability-soft-delete-semantics.md`
- `docs/decisions/DEC-005-reservation-confirmation-domain-contract.md`
- `docs/decisions/DEC-006-reservation-sensitive-permissions-attribution-audit.md`
- `docs/audits/F92_HAHITANTSOA_LIFECYCLE_SOURCE_TRACE.md`

Supporting implementation baselines inspected:

- `backend/apps/documents/**`
- `backend/apps/reservations/**`
- `backend/apps/hahitantsoa/**`
- `backend/apps/inventory/**`
- `backend/apps/customers/**`
- `tests/backend/**` for documents, reservations, inventory, and Hahitantsoa
- `frontend/src/**` read-only inspection only

## Source-Traced Required Workflows

The repository business documentation and F92 source-trace establish the following required
commercial sequence and boundaries:

1. reservation or event planning starts as a draft;
2. proforma is generated as an estimate only;
3. signed contract plus deposit/acompte remain required before confirmation;
4. confirmation must be transactionally revalidated and must not be weakened;
5. post-contract modification requires a proforma of change / amendment workflow;
6. after confirmation, the operational flow continues into invoice, scheduling/logistics,
   delivery note, return, and damage/loss handling;
7. payment-provider statuses are payment statuses, not reservation lifecycle statuses;
8. sensitive documents remain private and auditable.

Repository rules already fixed by source-traced docs:

- a proforma never confirms a reservation;
- a signed contract is immutable and later changes require amendment workflow;
- invoice, logistics, delivery note, return note, payment receipt, and damage invoice are
  part of the later commercial flow;
- confirmation cannot bypass signed-contract, deposit/payment, authorization,
  attribution, audit, or conflict-protection rules.

## Current Implemented Backend Surfaces

### Documents

Implemented today:

- read-only document template registry and template detail API;
- source-traced template inventory for:
  - Hahitantsoa delivery note, contract amendment, contract, invoice, proforma,
    house rules, liability release;
  - Titan delivery note, proforma, invoice, material amendment, material contract;
  - shared payment receipt, return note, internal release note, supplier purchase
    order, breakage repair invoice;
- backend commercial document context value objects from `ReservationDraft`;
- persisted `DocumentInstance` metadata foundation;
- runtime HTML generation for prepared document instances;
- private authenticated HTML artifact access with audit on successful access.

Still missing:

- any commercial document creation API;
- any Hahitantsoa document runtime path;
- any invoice issuance workflow;
- payment receipt issuance workflow tied to a payment model;
- delivery/return/damage document issuance workflows;
- PDF generation;
- document issuance/void lifecycle orchestration;
- linkage from Hahitantsoa confirmed/amendment flows into documents.

### Reservations

Implemented today:

- Titan reservation draft CRUD and availability preview foundations;
- reservation confirmation preflight and confirmation service foundations with blocker
  categories and inventory-blocking behavior;
- reservation-sensitive authorization/attribution guardrails.

Still missing relative to full commercial completion:

- payment/deposit domain persistence;
- billing/invoice issuance;
- logistics and physical stock movement recording;
- return flow;
- breakage/loss flow;
- end-to-end commercial completion after confirmation.

### Hahitantsoa

Implemented today:

- discovery;
- shared availability read-only preview;
- event draft CRUD;
- draft availability preview;
- confirmation preflight and confirmation;
- confirmed-draft immutability;
- amendment request foundation;
- amendment request metadata update;
- amendment line CRUD;
- amendment-request availability preflight.

Still missing:

- amendment readiness/approval boundary;
- Hahitantsoa document generation path;
- Hahitantsoa payment/billing path;
- Hahitantsoa logistics/return/damage path;
- Hahitantsoa completed commercial lifecycle.

### Inventory

Implemented today:

- `InventoryItem`;
- `InventoryAvailability` with `blocked` and `reserved`;
- read-only inventory APIs;
- availability conflict and selector foundations.

Still missing:

- stock movement ledger;
- quantity-on-hand model;
- logistics release/return movement domain;
- damage/loss adjustments;
- stock reconciliation and complete operational stock state.

### Customers

Implemented today:

- customer read-only model and API surfaces;
- customer linkage to reservation and document foundations.

Still missing:

- customer commercial account state beyond basic read-only data;
- billing identity workflow beyond static customer fields;
- sensitive private-customer-document attachment workflows.

## Current Implemented Frontend Surfaces (Read-Only Inspection)

Current frontend commercial-adjacent surfaces are narrow:

- Titan reservation draft preparation UI;
- Hahitantsoa draft and amendment UI;
- private document artifact preview UI for generated HTML artifacts only.

Not implemented in frontend today:

- payment workflow;
- billing/invoice workflow;
- contract workflow;
- delivery note workflow;
- return workflow;
- breakage/damage/loss workflow;
- stock movement workflow;
- end-to-end commercial operations shell.

Coordination note:

- Antigravity currently owns separate frontend amendment catch-up work.
- This plan records frontend gaps for future coordination only and does not authorize Codex
  frontend edits.

## Backend Missing Surfaces

### Documents Runtime / Commercial Artifacts

Needed backend surfaces:

- generic document-instance creation service for approved commercial templates;
- issuance and voiding boundaries for document instances;
- Hahitantsoa and Titan runtime document generation pathways;
- document access selectors by commercial object and lifecycle status;
- controlled APIs for listing commercial document instances by reservation/event;
- document artifact retention and issuance invariants for non-preview artifacts.

### Billing / Payment Foundation

Needed backend surfaces:

- persistent payment aggregate with source-traced statuses;
- deposit/acompte representation tied to reservation/event commercial state;
- payment receipt linkage to document instances;
- invoice aggregate and invoice-status model;
- payment-to-invoice allocation rules;
- commercial invariants proving payment statuses do not replace reservation lifecycle status.

### Logistics / Stock Movement Foundation

Needed backend surfaces:

- stock movement ledger or equivalent durable movement model;
- movement types for internal release, customer delivery, return, damage, loss, and
  repair-related adjustments;
- linkage from delivery/return operations to inventory state;
- selectors for current operational stock state and movement history;
- transaction-safe write boundaries for movement posting.

### Returns / Damage / Loss

Needed backend surfaces:

- return note lifecycle;
- damage/loss assessment aggregate;
- repair/breakage invoice linkage where applicable;
- inventory adjustment linkage from damage/loss outcomes;
- auditable resolution flow for returned, damaged, missing, or repairable items.

Later bundles after the first settlement foundation remain explicitly required for:

- inventory default valuation sources;
- pricing or barème tables;
- per-transaction amount overrides;
- discount or remise handling;
- durable damage/loss settlement execution and obligation ledgers;
- caution refund execution;
- excess damage/loss invoice generation.

### End-To-End Commercial Acceptance

Needed backend surfaces:

- orchestrated commercial acceptance sequence from confirmed reservation/event into:
  - commercial documents;
  - payment/deposit capture state;
  - delivery execution;
  - return closeout;
  - damage/loss billing closeout;
- acceptance tests covering the approved end-to-end invariants.

## Frontend Gaps For Later Antigravity / Frontend Planning

These are coordination notes only:

- no invoice listing/viewing UI;
- no payment/deposit tracking UI;
- no document issuance UI beyond raw private HTML artifact preview;
- no delivery note, return note, or damage invoice UI;
- no stock movement or logistics UI;
- no complete commercial operations dashboard;
- no customer-facing or operator-facing commercial completion workflow.

## Data Models Likely Needed

Likely new or expanded backend models:

- payment aggregate:
  - payment reference;
  - payment method/provider;
  - provider status;
  - amount;
  - received/validated timestamps;
  - attribution fields;
- invoice aggregate:
  - invoice number/reference;
  - status;
  - issued timestamp;
  - totals snapshot;
  - linkage to customer and commercial object;
- stock movement aggregate:
  - movement type;
  - source object;
  - inventory item;
  - quantity;
  - movement timestamp;
  - operator attribution;
- delivery/return aggregate:
  - delivery note / return note linkage;
  - operational timestamps;
  - actor attribution;
- damage/loss aggregate:
  - incident type;
  - affected items;
  - quantity or severity;
  - commercial resolution state;
  - optional repair/breakage invoice linkage;
- Hahitantsoa or shared commercial linkage records where event flows diverge from Titan
  reservation-draft assumptions.

Likely existing-model expansions:

- `DocumentInstance` for issuance/void metadata beyond prepared/generated state;
- reservation or Hahitantsoa commercial roots for payment/document linkage;
- inventory models for operational stock/movement linkage.

## Migrations Likely Needed

Expected migration classes:

- new payment tables;
- new invoice tables;
- new stock movement tables;
- new return / damage / loss tables;
- possible expansion of `DocumentInstance` lifecycle fields;
- possible expansion of reservation/Hahitantsoa commercial linkage fields;
- new constraints ensuring source-traced lifecycle/state integrity.

Migration caution:

- stock and commercial state migrations must be introduced only with explicit source-backed
  lifecycle rules and data-integrity review.

## Side Effects And Transaction Boundaries

Required side-effect discipline for future implementation:

- confirmation remains transactional and cannot be weakened to “commercially convenient”
  behavior;
- document issuance side effects must not survive rollback;
- payment receipt or invoice issuance must be tied to committed commercial state only;
- stock movements must be atomic and auditable;
- delivery/return posting must not partially update inventory and commercial state;
- damage/loss resolution must not leave inventory and billing state divergent.

Likely transactional boundaries:

- payment creation / validation;
- invoice issuance;
- stock movement posting;
- delivery completion;
- return completion;
- damage/loss closeout;
- document issuance state transitions;
- any future cross-domain “commercial close” orchestration.

## Document Generation Boundaries

Allowed future direction:

- runtime HTML generation and later PDF generation for approved templates;
- issuance and storage of private commercial artifacts;
- Hahitantsoa and Titan document-specific payload generation via services.

Must remain explicitly bounded:

- no public artifact URLs for sensitive documents;
- no direct template rendering from frontend;
- no implicit confirmation triggered by document generation;
- no invoice/payment side effects hidden inside generic document runtime helpers.

## Payment / Billing Boundaries

Must remain explicit:

- payment provider status is not reservation lifecycle status;
- deposit/acompte state must be durable and auditable;
- invoice lifecycle must be distinct from reservation/event status;
- receipts, invoices, and payment validations must not silently mutate confirmation rules.

Required separation:

- payment recording;
- payment validation;
- receipt issuance;
- invoice issuance;
- reservation/event lifecycle progression.

## Logistics / Stock Movement Boundaries

Source-traced documents require at least:

- internal release note;
- delivery note;
- return note;
- operational stock follow-up after confirmation.

Backend boundaries should therefore separate:

- reservation/event planning state;
- confirmed commercial commitment;
- physical release/delivery operations;
- physical return operations;
- loss/damage adjustments;
- accounting/document consequences.

## Return / Damage / Loss Boundaries

Source-traced flow and template inventory imply separate later-stage operations for:

- return;
- damage / breakage / remise en etat;
- possible damage invoice or repair billing.

Required future backend rule:

- these outcomes must not be collapsed into generic reservation status alone;
- they require explicit operational and commercial records.

## Old Branch Audit

### `feat/f126c-commercial-document-service-completion`

Classification:

- reusable ideas:
  - service-oriented document payload assembly;
  - test coverage for document services;
  - continued movement of document preview logic out of views;
- obsolete work:
  - branch scope is Titan-proforma-centered and predates later document/runtime slices now on
    `main`;
- risky code not to reuse blindly:
  - serializer/view assumptions from older preview surfaces may conflict with current document
    runtime and artifact foundations;
- possible cherry-pick candidates:
  - documentation-only deltas or isolated service-test ideas after line-by-line review, not
    blind cherry-pick.

### `feat/f134b-document-artifact-runtime-invariant-hardening`

Classification:

- reusable ideas:
  - strict runtime invariants for generated document artifacts;
  - explicit runtime error codes and storage-path checks;
- obsolete work:
  - none obviously obsolete from diff shape alone;
- risky code not to reuse blindly:
  - any runtime changes must be diff-reviewed against current `backend/apps/documents/runtime.py`
    and tests because runtime generation is a sensitive foundation;
- possible cherry-pick candidates:
  - high-confidence candidate for later selective reuse if the code matches the audit and still
    applies cleanly.

### `feat/f135a-reservation-confirmation-preflight-backend-service`

Classification:

- reusable ideas:
  - isolated confirmation-preflight service shaping or tests if still not represented on `main`;
- obsolete work:
  - this branch is reservation-confirmation scoped, not commercial-operations completion scoped;
- risky code not to reuse blindly:
  - it can pull backend priority back into reservation confirmation instead of the requested
    commercial track;
- possible cherry-pick candidates:
  - low priority for F145A; only audit for reference, not as a driver of the commercial track.

## Explicit Exclusions

F145A does not authorize:

- backend business-code implementation;
- frontend implementation;
- Antigravity/frontend worktree modification;
- F104 amendment readiness work;
- F140D work;
- `.env` or secret handling;
- quarantine deletion or reuse;
- blind branch merge or cherry-pick.

## Business Ambiguities Requiring Hard Stop

The following areas remain insufficiently specified for direct implementation and should stop a
future coding slice until source or explicit human decision resolves them:

- legal/fiscal invoice numbering and issuance rules;
- accepted payment-provider integration and state machine details beyond high-level status notes;
- exact accounting treatment for partial payment, refund, or unapplied payment;
- exact logistics state model across prepared, delivered, partially returned, and closed states;
- exact stock quantity model versus movement-only model;
- exact damage/loss valuation and billing rules;
- exact cross-scope sharing rules for Hahitantsoa versus Titan commercial artifacts once both
  have full runtime document generation;
- whether commercial completion roots should center on `ReservationDraft`, confirmed
  reservation/event records, or a new shared commercial-order aggregate.

## Recommended Backend Execution Order

Recommended backend priority after F145A approval:

1. commercial documents runtime and artifact completion
   - finish document service/runtime/issuance foundations;
2. billing and payment foundation
   - durable payment and invoice models without inventing fiscal rules;
3. stock movement and logistics foundation
   - movement ledger and delivery/return posting foundations;
4. returns and damage/loss foundation
   - return note and breakage/loss operational-commercial closeout;
5. end-to-end commercial acceptance
   - source-traced integrated acceptance flow across confirmed commercial state.

## Recommended Frontend Coordination Order

Frontend should remain separate and follow backend contract maturity:

1. document artifact and issued-document surfaces after backend APIs exist;
2. payment/billing operator surfaces after durable payment and invoice models exist;
3. logistics/stock UI after movement APIs exist;
4. return/damage/loss UI after operational-commercial closeout APIs exist.

This ordering keeps Antigravity/frontend planning behind approved backend contracts rather
than inventing commercial UI behavior.
