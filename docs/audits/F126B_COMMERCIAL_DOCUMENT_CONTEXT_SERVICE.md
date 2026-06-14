# F126B Commercial Document Context Service

## Summary

F126B-SVC delivers a backend-only commercial document context service slice.

It keeps the commercial context side-effect free, routes Titan proforma preview through
that context, and preserves the existing preview payload shape.

## What changed

- added a documents service entrypoint to build a commercial document context from an
  active `ReservationDraft`
- integrated Titan proforma preview with that context
- kept preview payload compatibility by mapping the context back to the existing public
  serializer shape

## What did not change

- no migration
- no PDF runtime generation
- no payment, invoice, contract, receipt, or inventory write behavior
- no frontend change
- no storage path or public URL exposure

## Stop-condition result

No stop condition was triggered during this slice:

- no migration required
- no ambiguous source of truth detected
- no public payload drift required
- no PDF runtime requirement introduced
- no payment or inventory write requirement introduced

## Preview integration note

Titan proforma preview was integrated in this slice because the existing payload shape
could be preserved while using the commercial document context as the backend source.
