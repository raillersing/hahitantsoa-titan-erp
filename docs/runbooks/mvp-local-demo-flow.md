# MVP Local Demo Flow

## Scope

This runbook prepares a local/dev demonstration of the authenticated, read-only inventory and reservations availability surfaces.

It does not create a persistent reservation, write API, frontend login workflow, reservation creation workflow, contract, invoice, payment, customer, stock, quantity, unit, pricing, CI or deployment configuration. The `reserved` value seeded below is only a technical `InventoryAvailability` status.

Titan remains limited to `material`, `article` and `material_pack`.

## Safety

Never print, paste into logs, or commit `.env`, passwords, tokens or other secrets.

The local dev user command reads `DJANGO_DEV_USERNAME`, `DJANGO_DEV_PASSWORD` and optional `DJANGO_DEV_EMAIL` from the environment already loaded by Django. This runbook intentionally does not provide values for them.

## Prepare The Backend

From the repository root, verify the branch and working tree, then start the local services:

```sh
git branch --show-current
git status --short
docker compose --env-file .env up -d db redis backend
docker compose --env-file .env exec backend python backend/manage.py migrate --noinput
```

Create or update the local standard user, demo inventory items and demo availability periods:

```sh
docker compose --env-file .env exec backend python backend/manage.py seed_dev_user
docker compose --env-file .env exec backend python backend/manage.py seed_demo_inventory
docker compose --env-file .env exec backend python backend/manage.py seed_demo_availability
```

`seed_demo_availability` blocks `Sonorisation standard`, marks `Projecteur LED` with the technical availability status `reserved`, and leaves `Pack sonorisation + eclairage` available for the next two-hour demo period. Re-running the command updates its own rows without creating duplicates or changing unrelated availability rows.

## Run The Frontend

Open the backend session login page and sign in with the local dev user:

```text
http://127.0.0.1:8000/api-auth/login/
```

Start the frontend in another terminal:

```sh
cd frontend
npm install
npm run dev
```

Open the Vite URL shown in the terminal. Confirm that:

- the inventory catalog contains only Titan materials, articles and material packs;
- the Availability panel states that it is read-only and does not create a reservation;
- a check overlapping the seeded demo period excludes `Sonorisation standard` and `Projecteur LED`;
- `Pack sonorisation + eclairage` remains available;
- no login form or reservation creation workflow exists in the frontend.

## Validate And Stop

Use [mvp-local-smoke-validation.md](mvp-local-smoke-validation.md) for the broader backend/frontend smoke validation.

Record the manual browser result with [mvp-local-demo-acceptance.md](mvp-local-demo-acceptance.md). This acceptance scenario is manual verification, not automated end-to-end coverage.

Stop the local services after the demo:

```sh
docker compose --env-file .env down
git status --short
```
