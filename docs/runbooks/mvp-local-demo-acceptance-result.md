# MVP Local Demo Acceptance Result

## Scope

This document records the available acceptance evidence for the local/dev MVP demo.

It is not a production-readiness assessment and is not automated end-to-end coverage. Human browser confirmation was provided for the documented local demo scenario.

## Version Under Review

- Branch: `main`
- Merge commit: `2642726`
- Latest merged PR: `#64` - F67 MVP local demo acceptance result

## Log-Backed Evidence

The existing F66 post-merge validation supports the following evidence:

- F66 post-merge validation passed.
- Ruff format and lint checks passed.
- The frontend build passed.
- The frontend test suite passed.
- The backend/API change guard found no backend or API changes in F66.
- Forbidden reservations file checks passed.
- The working tree was clean on `main` after merge.

The browser observations below were provided separately by the human operator.

## Acceptance Status

| Check | Evidence source | Status | Notes |
| --- | --- | --- | --- |
| F66 post-merge validation | F66 post-merge validation log | PASS | Validation completed successfully. |
| Ruff format and lint | F66 post-merge validation log | PASS | Both checks passed. |
| Frontend build | F66 post-merge validation log | PASS | Build completed successfully. |
| Frontend tests | F66 post-merge validation log | PASS | Frontend tests passed. |
| No backend/API change in F66 | F66 post-merge validation change guard | PASS | No backend/API changes were reported. |
| No forbidden reservations model, migration or admin files | F66 post-merge validation file guards | PASS | Guard checks returned no forbidden files. |
| Clean `main` working tree after merge | F66 post-merge validation Git status | PASS | Working tree was clean. |
| Manual browser demo scenario | Human operator observation | PASS | All documented browser acceptance observations passed. |

## Manual Browser Observations

Record only non-sensitive observations. Do not include credentials, usernames, passwords, tokens or secret values.

| Observation | Status | Notes |
| --- | --- | --- |
| Login through `/api-auth/login/` succeeded | PASS | The authenticated session was confirmed by an HTTP 200 response from `/api/v1/inventory/items/`. |
| Inventory catalog is visible | PASS | The inventory catalog was visible in the frontend. |
| Only `material`, `article` and `material_pack` kinds are visible | PASS | Visible kinds were `material_pack`, `article` and `material`. |
| Availability panel is visible | PASS | The read-only availability panel was visible. |
| A period overlapping the seeded demo window was tested | PASS | The local checked period `2026-06-06 16:04` to `2026-06-06 18:04` overlapped the seeded UTC window `2026-06-06T13:00:00+00:00` to `2026-06-06T15:00:00+00:00`. |
| `Sonorisation standard` is excluded | PASS | The item was excluded for the overlapping period. |
| `Projecteur LED` is excluded | PASS | The item was excluded for the overlapping period. |
| `Pack sonorisation + eclairage` remains available | PASS | The pack remained available for the overlapping period. |
| No frontend login form is visible | PASS | Authentication remained a manual backend session flow. |
| No Reserve, Book or Create reservation control is visible | PASS | No reservation creation control was visible. |
| No commercial workflow is visible | PASS | No contract, invoice, payment, customer, pricing, stock, quantity or unit workflow was visible. |

The earlier `/accounts/profile/` HTTP 404 after login was the default post-login redirect target without a configured route. It was not an acceptance failure because the authenticated session was subsequently confirmed through DRF and frontend access.

## Limitations

- No persistent reservation exists.
- No write API exists.
- No commercial workflow exists.
- This result does not claim production readiness.
- No automated end-to-end coverage exists.

## Next MVP Step Decision

The following candidates were evaluated without implementing any of them:

| Candidate | Assessment |
| --- | --- |
| UX polish for demo readability | Useful only if manual browser acceptance identifies specific blocking friction. Speculative polish should be avoided. |
| Dedicated demo page | Could improve presentation, but currently risks duplicating the existing inventory and availability interface. |
| Next authenticated read-only MVP surface | Extends the MVP while preserving the current read-only architecture and controlled scope. |
| Future write workflow preparation | Premature before explicit decisions for persistence, transactions and business invariants. |

Recommended next step: F68 should prepare a focused authenticated read-only item availability detail surface.

F68 should first define the smallest useful contract and UI scope for inspecting one Titan inventory item's availability periods. It must remain read-only and must not implement persistent reservations, writes, stock, quantities, units, pricing, contracts, invoices, payments, customers or commercial workflows.

The manual browser acceptance did not identify blocking UX friction. The future recommendation remains to prepare a focused authenticated read-only item availability detail surface, defining its smallest useful contract and UI scope before implementation.

F68 records the acceptance result only. The recommended next feature is not implemented.

## Final Result

`PASS`

```text
Operator:
Date:
Final result: PASS
Notes: Human browser acceptance observations passed. This remains a local/dev MVP result, not production readiness.
```
