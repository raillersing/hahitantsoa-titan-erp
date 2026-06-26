# Analyse d’ecart frontend vs prototype client

> Version: F178B — 2026-06-25
> Etat frontend de reference: `main` SHA `8cde58a775a44cd92112b9537347ec32c885c47b`

## Legende

- `aligned`: base credible et connectee
- `partial`: connecte mais incomplet visuellement ou fonctionnellement
- `placeholder`: espace volontairement non operationnel
- `missing`: ecran ou flow non materialise
- `non confirme`: depend d’une decision business/API encore absente

## Matrice principale

| Zone prototype | Route/scope cible | Statut React | Fidelite | Notes |
|---|---|---|---|---|
| Dashboard | `#dashboard` | aligned | partially prototype-aligned | shell et quick cards merge |
| Login | auth | partial | partially prototype-aligned | fonctionnel, encore perfectible |
| Planning / calendar | `#planning` | current (weekly table) | partial | PlanningPanel hebdo déployé via D1 |
| Clients liste | `#customers` | partial | partially prototype-aligned | CRUD présent |
| Fiche client | `#customers` detail | partial | basic/rudimentary | enrichissement encore attendu |
| Appointments / prospects | futur HAH | missing | not implemented | décision workflow requise |
| Reservations Hahitantsoa | `#hahitantsoa` | partial-to-strong | partially prototype-aligned | connectivite forte |
| Reservations Titan | `#titan` | partial | basic/rudimentary | confirmation/detail encore absents |
| New reservation wizard | futur | missing | not implemented | vrai gap restant |
| Reservation detail | futur | missing | not implemented | vrai gap restant |
| Inventory | `#titan` | partial | basic/rudimentary | table/catalog encore faible |
| Excel import | futur | missing | not implemented | non confirme |
| Logistics | `#commercial-ops` | aligned | partially prototype-aligned | FE-B livre, encore polishable |
| Returns | `#commercial-ops` | aligned | partially prototype-aligned | validation connectee |
| Damage/loss | `#commercial-ops` | aligned | partially prototype-aligned | validation connectee |
| Catalog | `#catalog` | placeholder | not implemented | placeholder approuve |
| Venues/components | HAH only | non confirme | not implemented | jamais Titan |
| Documents/templates | `#commercial-ops` | aligned | partially prototype-aligned | HTML/PDF presents |
| Billing/payments | `#commercial-ops` | aligned | partially prototype-aligned | FE-C livre |
| Cashbox | `#cashbox` | aligned | partially prototype-aligned | FE-F livre |
| HR | `#hr` | placeholder | not implemented | hors priorite |
| Procurement | `#procurement` | placeholder | not implemented | hors contrat |
| Notifications | shell cue | partial | partially prototype-aligned | indices shell seulement |
| Reports | `#reports` | placeholder | not implemented | décision business/légale requise |
| Admin | `#identity` + futurs params | partial | basic/rudimentary | admin write encore incomplet |
| Audit/security | `#audit` | aligned | partially prototype-aligned | FE-E livre |
| Mobile/tablet | transverse | partial | partially prototype-aligned | FE-J livre une base solide |
| Help/onboarding | `#help` | placeholder | not implemented | placeholder approuve |
| Light/dark theme | global | aligned | partially prototype-aligned | fondation livree |

## Ce qui ne doit plus etre traite comme futur

- logistics
- returns
- damage/loss
- documents/PDF
- billing
- credit notes
- installments
- cashbox
- audit
- dashboard shell redesign
- light/dark foundation
- responsive/accessibility pass initial

## Vrais gaps restants

1. reservation detail dedie
2. new reservation wizard
3. confirmation Titan complete
4. planning/calendar reel
5. enrichissement client file
6. settings/admin completion
7. reports/exports apres decision metier/legal
8. QA de fidelite prototype plus large

## Conclusion operative

Le frontend live n’est plus dans une phase “FE-C à FE-J à faire”.
Le prochain travail frontend doit partir des gaps restants ci-dessus, pas de la
roadmap historique pre-merges.
