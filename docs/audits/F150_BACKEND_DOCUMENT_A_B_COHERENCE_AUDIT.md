# F150 Backend Document A + B Coherence Audit

## Executive Verdict

**Partially coherent**

## Completion Confidence

**Medium**

Reasoning:

- The live backend on `main` already covers most of the structural rules from Documents A and B:
  Titan boundary, shared inventory, read-only discovery, reservation drafts, availability helpers,
  documents runtime, payments, billing, logistics, inventory returns, damage/loss settlement,
  identity, and audit scaffolding are all present.
- The remaining gaps are not “blank app” gaps; they are mostly coherence gaps between the
  high-level business workflow in Documents A/B and the current fragmentation of commercial
  closeout behavior across apps.
- The task queue is current enough to separate merged work from pending work, and it reports no
  open backend commercial queue PRs, which lowers uncertainty.

## Evidence Base

Primary sources used:

- [Document A PDF](../references/source/Document_A_CDC_Technique_Evenementiel_v3.4.pdf)
- [Document B PDF](../references/source/Document_B_Presentation_Metier_Evenementiel_v3.4.pdf)
- [DEC-001](../decisions/DEC-001-titan-scope-validated.md)
- [DEC-002](../decisions/DEC-002-inventory-availability-domain.md)
- [DEC-003](../decisions/DEC-003-hahitantsoa-mvp-scope.md)
- [DEC-004](../decisions/DEC-004-inventory-availability-soft-delete-semantics.md)
- [DEC-005](../decisions/DEC-005-reservation-confirmation-domain-contract.md)
- [DEC-006](../decisions/DEC-006-reservation-sensitive-permissions-attribution-audit.md)
- [Scope](../business-rules/scope.md)
- [Reservations](../business-rules/reservations.md)
- [Billing and payments](../business-rules/billing-and-payments.md)
- [Inventory](../business-rules/inventory.md)
- [Logistics](../business-rules/logistics.md)
- [Sensitive documents and audit](../business-rules/sensitive-documents-and-audit.md)
- [Orchestrator task queue](../ai-agents/orchestrator-task-queue.md)
- Backend app READMEs and tests under `backend/apps/` and `tests/backend/`

## Document A Mapping Table

| Document A requirement | Current backend on main | Verdict | Source trace |
|---|---|---|---|
| Titan is pure rental of materials/articles/material packs; no local, room, hall, or service | Enforced in Titan scope guards, inventory kind restrictions, and reservation scope docs | Coherent | [DEC-001](../decisions/DEC-001-titan-scope-validated.md), [DEC-002](../decisions/DEC-002-inventory-availability-domain.md), [reservations](../business-rules/reservations.md), `backend/apps/inventory/README.md`, `backend/apps/reservations/README.md` |
| Hahitantsoa is the complete-event scope and may include local/service concepts | Present in Hahitantsoa domain docs and discovery/read-only surfaces; current backend keeps this separate from Titan | Coherent | [DEC-003](../decisions/DEC-003-hahitantsoa-mvp-scope.md), `backend/apps/hahitantsoa/README.md` |
| Reservation confirmation requires signed contract + deposit + transactional availability revalidation | Backend has preflight/confirmation surfaces and confirmation-related tests, but full commercial confirmation remains a guarded future slice, not a general open write path | Partially coherent | [DEC-005](../decisions/DEC-005-reservation-confirmation-domain-contract.md), [DEC-006](../decisions/DEC-006-reservation-sensitive-permissions-attribution-audit.md), `tests/backend/test_reservations_confirmation.py`, `tests/backend/test_reservations_confirmation_api.py` |
| Workflow order: dossier, availability, offer selection, proforma, contract, signed contract + deposit, recheck, confirmation, billing, logistics, return, damage/remediation, closeout | Backend contains the major building blocks, but the end-to-end workflow is split across multiple apps rather than expressed as one coherent operational flow | Partially coherent | `backend/apps/reservations/README.md`, `backend/apps/documents/README.md`, `backend/apps/billing/README.md`, `backend/apps/logistics/README.md`, `backend/apps/inventory/README.md` |
| Proforma is an estimate, not confirmation | Explicitly respected in reservations and billing rules | Coherent | [reservations](../business-rules/reservations.md), [billing and payments](../business-rules/billing-and-payments.md) |
| Contract modification uses amendment workflow, not direct edit | Hahitantsoa app has amendment-request foundation and Document B explicitly requires amendment after contract | Mostly coherent | [Document B PDF](../references/source/Document_B_Presentation_Metier_Evenementiel_v3.4.pdf), `backend/apps/hahitantsoa/README.md` |
| Inventory shared across Hahitantsoa and Titan | Availability rules and shared-availability surfaces exist; confirmed use across scopes is documented | Coherent | [Inventory](../business-rules/inventory.md), [DEC-002](../decisions/DEC-002-inventory-availability-domain.md), `backend/apps/inventory/README.md`, `backend/apps/hahitantsoa/README.md` |
| Documents include contract, amendment, BL, proforma, invoice, damage/remediation invoice, discharge, regulations, annexes | Document registry and runtime foundations exist, including commercial context and generated document instances | Coherent | `backend/apps/documents/README.md`, `tests/backend/test_documents_*` |
| Caution, excess, refund, damage/loss, and remediation flows exist | Backend has billing invoice and refund foundations plus damage/loss settlement and excess receivable foundations, but the workflow is fragmented across billing, payments, inventory, and documents | Partially coherent | `backend/apps/billing/README.md`, `backend/apps/payments/README.md`, `backend/apps/inventory/README.md`, `backend/apps/documents/excess_receivable.py`, `tests/backend/test_payments_refund.py`, `tests/backend/test_inventory_damage_loss_settlement*_*.py` |

## Document B Mapping Table

| Document B requirement | Current backend on main | Verdict | Source trace |
|---|---|---|---|
| Hahitantsoa and Titan are clearly separated business scopes | Strongly respected in scope rules, discovery, and inventory guards | Coherent | [scope](../business-rules/scope.md), `backend/apps/hahitantsoa/README.md`, `backend/apps/inventory/README.md` |
| Titan never presents local or service | Explicitly enforced in Titan scope docs and guards | Coherent | [DEC-001](../decisions/DEC-001-titan-scope-validated.md), [scope](../business-rules/scope.md), [reservations](../business-rules/reservations.md) |
| Documents are auto-filled from existing templates | Document template registry, commercial context, and runtime generation are present | Coherent | `backend/apps/documents/README.md`, `tests/backend/test_documents_runtime_generation.py` |
| Payment methods include Cash, MVola, Cheque, Virement | Billing and payments docs define accepted methods; payment tests exist | Coherent but operationally partial | [billing and payments](../business-rules/billing-and-payments.md), `backend/apps/payments/README.md`, `tests/backend/test_payments_api.py` |
| Receipts are generated for valid payments | Payment receipt generation exists in the documents domain and billing/payment foundations are implemented | Coherent | `backend/apps/documents/payment_receipts.py`, `backend/apps/billing/README.md`, `tests/backend/test_documents_services.py` |
| Logistics distinguishes preparation, handover, and return | Logistics app exists, plus return-operation and stock-movement foundations exist | Mostly coherent | `backend/apps/logistics/README.md`, `tests/backend/test_inventory_return_operation_api.py`, `tests/backend/test_inventory_stock_movement_api.py` |
| Return status distinguishes intact, broken, missing | Return-operation and damage/loss settlement foundations exist | Mostly coherent | [logistics](../business-rules/logistics.md), `backend/apps/inventory/README.md`, `tests/backend/test_inventory_return_operation_api.py`, `tests/backend/test_inventory_damage_loss_settlement_api.py` |
| Documents/private customer attachments are handled privately | Sensitive documents and audit rules are documented; document/private artifact foundations exist | Mostly coherent | [sensitive documents and audit](../business-rules/sensitive-documents-and-audit.md), `backend/apps/documents/README.md`, `tests/backend/test_documents_instance_private_artifact_api.py` |
| Personnel, cashbox, notifications, and broader operational management are part of the ERP | Backend has identity, billing, payments, logistics, and audit foundations, but not the full operational suite described in Document B | Partially coherent | [Document B PDF](../references/source/Document_B_Presentation_Metier_Evenementiel_v3.4.pdf), `backend/apps/identity/README.md`, `backend/apps/audit/README.md`, `backend/apps/billing/README.md`, `backend/apps/logistics/README.md` |

## ADR/DEC Compliance Table

| ADR / DEC | Expected rule | Current backend on main | Verdict | Source trace |
|---|---|---|---|---|
| ADR-004 | Confirmation only after signed contract, received deposit, and transactional revalidation | Confirmation-related contract exists, but the repo still treats this as a guarded future sensitive-write slice rather than a general business action | Coherent at contract level, not complete as an implemented flow | [DEC-005](../decisions/DEC-005-reservation-confirmation-domain-contract.md), `tests/backend/test_reservations_confirmation.py` |
| ADR-005 | Shared inventory availability across scopes | Availability and shared-availability support exists and is used by reservation helpers | Coherent | [DEC-002](../decisions/DEC-002-inventory-availability-domain.md), [Inventory](../business-rules/inventory.md), `backend/apps/inventory/README.md` |
| ADR-006 | Titan excludes venues/services | Titan scope is consistently restricted in inventory/reservation/business rules | Coherent | [DEC-001](../decisions/DEC-001-titan-scope-validated.md), [scope](../business-rules/scope.md) |
| ADR-007 | Private sensitive documents | Document runtime and private artifact foundations exist; public exposure is not the default | Coherent, with runtime breadth still growing | `backend/apps/documents/README.md`, [sensitive documents and audit](../business-rules/sensitive-documents-and-audit.md) |
| ADR-009 | Django sessions and backend permissions are the auth basis | Backend uses session-backed auth and reservation-sensitive permission guards; identity adds role-management helpers | Coherent | `backend/apps/identity/README.md`, `backend/apps/audit/README.md`, `tests/backend/test_drf_session_login.py` |
| DEC-001 | Titan pure rental, no local/service | Enforced everywhere relevant | Coherent | [DEC-001](../decisions/DEC-001-titan-scope-validated.md) |
| DEC-002 | Availability periods, half-open intervals, blocked/reserved statuses | Present in inventory/reservation helpers and tests | Coherent | [DEC-002](../decisions/DEC-002-inventory-availability-domain.md), `tests/backend/test_inventory_availability_*` |
| DEC-003 | Hahitantsoa MVP read-only first, later doc-aware lifecycle | Current backend now goes beyond read-only, but still does not collapse into Titan | Mostly coherent | [DEC-003](../decisions/DEC-003-hahitantsoa-mvp-scope.md), `backend/apps/hahitantsoa/README.md` |
| DEC-004 | Soft-deleted availability rows must not block active conflicts | Current implementation set is aligned with the accepted semantics through the inventory helper layer and tests | Coherent | [DEC-004](../decisions/DEC-004-inventory-availability-soft-delete-semantics.md), `tests/backend/test_inventory_availability_*` |
| DEC-005 | Confirmation contract, source-state gate, durable attribution, and anti-shortcut guard | The contract is documented and the backend has supporting preflight/authorization work, but the full sensitive write path is not yet a general capability | Partially coherent | [DEC-005](../decisions/DEC-005-reservation-confirmation-domain-contract.md) |
| DEC-006 | Sensitive reservation writes require explicit backend authorization, attribution, and audit | The backend has the foundations: reservation-sensitive access, audit app, and identity role management | Mostly coherent | [DEC-006](../decisions/DEC-006-reservation-sensitive-permissions-attribution-audit.md), `backend/apps/audit/README.md`, `backend/apps/identity/README.md` |

## Backend Module Compliance Table

| Backend module | Implemented behavior on main | Test coverage signal | Coherence assessment |
|---|---|---|---|
| `backend/apps/hahitantsoa` | Discovery, shared-availability read surface, event drafts, confirmation-preflight-related boundary work | Strong: discovery, API, model, scope, selector, confirmation tests exist | Mostly coherent; still not the full Document A workflow |
| `backend/apps/reservations` | Period validation, shared availability checks, preview, availability helpers, draft-oriented surfaces | Strong: many focused reservation tests, including boundary and consistency tests | Coherent on boundary and planning layer; full confirmation remains guarded |
| `backend/apps/inventory` | Titan item kinds, shared inventory, availability helpers, stock movement, returns, damage/loss settlement | Strong: numerous model/service/API tests | Coherent, though the closeout chain spans several modules |
| `backend/apps/documents` | Registry, commercial context, runtime generation, payment receipts, excess receivable docs | Strong: multiple registry/runtime/service tests | Coherent and appropriately foundational |
| `backend/apps/payments` | Payment domain foundation and refund/execution paths | Moderate to strong: API/model/service/negative-permission/refund tests exist | Mostly coherent; still not the full billing/payment lifecycle from Documents A/B |
| `backend/apps/billing` | Billing invoice foundation for damage/loss excess receivables and settlement | Moderate: billing API/model/service tests exist | Mostly coherent; the broader invoicing/caution cadence is still partial |
| `backend/apps/logistics` | Delivery/pickup event management | Moderate: models/services/API tests exist | Partial: the prep/handover/return story exists, but it is narrower than Document B’s broader logistics language |
| `backend/apps/identity` | Application roles, role assignment, authorization helpers, session-based access | Strong: identity API/model/service/selector tests exist | Coherent with ADR-009 and sensitive-write guardrails |
| `backend/apps/audit` | Audit event recording/retrieval and on-commit recording | Moderate: audit API and transaction-safety tests exist | Coherent for the current sensitive-event foundation |
| `backend/apps/customers` | Read-only customer foundation | Moderate: readonly/write tests exist | Coherent as a bounded customer base, but not a commercial workflow on its own |
| `backend/apps/common` | Technical shared base models and dev seed utility | Basic tests for common app config and abstract models | Coherent; no business rule drift apparent |

## Open PR Queue Risk Table

| Queue item | Status | Risk to Documents A/B coherence | Assessment |
|---|---|---|---|
| Backend commercial queue | No open PRs reported in the task queue | Low | The queue says the commercial backend queue is already merged and closed; this means the current audit should not treat pending backend commercial work as shipped. |
| F147F frontend worktree | Paused and must not be touched | Low for backend audit, high if accidentally mixed | No backend action should depend on it. It is a hard scope boundary, not a blocker. |
| Next backend bundle in queue | Identity role list filtering and negative permission tests | Low | This is adjacent to authorization hygiene and does not appear to threaten Document A/B coherence. |

## Bugs, Risks, and Gaps

1. **Commercial closeout is split across multiple apps rather than expressed as one end-to-end backend workflow.**
   - Documents A/B describe a linear business flow.
   - Main already has the relevant pieces, but they are distributed across reservations, documents, billing, payments, logistics, and inventory.
   - This is a coherence gap, not a missing-foundation gap.

2. **Billing/caution/excess/refund behavior is only partially unified.**
   - Billing, payments, and document generation are present.
   - The current surface is strong for foundations, but the complete business chain for caution/excess/refund is still not a single cohesive backend narrative.

3. **Logistics is narrower than the business prose in Document B.**
   - The backend has delivery/pickup event management and inventory return/damage settlement foundations.
   - Document B describes a broader operational logistics story, including handover and return handling tied to commercial closeout.

4. **Reservation confirmation remains a guarded future sensitive-write slice.**
   - The repository already has confirmation-related contract and preflight work.
   - But full confirmation is still intentionally controlled by accepted decisions and must not be treated as a generic existing business capability.

5. **Task queue state is usable but should still be treated as live governance, not as evidence of completeness by itself.**
   - The queue correctly separates merged work from pending work.
   - It should continue to be checked before any next backend bundle.

## Required Corrections Before Continuing Backend Development

1. Preserve the Titan/Hahitantsoa boundary as a hard invariant in any next backend bundle.
2. Keep reservation confirmation and any sensitive write path behind the accepted authorization, attribution, and audit rules.
3. Treat commercial closeout as an explicit cross-app workflow problem, not as isolated feature completion in one app.
4. Do not broaden the next backend bundle into frontend, Antigravity/tooling, or F140D work.
5. Use the current queue as the live planning source, but do not mistake “merged and present” for “coherent end-to-end” where the business narrative is still fragmented.

## Recommended Next Backend Bundle After Audit

**Identity role list filtering and negative permission tests**

Why this is still the right next bundle:

- it matches the current task queue recommendation;
- it tightens authorization hygiene without disturbing commercial workflows;
- it is a safer incremental step than reopening commercial closeout logic before this audit is reviewed.

## Hard-Stop Decisions Still Needed

None for this audit task.

Reason:

- Document A and Document B are available and extractable.
- Accepted decisions and ADRs are identifiable.
- The task queue is readable and does not show an open backend commercial queue.
- No frontend, Antigravity/tooling, F140D, `.env`, secrets, or quarantine changes were needed.

## Source-Trace Notes

- Document A explicitly states the Titan/Hahitantsoa split, the proforma → contract → signed contract + deposit → recheck → confirmation flow, and the commercial follow-on documents.
- Document B restates the same split in simpler business language and adds the operational story around inventory, photos, documents, personnel, caisse, returns, and damage/remediation.
- The current backend on `main` respects the hard boundary rules, but the business workflow is still assembled from multiple bounded apps rather than delivered as one fully coherent commercial pipeline.
