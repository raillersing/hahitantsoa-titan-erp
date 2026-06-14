# F126C Commercial Document Service Completion

## Scope

F126C closes the backend service chain started in F126B for Titan proforma draft preview.
The slice stays backend-only and side-effect free.

## Changes

- Added a dedicated service entrypoint for Titan proforma draft preview payload generation.
- Moved preview payload assembly from the API view path into `apps.documents.services`.
- Kept the DRF serializer as a schema/response contract instead of the place where business payload is built.
- Consolidated document instance snapshot field mapping behind a service helper so preview and runtime preparation now follow the same service-oriented direction.

## Preserved Contracts

- The public preview payload shape is unchanged.
- `scope_flags.reservation_confirmed` remains forced to `false` in preview responses to avoid an unintended public behavior change in this slice.
- No PDF runtime generation was introduced.
- No payment, invoice, contract, receipt, inventory, migration, frontend, or script changes were introduced.

## Validation

- Backend scope guard
- Compose CI config check
- No-migration check
- Ruff lint
- Ruff format check
- Focused backend pytest selection for document/proforma/commercial/reservation flows

## Stop Conditions

No stop condition was triggered during this slice.
