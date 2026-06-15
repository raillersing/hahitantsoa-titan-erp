# F92 - Hahitantsoa Lifecycle Source Trace

## Purpose

Turn Documents A and B into a traceable backend planning source for the next Hahitantsoa
bundles.

## Source-of-truth files

Primary business sources:

- `docs/references/source/Document_A_CDC_Technique_Evenementiel_v3.4.pdf`
- `docs/references/source/Document_B_Presentation_Metier_Evenementiel_v3.4.pdf`

Supporting repository sources:

- `docs/references/source/Guide_Developpement_Hahitantsoa_Titan_v1.8.pdf`
- `docs/decisions/DEC-003-hahitantsoa-mvp-scope.md`
- `docs/business-rules/scope.md`
- `docs/business-rules/reservations.md`
- `backend/apps/hahitantsoa/**`
- `tests/backend/test_hahitantsoa_event_draft_api.py`

## Extracted Hahitantsoa business lifecycle

Documents A and B define a business reservation flow that is broader than the early MVP
read-only decision:

1. Create client file / reservation dossier.
2. Verify calendar and availability.
3. Select offers according to business scope.
4. Generate proforma.
5. Generate contract.
6. Collect signed contract and deposit.
7. Recheck availability transactionally.
8. Confirm reservation.
9. Continue with invoice, schedule, logistics, delivery note, return, and damage flows.

Evidence:

- Document A states:
  - `Réservation Créer dossier, vérifier disponibilité, générer proforma, confirmer après contrat + acompte.`
  - `-> Signature contrat + encaissement acompte`
  - `-> Recontrôle transactionnel des disponibilités`
  - `-> Confirmation réservation`
- Document B states:
  - `Proforma`
  - `Contrat + acompte`
  - `Réservation confirmée après signature et acompte.`

## Extracted status / state rules

Documents A and B do not provide one final repository-ready enum for Hahitantsoa event
status, but they do confirm business states and transitions:

- `proforma` is an estimate only and must not allocate or confirm reservation context;
- `confirmed reservation` exists only after:
  - signed contract;
  - deposit received;
  - availability rechecked;
- post-contract modification is not a direct contract edit; it requires amendment workflow;
- delivery, return, and damage states exist later in the operational flow.

Additional explicit status rules from the development guide sourced back to Document A:

- `R001` signed contract cannot be modified directly;
- `R002` proforma does not confirm reservation;
- `R004` reservation becomes confirmed only with signed contract, deposit received, and
  availability rechecked;
- `R005` confirmed shared materials become unavailable across Hahitantsoa and Titan;
- `R007` post-contract modification requires change proforma / amendment flow.

Payment-provider statuses are explicitly documented for MVola:

- `PENDING`
- `CONFIRMED`
- `FAILED`
- `CANCELLED`
- `RECONCILED`

These are payment statuses, not the Hahitantsoa reservation lifecycle enum.

## Extracted confirmation / inventory / document rules

Confirmed business rules from Documents A/B:

- Hahitantsoa is the complete-event scope and may include local, materials/articles,
  furniture, and services.
- Titan remains pure rental only and must not gain local or service behavior.
- Proforma is pre-confirmation only.
- Confirmation requires signed contract + deposit + availability recheck.
- Confirmed shared materials become unavailable cross-scope.
- Double-booking must be prevented at confirmation time.
- Post-contract changes require amendment workflow.
- Documents involved in the Hahitantsoa flow include proforma, contract, amendment,
  delivery note, invoice, receipt, and damage invoice.

## Conflicts with current repository decisions / code

### Conflict with DEC-003

`DEC-003` still says the exact Hahitantsoa lifecycle and statuses were not confirmed.
That was accurate for the earliest MVP planning context, but it is no longer the best current
statement once Documents A/B are treated as primary business sources.

Resolution:

- keep `DEC-003` as historical MVP planning context;
- do not use it alone to block lifecycle/confirmation planning;
- align it explicitly to Documents A/B.

### Gap versus current code

Current Hahitantsoa backend implementation covers only draft planning behavior:

- authenticated draft create/list/detail/update/delete;
- owner-scoped access;
- availability preview for a draft;
- soft-delete and audit hardening for draft lines.

Current code does not yet implement:

- proforma state or proforma-generation boundary for Hahitantsoa;
- contract/deposit readiness markers for Hahitantsoa draft confirmation;
- read-only confirmation preflight for Hahitantsoa;
- confirmation write path;
- amendment workflow for post-contract changes.

## Already implemented requirements

- Hahitantsoa and Titan remain separate scopes.
- Titan stays limited to rental-only item kinds in code.
- Hahitantsoa draft lines stay bounded to shared `material` and `article` inventory.
- Draft availability preview exists.
- Draft ownership and audit attribution are hardened.
- Soft-deleted drafts and lines are hidden from active draft surfaces.

## Missing backend requirements

Near-term missing requirements that are now supported by Documents A/B:

- explicit pre-confirmation boundary for Hahitantsoa drafts;
- confirmation preflight that validates:
  - customer present;
  - valid period;
  - active lines exist;
  - current availability still passes;
  - contract/deposit prerequisites are satisfied or explicitly absent;
- stable lifecycle service contract for transition from draft toward confirmed reservation;
- amendment / post-contract modification boundary after confirmation.

## Proposed next medium bundles

### F93 - Hahitantsoa draft confirmation preflight

Suggested branch:

- `feat/f93-hahitantsoa-draft-confirmation-preflight`

Boundary:

- backend-only read-only preflight service and API for an event draft;
- validate period, customer, active lines, and shared-item availability;
- expose blockers without creating inventory rows or confirming anything.

Explicit exclusions:

- no reservation confirmation write;
- no inventory blocking;
- no payment integration;
- no contract/document generation;
- no frontend work.

Expected tests:

- success preflight for valid owner draft;
- blockers for missing/invalid customer, empty active lines, invalid period, unavailable lines;
- second user gets `404`;
- no `InventoryAvailability` or reservation writes occur.

### F94 - Hahitantsoa draft confirmation prerequisites

Suggested branch:

- `feat/f94-hahitantsoa-draft-confirmation-prerequisites`

Boundary:

- add explicit backend markers for contract-signed and deposit-received prerequisites on the
  draft or dedicated bounded domain surface;
- keep this as prerequisite modeling only;
- no confirmation write yet.

Explicit exclusions:

- no payment provider integration;
- no contract PDF generation;
- no stock blocking;
- no frontend work.

Expected tests:

- prerequisite markers persist and validate coherently;
- preflight consumes those markers correctly;
- owner-scope and audit coverage remain intact.

### F95 - Hahitantsoa confirmation transaction contract

Suggested branch:

- `feat/f95-hahitantsoa-confirmation-transaction-contract`

Boundary:

- backend-only service contract for confirmation transition;
- enforce signed contract + deposit + availability recheck;
- keep it internal/private first if API exposure is still not approved.

Explicit exclusions:

- no invoice generation;
- no logistics;
- no frontend work;
- no broad Titan changes beyond shared availability integrity.

Expected tests:

- confirmation requires prerequisites;
- concurrent confirmation integrity checks;
- shared-item cross-scope blocking behavior only if the service writes are explicitly approved.

### F96 - Hahitantsoa post-contract amendment foundation

Suggested branch:

- `feat/f96-hahitantsoa-amendment-foundation`

Boundary:

- encode the rule that post-contract changes cannot mutate the confirmed contract directly;
- introduce a bounded amendment/proforma-of-change foundation only after F95 exists.

Explicit exclusions:

- no final document rendering;
- no billing expansion;
- no frontend work.

Expected tests:

- confirmed reservation rejects direct contract mutation;
- amendment/change-draft boundary is required.

## Recommendation

The next implementation bundle is clear enough to start with `F93`.

Reason:

- it is directly supported by Documents A/B;
- it remains read-only;
- it fits the accepted boundary of not yet writing inventory or commercial state;
- it converts the business lifecycle into a safe backend contract before any confirmation write.
