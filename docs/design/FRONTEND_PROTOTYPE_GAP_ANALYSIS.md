# Analyse d'ecart frontend vs prototype client

> Version: F177A - 2026-06-24
> Etat de reference frontend: `main` SHA `c45eaea0441052bc44a30282b0d97684bf823ce5`

## Legende

- `aligned`: direction proche du prototype et du backend
- `partial`: base existante mais shell/UX/workflow a refaire
- `missing`: pas d'ecran React correspondant
- `future`: backend et/ou decision pas encore transformes en UI
- `non confirme`: point non valide par cartographie ou business boundary

## Matrice principale

| Zone prototype | Route/scope cible | Statut React | Base actuelle | Backend/API | Design/components necessaires | Theme | Permission gating | Bundle recommande | Risque | Tests a prevoir |
|---|---|---|---|---|---|---|---|---|---|---|
| Dashboard | `#dashboard` | partial | `DashboardPanel.tsx` | oui | shell, KPI cards, quick actions, charts | high | lecture | FE-H | shell global absent | dashboard both themes |
| Login | auth | partial | `LoginPanel.tsx` | oui | branding, layout, logo rules | medium | n/a | FE-B0 | dark logo non confirme | auth screen both themes |
| Planning / calendar | futur `#planning` | missing | none | partial/read via reservations | calendar shell, filters, cards | high | role-filtered | FE-H ou FE-J | route non creee | responsive + empty/error |
| Clients liste | `#customers` | partial | `CustomerPanel.tsx` | oui | list shell, filters, detail split | high | oui | FE-G | current layout utilitaire | CRUD + denied + themes |
| Fiche client | `#customers` detail | partial | `CustomerPanel.tsx` detail | oui | detail cards, linked records | high | oui | FE-G | detail IA encore plate | detail + a11y |
| Appointments / prospects | futur Hahitantsoa | missing | none | non confirme | agenda visiteurs, prospect cards | medium | probable | FE-I | besoin decision workflow | gate by business |
| Reservations Hahitantsoa | `#hahitantsoa` | partial | `HahitantsoaEventDraftsPanel.tsx` | oui | list/detail shell, timeline, action bar | high | oui FE-A | FE-G | flux dense | preflight/confirm/theme |
| Reservations Titan | `#titan` | partial | `AvailabilityPanel.tsx` | oui | list/detail shell, action bar, badges | high | oui FE-A, gap confirm | FE-G | confirm Titan encore absent UI | write/denied/theme |
| New reservation wizard | futur wizard | missing | none | oui | stepper, recap, scope branching | high | oui | FE-G | scope split HAH/TIT | wizard + denied |
| Reservation detail | futur detail | missing | none | oui | summary cards, timeline, docs, payments | high | oui | FE-G | source split scopes | detail regression |
| Inventory | `#titan` | partial | inline `App.tsx` + stock panels | oui | inventory table/cards, toolbar | high | mixed | FE-B | current inline weak | list + theme |
| Excel import | futur import | missing | none | non confirme frontend path | import workflow cards | medium | yes | FE-I | may need business/contract | upload placeholder tests |
| Logistics | `#commercial-ops` logistics | partial | `LogisticsDeliveryPanel.tsx` read-only | oui | workflow board, event cards, stepper | high | required | FE-B | operator flows missing | logistics write gates |
| Returns | `#commercial-ops` returns | partial | `ReturnsHandlingPanel.tsx` | oui | inspection table/cards | high | yes | FE-B | current read/list only | permission + theme |
| Damage/loss | `#commercial-ops` breakage | partial | `BreakageLossPanel.tsx` | oui | settlement cards, status badges | high | yes | FE-B or FE-C | payment/billing links | status + denied |
| Catalog | futur catalog | future | none | partial | catalog cards, pack visuals | medium | role-filtered | FE-I | pack management future | placeholder only |
| Venues/components | Hahitantsoa only | non confirme | none | HAH scope only | cards/table if approved | medium | role-filtered | FE-I | forbidden in Titan | scope boundary tests |
| Documents/templates | `#commercial-ops` docs | partial | docs panels + preview | oui | split scope cards, preview shell, PDF state | high | yes | FE-D | PDF trigger absent | doc create/generate/theme |
| Billing/payments | `#commercial-ops` | partial | `BillingInvoicePanel.tsx`, `PaymentWorkflowPanel.tsx` | oui | documents commerciaux page, action bars, detail split | high | yes | FE-C | billing operator UI now covers settle/cancel/installments/credit notes; payment panel remains separate | write/read-only/theme |
| Cashbox | futur `#cashbox` | missing | none | oui | session cards, movement forms | high | yes | FE-F | route absente | session lifecycle |
| HR | future | missing | none | non confirme | placeholder only | low | role-filtered | FE-I | outside current ERP priority | decision gate |
| Procurement | future | missing | none | partial/future | PO table/cards | low | role-filtered | FE-I | backend path not mapped in current FE | decision gate |
| Notifications | global shell pattern | missing | none | partial | notification center, badges | medium | role-based | FE-H | could drift to new backend asks | shell + read-only |
| Reports | futur reports | missing | none | partial/non confirme | exports cards, gates | medium | role-filtered | FE-I | business confirmation needed | placeholder tests |
| Admin | `#identity` + params | partial | `IdentityPanel.tsx` | oui | admin shell, settings cards, users table | high | yes | FE-H | role mgmt write backend exists but FE partial | tabs + denied |
| Audit/security | futur `#audit` | missing | none | oui | audit table, filters, result badges | high | role-filtered | FE-E | security sensitivity | read-only + filters |
| Mobile/tablet | transverse | future | CSS basique | n/a | responsive shell, compact cards, drawers | high | n/a | FE-J | current shell not ready | viewport regression |
| Help/onboarding | future help center | missing | none | non critique | role journeys, docs links | low | role-aware | FE-I | source content not final | content and nav tests |
| Light/dark theme | global | missing | no true theme system | n/a | tokens, data-theme, logo rules | critical | n/a | FE-B0 | logo dark variants missing | theme matrix |

## Conflits prototype vs cartographie

| Sujet | Classification | Decision F177A |
|---|---|---|
| `venues` / locaux & composants visible dans le prototype | business decision needed | autoriser seulement cote Hahitantsoa; jamais Titan |
| `hr`, `procurement`, `reports`, `mobile`, `help` riches dans le prototype | prototype target improvement | garder comme reference visuelle, pas comme promesse backend |
| `cashbox` page complete dans le prototype alors que route absente | existing implementation gap | planifier FE-F |
| `calendar` page riche vs route absente actuelle | existing implementation gap | traiter en redesign shell/planning futur |
| dashboard prototype avec chartes visuelles riches vs dashboard live minimal | existing implementation gap | traiter en FE-H |
| prototype suggere plus de navigation que la hash-nav actuelle | prototype target improvement | evoluer sans inventer de backend |

## Conclusion operative

- Le prototype est exploitable comme reference visuelle et navigationnelle.
- Le frontend live fournit surtout les contrats API et les patterns de gating FE-A.
- La priorite technique doit etre un FE-B0 de shell + theming avant de pousser les
  ecrans operationnels riches.
