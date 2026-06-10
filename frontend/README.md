# Frontend

F61 bootstraps the minimal React/Vite/TypeScript frontend for local MVP work.

The first screen reads the existing authenticated inventory API:

```text
GET /api/v1/inventory/items/
```

## Local usage

Start the backend first, then sign in through the backend Browsable API:

```text
http://127.0.0.1:8000/api-auth/login/
```

Then start the frontend:

```sh
cd frontend
npm install
npm run dev
```

The Vite dev server proxies `/api` and `/api-auth` to `http://127.0.0.1:8000`.
The inventory request uses `credentials: "include"` and expects the existing
Django session cookie to be available.

## Tests

F62 adds the minimal frontend test foundation with Vitest, jsdom and React Testing Library.

Run the focused frontend tests:

```sh
cd frontend
npm test
```

The early F62 tests covered the existing inventory page loading, successful rendering, empty state, request contract and error states. Since F101, the frontend tests also cover the draft-only reservation creation flow. The frontend still does not add a dedicated login workflow, reservation confirmation workflow, payment, invoice, contract or PDF generation workflow.

## Availability panel

F63 adds a read-only availability panel that calls the existing authenticated APIs:

```text
GET /api/v1/reservations/availability-summary/
GET /api/v1/reservations/available-item-previews/
GET /api/v1/reservations/items/<uuid:inventory_item_id>/availability-preview/
```

The panel accepts a local start and end datetime, converts both values to timezone-aware ISO datetimes, and displays the summary, available item previews and item-specific availability previews.

Frontend API calls and response contracts are kept in `src/api.ts` and `src/types.ts`. Native `fetch` and the existing Django session remain the only request mechanism.

F65 adds a short helper note explaining that the availability check is read-only, requires a backend session created through `/api-auth/login/`, and does not itself create a reservation.

F99/F101 extend the panel with a draft-only creation flow:

```text
GET /api/v1/customers/
POST /api/v1/reservations/drafts/
```

The user can select an existing customer and create a `ReservationDraft` from the available items for the checked period. This action creates only a draft. It does not confirm the reservation, block inventory, process payment, generate an invoice, generate a contract or generate a PDF.

## Hahitantsoa discovery surface

F80 adds a simple scope switch that keeps Titan inventory and Hahitantsoa discovery visibly
separate. The Hahitantsoa surface consumes the existing authenticated read-only endpoint:

```text
GET /api/v1/hahitantsoa/discovery-items/
```

It displays only the confirmed discovery `concept` and `label` fields. It adds no reservation,
contract, pricing, payment, customer, persistence or commercial workflow.

The complete local demo flow is documented in [`docs/runbooks/mvp-local-demo-flow.md`](../docs/runbooks/mvp-local-demo-flow.md).

F66 extends the helper note with guidance for selecting a period that overlaps the next two-hour local demo window. Manual acceptance is documented in [`docs/runbooks/mvp-local-demo-acceptance.md`](../docs/runbooks/mvp-local-demo-acceptance.md).

## Scope

F61 through F63 did not add a frontend login workflow, reservation creation form,
router, state management library, design system or commercial workflow.

F101 now adds a limited draft-only reservation creation control inside the availability panel. This is not a confirmation flow and does not introduce payment, invoice, contract, PDF generation, stock, quantity, unit, pricing or commercial workflow behavior.

Titan remains limited to materials, articles and material packs. The frontend must not
introduce venue, local, room, hall, event service, ancillary service, contract,
invoice, payment, stock, quantity, unit or pricing behavior without a separately approved task.
