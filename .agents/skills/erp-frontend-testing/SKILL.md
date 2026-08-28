---
name: erp-frontend-testing
description: "Select proportionate frontend evidence for changed behavior: user-centric component tests, real-contract journeys, and deterministic visual or print regression when source fidelity matters. Use when authoring or reviewing frontend tests; builds and mocks alone do not prove a workflow."
---

# ERP Frontend Testing

Choose evidence that can falsify the claimed outcome. Start from the user journey
and the approved source, then test only the changed risk.

## Evidence ladder

1. Test pure parsing, formatting, and state transitions directly when they carry
   business meaning.
2. Use React Testing Library for visible labels, keyboard interaction, validation,
   loading, empty, error, and success states. Prefer user-observable behavior to
   component internals.
3. Test real API integration whenever a changed route, authorization, persistence,
   reload, error response, or download is part of the claim. Mocks may isolate a
   component but cannot be the sole proof for those boundaries.
4. Run a browser journey for cross-screen flows, authenticated routes, browser
   navigation, print/download behavior, or data that must survive a reload.
5. For faithful replication, use deterministic screenshot comparison: fixed
   viewport, browser, locale, timezone, fonts, fixture data, and approved golden.
   Review every golden update as a product change.
6. For printable documents, compare the browser preview and exported PDF page by
   page: page size, page count, breaks, margins, header/footer, logo, typography,
   colours, wording, and variable placement.

## Reservation lifecycle acceptance

For an explicit lifecycle audit, a phase checkpoint, or a change to a cross-screen
persisted transition, use `erp-reservation-lifecycle-audit` and add the relevant
real-backend browser journey. A bounded component correction uses focused component
and contract evidence first; do not rerun an entire lifecycle merely because it is
adjacent to one of these domains. Browser fixtures must be self-provisioning and
must not depend on a hard-coded user that may be absent from the mounted database.

For the transition under test, assert the outgoing request, persisted API response,
visible state, and a browser reload. Compare assistant totals with the generated
HTML/PDF and closeout totals when commercial values or documents changed. Verify
stock before dispatch, after dispatch, and after validated return when stock changed.
Mocked component coverage remains useful, but cannot qualify this journey.

Before accepting component coverage, trace the production route in `App.tsx` and
`AppShell.tsx`. Tests for an orphan operational panel do not prove the routed
prototype page. A success toast, local state change, or modified DOM label without
an observed API write and persisted reload is a failed test outcome.

## Required test notes

For each changed behavior, record the level used, fixture/source, command, and
what remains unproven. State `UNCONFIRMED` rather than implying a mock or a build
proved live behavior.

## Guardrails

- Keep tests focused on the changed risk; do not add boilerplate coverage merely
  to increase a number.
- Do not assert private implementation details when an accessible interaction or
  visible result can express the requirement.
- Exercise permission-denied and failed-request states when the journey touches
  sensitive data or writes.
- Reuse the repository's existing test runner and fixtures before adding a test
  library, global mock, or screenshot framework.
- Fail the test setup explicitly when its authenticated fixture cannot be
  provisioned; a login failure must not masquerade as a business-journey result.
- Do not approve a visual replica from textual HTML, a unit test, or a successful
  PDF generation alone. Inspect the rendered result against the approved source.
