# F127A - Payment and deposit backend foundation decision

## 1. Status

F127A is documentation-only.

It records the payment/deposit backend foundation boundary after the reservation
lifecycle prerequisite markers and before any payment runtime implementation.

F127A does not implement payments.

## 2. Current state

The reservation lifecycle already has a minimal prerequisite marker for required
deposit readiness:

- `ReservationDraft.required_deposit_received_at`;
- `ReservationDraft.required_deposit_received_by`.

Those fields are currently reservation lifecycle prerequisite markers. They are
not a payment ledger, payment provider transaction, receipt, accounting record,
refund record, or invoice record.

## 3. Decision

The existing required-deposit marker remains the minimal confirmation
prerequisite signal for now.

A future payment/deposit domain must be introduced in a separately approved
implementation slice. It must not be silently bundled with document previews,
PDF generation, invoice generation, receipt generation, provider integration,
refunds, or reservation confirmation API exposure.

## 4. Future minimal payment/deposit model, not implemented by F127A

A later implementation slice may introduce a durable payment/deposit model with
fields such as:

- reservation draft reference;
- amount;
- currency;
- payment method;
- received timestamp;
- receiving actor;
- status;
- optional external reference;
- notes;
- soft-delete or cancellation semantics if needed.

The exact model is not approved by F127A.

## 5. Future receipt behavior, not implemented by F127A

A future receipt workflow must be separate from the payment/deposit foundation.
It may depend on:

- durable payment/deposit records;
- commercial document context;
- receipt template validation;
- audit behavior;
- explicit API and permission decisions.

F127A does not generate receipts.

## 6. Explicit exclusions

F127A does not add:

- payment model;
- deposit model;
- migration;
- payment API;
- provider integration;
- external transaction reference handling;
- receipt generation;
- invoice generation;
- refund workflow;
- accounting workflow;
- frontend behavior;
- reservation confirmation API;
- Hahitantsoa write behavior;
- broad RBAC;
- OpenClaw.
