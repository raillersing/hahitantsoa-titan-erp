---
name: erp-frontend-state-forms
description: Review Titan ERP React form state and submission lifecycles, especially customer and reservation assistants, attachments, payments, and operational transitions. Use when these forms or data state machines change; do not load for static presentation work.
---

## What I do

Protect the actual Titan ERP form journeys from late validation, lost uploads,
partial-payment dead ends, duplicate writes, and local state that disagrees with
the backend.

## Checklist

- [ ] Form inputs are controlled (value + onChange), not uncontrolled refs
- [ ] Validation runs on blur and on submit — not only on submit
- [ ] Validation errors are shown inline per field, not aggregated at the top only
- [ ] Required fields are marked visibly and enforced client-side before API call
- [ ] Submit button is disabled while the request is in flight (prevents double-submit)
- [ ] Form state resets after successful submission
- [ ] Optimistic updates are used only for non-critical UI — critical writes wait for API confirmation
- [ ] Shared state (user, permissions, filters) is lifted to a parent or context, not duplicated
- [ ] No direct DOM manipulation for visibility or class toggling — use React state
- [ ] URL query params for filter/sort state are preferred over component-local state when persistence matters

## Reservation assistant gates

For `ReservationNewPage.tsx`, customer creation, and the Hahitantsoa/Titan detail
pages, also require:

- [ ] `goNext` cannot bypass the required fields of the current step
- [ ] legal fields follow party type: CIN/passport for individuals; NIF/STAT/RCS for companies
- [ ] dedicated identity/legal attachments remain adjacent to their fields and are excluded from the generic attachment category list
- [ ] every queued attachment is uploaded and linked to the customer and relevant Titan/Hahitantsoa draft before assistant state is cleared
- [ ] a generated proforma does not prevent later payment attachments from uploading
- [ ] the UI follows the supported deposit contract: do not promise partial payments when the backend atomic recording requires the configured deposit in one transaction
- [ ] failure after one successful sub-write resumes safely without duplicating the customer, draft, document, payment, or stock effect
- [ ] critical completion labels describe the real backend transition; never label contract generation as dossier closeout
- [ ] after success, reload from the API and derive the next action from persisted truth rather than booleans such as `paymentRecorded`

## When to use me

Load during form or data-fetching implementation. For a complete reservation
journey, load `erp-reservation-lifecycle-audit` as the governing workflow.
