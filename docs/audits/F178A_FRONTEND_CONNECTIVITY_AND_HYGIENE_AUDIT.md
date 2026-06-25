# F178A - Audit post-frontend connectivite, cartographie, et hygiene

> Date: 2026-06-25
> Repo: `/home/raillersing/projects/hahitantsoa-titan-erp`
> Base live auditee: `main` @ `b5b772e2f16887a859b1344c22b350ae7e41e591`
> CI `main` de reference: run `28182258967` `success`

## 1. Resume executif

L'etat reel du projet a depasse le contexte fourni au demarrage de cette tache.
Le frontend n'est plus a l'etat "FE-B0 + FE-B seulement": les bundles `FE-C`
jusqu'a `FE-J` sont deja merges sur `main` via les PR `#415` a `#422`.

Constats principaux:

- le backend gele reste globalement bien raccorde au frontend sur les domaines
  operatoires deja traites;
- plusieurs docs F176A/F177A sont maintenant partiellement obsoletes, car elles
  decrivent encore `billing`, `logistics`, `audit`, `cashbox`, `dashboard`,
  `responsive`, `reports placeholders` et `theme shell` comme incomplets ou
  futurs alors qu'ils sont effectivement implementes;
- la cartographie de haut niveau reste utile, mais certaines sections
  detaillees doivent etre corrigees avant de servir de base a un nouveau bundle;
- l'UI reste en partie rudimentaire par rapport au prototype sur les zones
  `planning`, `reports`, `catalog`, `procurement`, `hr`, `help`, `appointments`,
  `new reservation wizard`, et `reservation detail`;
- des residues locaux existent encore, surtout dans Docker images/volumes et
  quelques anciens dossiers de taches hors worktree Git.

Verdict global:

- backend: stable et connecte sur les flux geles confirmes;
- frontend: largement implemente, mais encore incomplet en fidelite prototype et
  en profondeur fonctionnelle sur certains ecrans;
- documentation: partiellement stale apres les merges frontend `#415` a `#422`;
- hygiene locale: propre cote git tracked/untracked, mais residues Docker et
  dossiers locaux anciens encore presents.

## 2. Etat projet courant

### 2.1 Checkpoint live

- repo path: `/home/raillersing/projects/hahitantsoa-titan-erp`
- branche repo principal: `main`
- `origin/main`: `b5b772e2f16887a859b1344c22b350ae7e41e591`
- `HEAD` local principal: `b5b772e2f16887a859b1344c22b350ae7e41e591`
- `git status --short`: propre
- worktrees actifs au moment de l'audit:
  - `/home/raillersing/projects/hahitantsoa-titan-erp` -> `main`
  - `/home/raillersing/projects/hahitantsoa-titan-erp-f178a-frontend-connectivity-hygiene-audit` -> `docs/f178a-frontend-connectivity-hygiene-audit`
- open PRs: aucun
- dernier CI `main` vert:
  - run `28182258967`
  - SHA `b5b772e2f16887a859b1344c22b350ae7e41e591`

### 2.2 Derniers merges observes sur `main`

- `#422` FE-J responsive/accessibility polish -> merge `b5b772e`
- `#421` FE-I reports/exports placeholders -> merge `536b0c6`
- `#420` FE-H dashboard/navigation shell -> merge `f5a7102`
- `#419` FE-G client file/reservation detail -> merge `16910d3`
- `#418` FE-F cashbox session management -> merge `3eec651`
- `#417` FE-E audit log viewer/security UX -> merge `98ba645`
- `#416` FE-D document workflow UI -> merge `c67fb0b`
- `#415` FE-C billing/cashbox/credit note operator UI -> merge `95116fb`

## 3. Etat FE-C

FE-C n'est pas en cours localement.

Classification:

- branche locale FE-C: absente
- branche distante FE-C: absente
- worktree FE-C: absent
- PR FE-C: `#415`, etat `MERGED`
- head FE-C de la PR: `db959d0117b31fd7b4fa9a0c41dde0a688188d51`
- merge commit FE-C: `95116fba9933ea7437e6a22d413a1cc31389359d`

Verdict FE-C:

- statut: `PR merged`
- aucune trace de travail FE-C non committe ou a preserver n'a ete trouvee
  localement.

## 4. Connectivite backend/frontend

Statuts utilises:

- `Connected`
- `Partially connected`
- `Backend-only`
- `Frontend-only placeholder`
- `Missing frontend`
- `Missing API client`
- `Non confirme`

| Domaine | Backend apps / endpoints cles | Client frontend / ecran | Couverture tests | Statut | Notes et risques |
|---|---|---|---|---|---|
| Authentification / session / identite de session | `identity`, login Django session, `/api-auth/login/`, `checkAuth`, `logout` | `AuthContext`, `LoginPanel`, `App` | tests frontend auth + backend auth existants | Connected | route hash shell protegee, login live present |
| Users / roles / permissions | `identity/roles`, `identity/assignments`, permissions endpoint probes | `IdentityPanel`, `checkIdentityWritePermission` | tests frontend + backend identity | Partially connected | lecture connectee; gestion write role/assignment reste partielle cote UI |
| Dashboard | agregations derivees de `inventory`, `reservations`, `payments`, `hahitantsoa` | `DashboardPanel` | tests frontend dashboard | Connected | visuel plus riche qu'avant, mais sans analytics profonds |
| Customers / contacts | `customers/` CRUD | `CustomerPanel`, `api.ts` customer CRUD | tests backend customers + `CustomerPanel.test.tsx` | Connected | ecran exploitable, fidelite prototype encore moyenne |
| Reservations / drafts Titan | `reservations/drafts/`, availability endpoints | `AvailabilityPanel` | tests frontend tres couverts | Partially connected | CRUD et disponibilite OK; confirmation Titan et some lifecycle actions encore absents du FE |
| Availability / planning | selectors availability + preview endpoints | `AvailabilityPanel`, `#planning` placeholder | tests dispo oui, planning non | Partially connected | backend present; planification calendrier prototype non migree |
| Confirmation workflow Titan | endpoints backend reserves/drafts confirm-related | pas d'ecran confirme cote Titan | backend only tests | Backend-only | gap fonctionnel frontend confirme |
| Hahitantsoa flow | `hahitantsoa/event-drafts`, confirmation, amendment | `HahitantsoaEventDraftsPanel`, discovery | tests backend + frontend | Connected | flux le plus complet cote frontend hors shell |
| Titan rental flow | reservations + inventory + documents | `#titan`, docs Titan, stock movement | tests backend + frontend | Connected | manque surtout le detail/wizard/fidelite prototype |
| Catalog / articles / packs | inventory item list live; packs backend limites | inventaire inline `#titan`, `#catalog` placeholder | tests inventory existants | Partially connected | liste items disponible; ecran catalog dedie absent |
| Inventory / stock movements | `/inventory/items/`, `/inventory/stock-movements/` | `App` inline inventory, `TitanStockMovementPanel`, `StockMovementLedgerPanel` | backend + frontend tests | Connected | bonne connectivite; presentation encore utilitaire |
| Logistics / passation / delivery | `/logistics/events/`, transitions, lines add/remove, `complete-passation` | `LogisticsDeliveryPanel` | backend logistics + frontend panel | Connected | docs F176A disent encore read-only; faux en l'etat reel |
| Returns | `/inventory/return-operations/`, `/validate/` | `ReturnsHandlingPanel` | backend inventory + frontend panel | Connected | write gating present; doc stale |
| Damage / loss | `/inventory/damage-loss-settlements/`, `/validate/` | `BreakageLossPanel` | backend inventory + frontend panel | Connected | write validation connectee; doc stale |
| Documents / templates / PDF | documents templates, instances, generate HTML/PDF, private artifact/PDF | `TitanDocumentsPanel`, `HahitantsoaDocumentsPanel`, `DocumentArtifactPreviewPanel`, `DocumentPdfPreviewPanel` | backend docs + frontend docs panels | Connected | PDF trigger et preview presents; administration templates pas exposee |
| Billing / invoices / installments / credit notes | `/billing/invoices/`, settle, cancel, installments, credit-notes, refund obligations | `BillingInvoicePanel`, `api.ts` billing funcs | backend billing + frontend billing tests | Connected | docs F176A/F177A encore trop pessimistes; quelques actions restent plus operateur que prototype-finales |
| Payments / deposits / refunds | `/payments/`, confirm, refund | `PaymentWorkflowPanel`, `CautionRefundPanel` | backend payments + frontend tests | Connected | remboursements limites aux contrats existants; reconciliation/cancel non exposees |
| Cashbox / caisse | `/cashbox/sessions/`, `open`, `close`, `movements` | `CashboxPanel`, `api.ts` cashbox funcs | backend cashbox + frontend tests | Connected | route et lifecycle presents; export/print non exposes |
| Closeout summary | backend closeout already built | pas d'ecran dedie complet | backend tests | Backend-only | reste un manque frontend si closeout unifie est attendu visuellement |
| Audit log | `/audit/events/` list/detail | `AuditPanel` | backend audit + frontend audit tests | Connected | lecture filtree OK; drill-down securite plus pousse reste futur |
| Reports / exports | certains endpoints/metriques partiels seulement | `#reports` placeholder | peu ou pas de tests fonctionnels | Frontend-only placeholder | volontairement gate par absence de decision business/export |
| Settings / business rules | backend config/rules mais pas d'UI admin complete | `#identity` partiel, autres placeholders | backend tests surtout | Partially connected | pas de surface admin complete pour numerotation/templates/thresholds |
| Metrics / health / readiness | endpoints backend readiness existants d'apres F175A/F176A | pas de route React dediee | backend/infrastructure | Backend-only | pas un gap produit prioritaire pour l'operateur frontend |

## 5. Alignement frontend / prototype

Statuts d'implementation:

- `aligned`
- `partial`
- `rudimentary`
- `missing`
- `future`
- `blocked`
- `non confirme`

Statuts de fidelite visuelle:

- `prototype-aligned`
- `partially prototype-aligned`
- `basic/rudimentary`
- `not implemented`

| Zone | Route cible | Etat actuel React | Section prototype | API backend | Fidelite visuelle | Travail restant | Bundle ou suite recommandee |
|---|---|---|---|---|---|---|---|
| Login | auth | partial | `page-login` | oui | partially prototype-aligned | meilleur branding et polish seulement | correctif UI futur, pas bloquant |
| Shell / sidebar / topbar | hash shell global | aligned | sidebar/topbar shell | n/a | partially prototype-aligned | encore plus de finition possible, mais fondation en place | polish mineur seulement |
| Dashboard | `#dashboard` | aligned | `page-dashboard` | oui | partially prototype-aligned | enrichissements KPI/alerts optionnels | correctif visuel si besoin |
| Planning / calendar | `#planning` | future placeholder | `page-calendar` | partiel | not implemented | vrai calendrier, filtres, scheduler si contrats confirmes | nouveau bundle frontend cible |
| Customers list | `#customers` | partial | `page-clients` | oui | partially prototype-aligned | plus de split-view et historique lie | correctif FE-G2 eventuel |
| Client file | `#customers` detail | partial | `page-client-file` | oui | basic/rudimentary | fiches reliees billing/docs/logistics plus riches | FE-G2 |
| Reservations list Titan | `#titan` | partial | `page-reservations-titan` | oui | basic/rudimentary | detail, action bar, confirm lifecycle | nouveau bundle reservations Titan |
| Reservation detail | none dedicated | missing | `page-reservation-detail` | oui | not implemented | ecran detail dedie | nouveau bundle reservations |
| New reservation wizard | none dedicated | missing | `page-reservation-new` | oui | not implemented | stepper complet scope HAH/TIT | nouveau bundle reservations |
| Hahitantsoa flow | `#hahitantsoa` | partial-to-strong | `page-reservations-hah` | oui | partially prototype-aligned | shell detail/timeline plus forte | FE-G2 ou polish |
| Titan flow | `#titan` | partial | `page-reservations-titan` | oui | basic/rudimentary | confirm/cancel/contract/deposit UI | bundle reservations Titan |
| Inventory | `#titan` | partial | `page-inventory` | oui | basic/rudimentary | table/catalog shell dedie | bundle catalog/inventory |
| Inventory import | none | missing | `page-inventory-import` | non confirme | not implemented | decision workflow et contrat upload | business + API decision |
| Logistics | `#commercial-ops` | aligned fonctionnellement | `page-logistics` | oui | partially prototype-aligned | plus de polish board/timeline | correctif UI possible |
| Returns | `#commercial-ops` | aligned fonctionnellement | `page-returns` | oui | partially prototype-aligned | polish seulement | correctif UI possible |
| Damage/loss | `#commercial-ops` | aligned fonctionnellement | `page-damage` | oui | partially prototype-aligned | meilleur couplage billing/refund | correctif UI futur |
| Documents / PDF | `#commercial-ops` | aligned fonctionnellement | `page-documents` | oui | partially prototype-aligned | quelques etats et shell preview plus riches | correctif UI futur |
| Billing / invoices | `#commercial-ops` | aligned fonctionnellement | `page-billing` | oui | partially prototype-aligned | split-view et densite prototype encore inegales | correctif UI finance |
| Installments | `#commercial-ops` | partial | `page-billing` | oui | basic/rudimentary | meilleure presentation timeline/echeancier | correctif finance |
| Credit notes | `#commercial-ops` | partial | `page-billing` | oui | basic/rudimentary | meilleur detail/flow UX | correctif finance |
| Payments / refunds | `#commercial-ops`, `#caution-refund` | aligned | `page-billing`, finance cues | oui | partially prototype-aligned | consolidations UX | correctif finance |
| Cashbox | `#cashbox` | aligned | `page-cashbox` | oui | partially prototype-aligned | export/print et totaux plus riches | futur si decision metier |
| Audit / security | `#audit` | aligned read-only | `page-audit` | oui | partially prototype-aligned | drill-down supplementaire possible | futur mineur |
| Reports / exports | `#reports` | future placeholder | `page-reports` | partiel/non confirme | not implemented | clarifier formats/legaux/backend | decision business |
| Settings / admin | `#identity`, placeholders | partial | `page-admin` | partiel | basic/rudimentary | vraies actions admin et settings confirmes | nouveau bundle admin si autorise |
| Mobile / tablet | transverse | partial | `page-mobile` | n/a | partially prototype-aligned | encore des regressions visuelles possibles mais base OK | tests/responsive pass secondaire |
| Dark mode | transverse | aligned foundation | dark cues shell | n/a | partially prototype-aligned | spot checks supplementaires utiles | QA visuelle |
| Brand / logos | shell global | aligned base | brand hierarchy cues | n/a | partially prototype-aligned | verifier lisibilite sombres sur tout ecran | QA visuelle |

## 6. Exactitude de la cartographie et des docs

### 6.1 Evaluation par fichier

| Fichier | Etat | Observation |
|---|---|---|
| `docs/architecture/application-map/README.md` | partially stale | SHA du gel backend ancien mais encore coherent historiquement; manque l'etat frontend reel post `#415`-`#422` |
| `docs/architecture/application-map/APPLICATION_FUNCTION_CATALOG.md` | partially stale | certaines references de bundles frontend sont depassees |
| `docs/architecture/application-map/BACKEND_MAP.md` | accurate | rien de faux evident releve dans ce scope |
| `docs/architecture/application-map/FRONTEND_MAP.md` | stale | decrit encore logistics/billing/audit/cashbox de facon trop incomplete |
| `docs/architecture/application-map/API_AND_DATA_FLOW_MAP.md` | partially stale | plusieurs notes "frontend absent" ou "not yet called" ne sont plus vraies |
| `docs/architecture/application-map/NAVIGATION_TREE_TARGET.md` | stale | gaps frontend prioritaires FE-B..FE-F deja livres mais encore presentes comme futures |
| `docs/architecture/application-map/AGENT_USAGE_GUIDE.md` | partially stale | dit encore "frontend catch-up FE-A, FE-B, FE-C" seulement |
| `docs/architecture/application-map/DIAGRAMS.md` | partially stale | roles/graphes historiques utiles mais pas forcement refreshes pour l'etat final frontend |
| `docs/design/CLIENT_APPROVED_UI_REFERENCE.md` | accurate | le double chemin prototype attendu/reel est documente proprement |
| `docs/design/UI_MIGRATION_CONTRACT.md` | partially stale | route/status mapping encore pre-FE-F/FE-J sur plusieurs zones |
| `docs/design/THEME_AND_DARK_MODE_CONTRACT.md` | accurate | contrat toujours valable; implementation partielle maintenant existante |
| `docs/design/FRONTEND_PROTOTYPE_GAP_ANALYSIS.md` | stale | base `main` ancienne (`c45e...`) et nombreux statuts encore faux |
| `docs/design/FRONTEND_MIGRATION_ROADMAP_FROM_PROTOTYPE.md` | partially stale | roadmap toujours utile mais plusieurs bundles sont deja termines |
| `docs/design/brand/BRAND_ARCHITECTURE.md` | accurate | rien de contradictoire releve |
| `docs/design/DESIGN.md` | accurate | toujours canonique et compatible |
| `docs/ai-agents/orchestrator-task-queue.md` | stale | HEAD `main` et bundles actifs affiches sont depasses |
| `docs/ai-agents/prompt-contracts/frontend-orchestrator.md` | accurate | references utiles, pas de contradiction technique critique |
| `docs/ai-agents/tooling/frontend-specialist-skills.md` | accurate | role mapping historique encore valable |

### 6.2 Corrections immediatement necessaires

Priorite haute:

- `docs/architecture/application-map/FRONTEND_MAP.md`
- `docs/architecture/application-map/NAVIGATION_TREE_TARGET.md`
- `docs/design/FRONTEND_PROTOTYPE_GAP_ANALYSIS.md`
- `docs/ai-agents/orchestrator-task-queue.md`

Priorite moyenne:

- `docs/architecture/application-map/API_AND_DATA_FLOW_MAP.md`
- `docs/design/FRONTEND_MIGRATION_ROADMAP_FROM_PROTOTYPE.md`
- `docs/architecture/application-map/AGENT_USAGE_GUIDE.md`

Note de scope:

- dans cette tache, le diff est volontairement limite au rapport d'audit et a un
  rafraichissement minimal de la task queue; les autres updates sont recommandees
  explicitement mais non reecrites ici pour eviter un mega-diff documentaire et
  rester compatibles avec le scope docs garde.

## 7. Taches frontend restantes

Le frontend n'est pas "non commence". Il est plutot dans un etat "largement
livre mais encore non fini visuellement/fonctionnellement par rapport au
prototype".

Travail restant prioritaire:

1. reservation detail dedie Titan/Hahitantsoa
2. new reservation wizard
3. confirmation Titan complete en UI
4. vrai planning/calendar
5. enrichissement client file avec documents/billing/logistics/payments lies
6. raffinement prototype des pages finance/logistics/documents deja connectees
7. settings/admin reels si contrats backend approuves
8. reports/exports apres decision business et legale
9. QA visuelle light/dark/logo sur toutes les surfaces

## 8. Inventaire des residues

### 8.1 Git / worktrees / branches

| Item | Etat | Classification |
|---|---|---|
| untracked files dans repo principal | aucun | already cleaned |
| worktrees Git actifs non attendus | seulement `main` + le worktree F178A | keep |
| branche locale FE-C | absente | already cleaned |
| branche distante FE-C | absente | already cleaned |
| branches distantes anciennes `origin/feat/f172...`, `origin/feat/f173...`, `origin/feat/f174...`, `origin/feat/fe-b0-visual-fidelity-polish` | encore presentes | safe to delete later |
| dossier `/home/raillersing/projects/hahitantsoa-titan-erp-fe-d-document-workflow-ui` | existe, 4K, sans `.git`, non enregistre worktree | needs human review |
| dossiers `/home/raillersing/projects/hahitantsoa-titan-erp-f172`, `-f173`, `-f174` | existent, sans `.git`, hors worktree Git | needs human review |

### 8.2 Docker

| Item | Etat | Classification |
|---|---|---|
| projet compose ERP actif `hahitantsoa_titan_erp-*` | backend/db/redis sains | keep |
| `taf-local-forms-*` | actif, hors scope ERP direct | do not touch |
| `ai-social-content-factory-n8n` | container `Exited (137)` | do not touch |
| images Docker de nombreuses anciennes taches ERP (`f153` a `f174`, etc.) | presentes localement | safe to delete later |
| volumes Docker ERP de nombreuses anciennes taches | tres nombreux | do not touch |

### 8.3 Docs / design / architecture

| Item | Etat | Classification |
|---|---|---|
| prototype client approuve unique `ERP Hahitantsoa - Prototype 4.html` | present, pas de doublon detecte | keep |
| logos `ergon`, `hahitantsoa`, `titan-rental` uniques | presents | keep |
| references a l'ancien SHA `c45e...` | encore presentes dans task queue et gap analysis | update reference |
| docs disant encore FE-C/FE-D/FE-E/FE-F "futurs" | encore presentes | update reference |
| references OpenClaw historiques | encore presentes dans audits et docs historiques | keep |

## 9. Recommandations de nettoyage

### Safe now

- supprimer plus tard les branches distantes anciennes deja mergees ou depassees:
  - `origin/feat/f172-billing-credit-note-cancel`
  - `origin/feat/f173-backend-e2e-operational-acceptance`
  - `origin/feat/f174-billing-credit-note-list-get`
  - `origin/feat/fe-b0-visual-fidelity-polish`
- supprimer plus tard les images Docker anciennes des taches ERP, de facon
  ciblee uniquement

### Later with human review

- verifier puis supprimer les dossiers hors Git:
  - `/home/raillersing/projects/hahitantsoa-titan-erp-fe-d-document-workflow-ui`
  - `/home/raillersing/projects/hahitantsoa-titan-erp-f172`
  - `/home/raillersing/projects/hahitantsoa-titan-erp-f173`
  - `/home/raillersing/projects/hahitantsoa-titan-erp-f174`

### Never touch in this audit

- `.env`, secrets, credentials
- containers/volumes `taf-local-forms`
- container `n8n`
- volumes Docker ERP existants
- prototype client et logos

## 10. Action orchestrateur recommandee

Action recommandee:

- `update cartography first`

Raison:

- FE-C n'est pas a reprendre; il est deja merge.
- le vrai risque immediat est de redemarrer un nouveau bundle frontend sur une
  cartographie stale qui sous-estime l'etat reel des ecrans deja livres.
- avant tout nouveau correctif ou bundle visuel, il faut rafraichir
  `FRONTEND_MAP.md`, `NAVIGATION_TREE_TARGET.md`, `API_AND_DATA_FLOW_MAP.md` et
  `FRONTEND_PROTOTYPE_GAP_ANALYSIS.md` sur la base de `main` actuel.

Action produit ensuite recommandee:

- lancer un bundle frontend de rattrapage visuel/fonctionnel cible sur:
  - reservation detail
  - reservation wizard
  - planning/calendar
  - confirmation Titan

## 11. Estimation de completion

- backend: `95%+` sur le scope gele, avec reliquats surtout documentaires ou
  decisions externes
- frontend: `80%` environ sur la cible operateur utile, mais moins sur la
  fidelite prototype complete
- application globale: `85%` environ, avec le principal reste a faire cote
  frontend UX/prototype et quelques decisions business/export

## 12. Hard stops et blockers

Blockers actuels non techniques critiques:

- cartographie stale sur plusieurs fichiers structurants
- absence de decision business validee pour `reports/exports`
- absence de contrat approuve pour `planning/calendar` riche
- reservation detail et wizard non encore materialises cote frontend
- surfaces admin/settings encore partielles

Hard stop recommande pour le prochain bundle:

- ne pas lancer de nouveau bundle frontend majeur avant refresh des docs de
  cartographie/design impactees par les merges `#415` a `#422`.
