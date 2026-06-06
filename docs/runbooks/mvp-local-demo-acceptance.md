# MVP Local Demo Acceptance

## Scope And Safety

This checklist records manual acceptance of the local/dev MVP demo only. It is not an automated end-to-end test and does not claim production readiness.

Record the final evidence and human observations in [mvp-local-demo-acceptance-result.md](mvp-local-demo-acceptance-result.md). The latest recorded result is maintained in that result document.

- [ ] The operator confirmed that no command printed `.env`, passwords, tokens or other secrets.
- [ ] The operator confirmed that `reserved` is only a technical `InventoryAvailability` status, not a persistent business reservation.
- [ ] The operator confirmed that Titan remains limited to `material`, `article` and `material_pack`.

Pass/fail notes:

```text
Result:
Notes:
```

## Repository And Services

- [ ] The active branch and Git status were checked.
- [ ] PostgreSQL, Redis and backend services are running.
- [ ] Local database migrations were applied only if needed.
- [ ] No secrets were printed while starting or checking services.

Pass/fail notes:

```text
Result:
Notes:
```

## Demo Data

- [ ] The local dev user was seeded with `seed_dev_user`.
- [ ] Demo inventory was seeded with `seed_demo_inventory`.
- [ ] Demo availability was seeded with `seed_demo_availability`.
- [ ] Demo availability uses the existing `InventoryAvailability` model only.
- [ ] No persistent reservation was created.

Pass/fail notes:

```text
Result:
Notes:
```

## Authentication And Session

- [ ] The operator logged in manually through `http://127.0.0.1:8000/api-auth/login/`.
- [ ] The frontend contains no login form or frontend authentication workflow.

Pass/fail notes:

```text
Result:
Notes:
```

## Inventory UI

- [ ] The inventory catalog loads.
- [ ] Only `material`, `article` and `material_pack` kinds appear.
- [ ] No venue, local, room, hall, service or event-service kind appears.

Pass/fail notes:

```text
Result:
Notes:
```

## Availability UI

- [ ] The Availability panel is visible.
- [ ] The helper note states that the check is read-only and does not create a reservation.
- [ ] A period overlapping the seeded next two-hour demo window excludes `Sonorisation standard`.
- [ ] The same overlapping period excludes `Projecteur LED`.
- [ ] `Pack sonorisation + eclairage` remains available.

Pass/fail notes:

```text
Result:
Notes:
```

## Negative Checks

- [ ] No Reserve, Book or Create reservation button exists.
- [ ] No frontend login workflow exists.
- [ ] No contract, invoice, payment, customer, pricing, stock, quantity or unit workflow exists.
- [ ] No venue, local, room, hall, service or event-service logic is presented.

Pass/fail notes:

```text
Result:
Notes:
```

## Manual Browser Demo Scenario

This scenario is manual verification, not automated end-to-end coverage.

1. Follow [mvp-local-demo-flow.md](mvp-local-demo-flow.md) to start services and prepare the local environment.
2. Run the existing `seed_dev_user`, `seed_demo_inventory` and `seed_demo_availability` commands without printing their environment values.
3. Log in manually through the backend `/api-auth/login/` page.
4. Start and open the frontend development server.
5. Confirm that the inventory catalog loads and contains only Titan-allowed kinds.
6. In the Availability panel, choose a period overlapping the next two-hour window created by `seed_demo_availability`.
7. Confirm that `Sonorisation standard` and `Projecteur LED` are excluded.
8. Confirm that `Pack sonorisation + eclairage` remains available.
9. Confirm all negative checks above.

Pass/fail notes:

```text
Result:
Notes:
```

## Smoke Validation

- [ ] The broader [MVP local smoke validation](mvp-local-smoke-validation.md) was completed when required.
- [ ] The smoke validation log contains no secret values.

Use the complete command block from the linked smoke validation runbook when this check is required.

Pass/fail notes:

```text
Result:
Notes:
```

## Shutdown

- [ ] Local services were stopped.
- [ ] Final Git status is clean or contains only expected changes.

Pass/fail notes:

```text
Result:
Notes:
```
