# F121K - F121 lifecycle closure and backend roadmap refresh

## 1. Status

- F121K is documentation-only.
- F121K does not change backend runtime code, frontend code, tests, models,
  migrations, serializers, views, URLs, or secrets handling.
- F121K closes the backend-internal reservation lifecycle foundation delivered
  through F121J and refreshes the next backend finalization sequence.

## 2. F121 lifecycle completion summary

The F121 reservation lifecycle foundation is complete through F121J:

- F121E: confirmation preflight read-only;
- F121F: durable contract/deposit prerequisite markers;
- F121G: transactional internal draft confirmation;
- F121H: transactional internal confirmed reservation cancellation;
- F121I: non-modifying lifecycle audit;
- F121J: lifecycle invariant and transaction hardening.

These slices established a backend-internal reservation lifecycle foundation
without opening write APIs, frontend write workflows, payment flows, invoice
flows, PDF contract generation, refund behavior, `completed`, or `no_show`.

## 3. Current backend state after F121J

The repository now has a materially stronger reservations backend than the
historical F117/F120/F121A planning documents described.

Confirmed current state:

- reservation drafts and lines persist durable draft data;
- confirmation preflight remains read-only;
- contract signed and required deposit received markers exist;
- transactional draft confirmation exists and creates linked reserved
  `InventoryAvailability` rows;
- transactional cancellation exists and releases only linked active inventory
  blocks through soft-delete;
- lifecycle metadata invariants and rollback safety are hardened;
- success audit for confirmation and cancellation remains transaction-safe;
- Titan scope remains limited to `material`, `article`, `material_pack`;
- Hahitantsoa remains separate and does not gain reservation write behavior.

Still intentionally not implemented:

- `completed` lifecycle;
- `no_show` lifecycle;
- payment provider integration;
- invoice or receipt workflow;
- PDF contract/document generation;
- refund behavior;
- logistics and returns workflows;
- Hahitantsoa write workflow.

## 4. Historical document handling

The following documents remain useful as historical inspection and planning
evidence, but their "current state" sections are no longer authoritative after
F121J:

- `docs/audits/F117_BACKEND_COMPLETION_ROADMAP.md`
- `docs/audits/F120_RESERVATION_CONFIRMATION_TECHNICAL_CADRAGE.md`
- `docs/audits/F121A_BACKEND_FOUNDATION_MULTI_AGENT_PLAN.md`

F121K does not rewrite those documents to pretend they were authored later. It
keeps them as historical records and adds explicit historical labeling instead.

## 5. Recommended backend finalization roadmap after F121J

The next sequence should stay backend-first, small, and PR-sized.

### F122A - contract/deposit prerequisite cadrage

Recommended next controlled task.

Objective:

- confirm the narrowest durable backend contract for contract/deposit
  prerequisites after F121J;
- decide what remains a simple reservations-local marker versus what requires a
  stronger domain representation;
- avoid premature expansion into payments, invoices, receipts, PDF contracts,
  or external integrations.

### F122B - contract/deposit prerequisite model hardening

Only if F122A confirms a real schema or domain hardening need.

Objective:

- implement the smallest durable prerequisite model changes justified by the
  cadrage;
- keep the scope reservation-local where possible;
- avoid commercial workflow expansion.

### F123 - reservation lifecycle service contract hardening

Objective:

- formalize the internal service contracts around draft, confirmed, and
  cancelled lifecycle operations;
- clarify durable guarantees before any broader API exposure decision.

### F124 - backend permissions and data-scope hardening

Objective:

- tighten backend authorization and data-scope guarantees around sensitive
  reservation operations;
- keep the implementation backend-only and Titan-safe.

### F125 - reservation confirmation/cancellation API decision

Objective:

- decide whether backend-internal lifecycle operations should remain internal or
  gain a narrow authenticated API surface;
- default to decision-only unless a later task explicitly approves
  implementation.

### F126 - commercial documents backend foundation

Objective:

- open the backend foundation for commercial documents only after lifecycle and
  prerequisite contracts are clearer;
- keep this separate from frontend and PDF generation by default.

### F127 - payment/deposit backend foundation

Objective:

- open the backend payment/deposit domain in a controlled slice after
  prerequisite cadrage;
- do not combine it with providers, receipts, refunds, or broader accounting in
  one PR.

### F128 - logistics and returns backend foundation

Objective:

- open delivery, return, breakage, and loss backend foundations after the
  reservation lifecycle and commercial prerequisites are sufficiently stable.

### F129 - backend completion audit for remaining ERP domains

Objective:

- perform a backend-wide completion audit across reservations, commercial
  documents, payments, logistics, returns, and remaining ERP domain gaps.

## 6. Scope guard for future slices

Future slices in this sequence must preserve:

- Titan limited to `material`, `article`, `material_pack`;
- Hahitantsoa separate from Titan write flows;
- backend-first sequencing;
- one controlled PR-sized slice at a time.

Future slices must not silently add:

- Hahitantsoa reservation writes;
- frontend write workflows;
- payment provider integration;
- invoice or receipt workflow;
- PDF contract generation;
- refund behavior;
- `completed` or `no_show` lifecycle semantics;
- unrelated cross-domain broadening.

## 7. Recommended next step

`F122A - contract/deposit prerequisite cadrage` is the next recommended
implementation/planning step after F121K.

It is the smallest coherent next slice because it clarifies what must become a
stronger durable prerequisite foundation before later API, commercial document,
or payment-domain work can proceed safely.
