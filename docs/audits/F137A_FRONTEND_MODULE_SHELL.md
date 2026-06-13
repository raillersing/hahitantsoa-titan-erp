# F137A Frontend Module Shell Audit

## Objective

Harden the isolated frontend shell so the Titan and Hahitantsoa surfaces remain visibly
separate, navigable and limited to the existing approved backend APIs from `origin/main`.

## Approved Scope

- frontend-only shell and navigation changes;
- existing React/Vite frontend files;
- one audit document for this slice.

## Changed Frontend Behavior

- the active module is now represented in the URL hash:
  - `#titan`;
  - `#hahitantsoa`;
- the shell exposes explicit module navigation with a dedicated active-module panel;
- the Titan surface keeps inventory and reservation-draft preparation together;
- the Hahitantsoa surface stays read-only and separate from Titan operational flows;
- each module now shows a visible boundary note to reduce scope confusion.

## Confirmed Backend Contract Usage

F137A reuses only endpoints already present on `origin/main`:

- `GET /api/v1/inventory/items/`;
- `GET /api/v1/customers/`;
- `GET /api/v1/reservations/availability-summary/`;
- `GET /api/v1/reservations/available-item-previews/`;
- `GET /api/v1/reservations/items/<uuid>/availability-preview/`;
- `GET /api/v1/reservations/drafts/`;
- `GET /api/v1/reservations/drafts/<uuid>/`;
- `POST /api/v1/reservations/drafts/`;
- `PATCH /api/v1/reservations/drafts/<uuid>/`;
- `GET /api/v1/hahitantsoa/discovery-items/`.

No endpoint, payload, permission model or backend workflow was invented for this slice.

## Explicit Non-Goals

F137A does not add:

- backend changes of any kind;
- new module routes on the backend;
- reservation confirmation;
- payment, invoice or contract flows;
- Hahitantsoa write actions;
- Titan exposure of `venue`, `local`, `room`, `hall` or `service`;
- dependency changes.

## Validation Focus

- module navigation defaults safely to Titan when the hash is absent or invalid;
- Hahitantsoa can be opened directly from the URL hash;
- switching modules keeps the Hahitantsoa/Titan boundary visible in the shell;
- existing session-authenticated frontend API calls remain unchanged.
