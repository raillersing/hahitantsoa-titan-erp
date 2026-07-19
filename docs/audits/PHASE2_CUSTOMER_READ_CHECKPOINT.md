# Phase 2 — Customers and prospects read-only checkpoint

Date: 2026-07-19
Baseline: `5e6b2377f4f03b8d760065b2f89a456bafbd806c`

## Evidence

- Backend customer read contract: PR #494, merged with green CI.
- Customer list API integration: PR #495, merged with green CI.
- Customer detail API integration: PR #496, merged with green CI.
- Focused frontend regression: 3 files, 20 tests passed.
- Production build: `npm run build` passed.
- Latest main CI: PR #497 main run `29666720856`, success.

## Scope proven

- Customer list reads use `/api/v1/customers/` with loading, empty/error and retry states.
- Customer detail reads use `/api/v1/customers/:id/` with loading, 401, 403, 404 and retry states.
- Lifecycle and party type are read from the backend contract.
- No silent mock fallback feeds the connected list or detail runtime.
- The approved prototype list and detail interface remains mounted.

## Explicit limitations

This checkpoint does not claim write persistence. Customer creation, modification,
prospect conversion, reservation history, appointments, and financial history remain
Phase 3 or later contracts. The detail page displays an explicit empty history state
until a dedicated backend history endpoint is approved.

## Decision

Phase 2 read-only is complete for the approved customer list/detail scope. The next
bounded implementation is Phase 3A: customer/prospect writes and server validation.
