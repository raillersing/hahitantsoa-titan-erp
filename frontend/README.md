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

The tests cover the existing inventory page loading, successful rendering, empty state, request contract and error states. They do not add or test a frontend login workflow or reservation creation workflow.

## Availability panel

F63 adds a read-only availability panel that calls the existing authenticated APIs:

```text
GET /api/v1/reservations/availability-summary/
GET /api/v1/reservations/available-item-previews/
```

The panel accepts a local start and end datetime, converts both values to timezone-aware ISO datetimes, and displays the summary and available item previews.

Frontend API calls and response contracts are kept in `src/api.ts` and `src/types.ts`. Native `fetch` and the existing Django session remain the only request mechanism.

F65 adds a short helper note explaining that the check is read-only, requires a backend session created through `/api-auth/login/`, and does not create a reservation.

The complete local demo flow is documented in [`docs/runbooks/mvp-local-demo-flow.md`](../docs/runbooks/mvp-local-demo-flow.md).

F66 extends the helper note with guidance for selecting a period that overlaps the next two-hour local demo window. Manual acceptance is documented in [`docs/runbooks/mvp-local-demo-acceptance.md`](../docs/runbooks/mvp-local-demo-acceptance.md).

## Scope

F61 through F63 do not add a frontend login workflow, reservation creation form,
router, state management library, design system or commercial workflow.

Titan remains limited to materials, articles and material packs. F61 does not
introduce venue, local, room, hall, event service, ancillary service, contract,
invoice, payment, customer, stock, quantity, unit or pricing behavior.
