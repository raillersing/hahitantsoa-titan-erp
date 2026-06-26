# FRONTEND_MAP.md — Cartographie du frontend

> **Version:** F178B — 2026-06-25
> **Etat frontend de reference:** `main` SHA `8cde58a775a44cd92112b9537347ec32c885c47b`
> **Stack:** React 19.2.1, TypeScript 5.9.3 strict, Vite 7.2.7, Vitest 4.0.16
> **Router:** hash-based scope switching (`window.location.hash`)
> **Theme:** light / dark / system foundation livree via `ThemeContext.tsx` et `data-theme`

---

## 1. References obligatoires avant toute tache frontend

Avant tout nouveau bundle frontend, consulter au minimum:

- `docs/audits/F178A_FRONTEND_CONNECTIVITY_AND_HYGIENE_AUDIT.md`
- ce fichier `FRONTEND_MAP.md`
- `docs/architecture/application-map/API_AND_DATA_FLOW_MAP.md`
- `docs/architecture/application-map/NAVIGATION_TREE_TARGET.md`
- `docs/design/CLIENT_APPROVED_UI_REFERENCE.md`
- `docs/design/UI_MIGRATION_CONTRACT.md`
- `docs/design/THEME_AND_DARK_MODE_CONTRACT.md`
- `docs/design/FRONTEND_PROTOTYPE_GAP_ANALYSIS.md`
- `docs/design/FRONTEND_MIGRATION_ROADMAP_FROM_PROTOTYPE.md`

F178A et F178B sont les references prioritaires pour distinguer:

- ce qui est deja merge sur `main`
- ce qui reste reellement a faire
- ce qui est volontairement placeholder ou bloque par decision business/API

---

## 2. Architecture globale

```text
main.tsx
└── <StrictMode>
    └── ErrorBoundary.tsx
        └── AuthContext.tsx
            └── ThemeContext.tsx
                └── App.tsx
                    ├── LoginPanel.tsx
                    └── Shell hash-based
                        ├── #dashboard         → DashboardPanel.tsx
                        ├── #planning          → FutureWorkspacePanel.tsx
                        ├── #titan             → inventory inline + AvailabilityPanel.tsx + TitanStockMovementPanel.tsx + DocumentArtifactPreviewPanel.tsx
                        ├── #hahitantsoa       → HahitantsoaDiscoveryPanel.tsx + HahitantsoaEventDraftsPanel.tsx
                        ├── #customers         → CustomerPanel.tsx
                        ├── #commercial-ops    → HahitantsoaCommercialOpsPanel.tsx
                        │                        ├── TitanDocumentsPanel.tsx
                        │                        ├── HahitantsoaDocumentsPanel.tsx
                        │                        ├── PaymentWorkflowPanel.tsx
                        │                        ├── BillingInvoicePanel.tsx
                        │                        ├── LogisticsDeliveryPanel.tsx
                        │                        ├── ReturnsHandlingPanel.tsx
                        │                        ├── BreakageLossPanel.tsx
                        │                        └── StockMovementLedgerPanel.tsx
                        ├── #identity          → IdentityPanel.tsx
                        ├── #audit             → AuditPanel.tsx
                        ├── #cashbox           → CashboxPanel.tsx
                        ├── #caution-refund    → CautionRefundPanel.tsx
                        ├── #reports           → FutureWorkspacePanel.tsx
                        ├── #catalog           → FutureWorkspacePanel.tsx
                        ├── #procurement       → FutureWorkspacePanel.tsx
                        ├── #hr                → FutureWorkspacePanel.tsx
                        └── #help              → FutureWorkspacePanel.tsx
```

Etat global:

- le shell prototype-derived FE-B0 / FE-B0R / FE-H / FE-J est merge
- les bundles FE-C a FE-J sont deja livres
- les placeholders restants sont volontaires et ne doivent plus etre lus comme
  “travail oublie” sans verifications F178A/F178B

---

## 3. Hash scopes actuels

| Scope | Route hash | Composant | Statut |
|---|---|---|---|
| Dashboard | `#dashboard` | `DashboardPanel.tsx` | current |
| Planning | `#planning` | `PlanningPanel.tsx` | current |
| Titan | `#titan` | inventaire inline + `AvailabilityPanel.tsx` + `TitanStockMovementPanel.tsx` + `DocumentArtifactPreviewPanel.tsx` | current |
| Hahitantsoa | `#hahitantsoa` | `HahitantsoaDiscoveryPanel.tsx` + `HahitantsoaEventDraftsPanel.tsx` | current |
| Customers | `#customers` | `CustomerPanel.tsx` | current |
| Commercial Ops | `#commercial-ops` | `HahitantsoaCommercialOpsPanel.tsx` | current |
| Identity | `#identity` | `IdentityPanel.tsx` | partial |
| Audit | `#audit` | `AuditPanel.tsx` | current |
| Cashbox | `#cashbox` | `CashboxPanel.tsx` | current |
| Caution / Refund | `#caution-refund` | `CautionRefundPanel.tsx` | current |
| Reports | `#reports` | `FutureWorkspacePanel.tsx` | placeholder |
| Catalog | `#catalog` | `FutureWorkspacePanel.tsx` | placeholder |
| Procurement | `#procurement` | `FutureWorkspacePanel.tsx` | placeholder |
| HR | `#hr` | `FutureWorkspacePanel.tsx` | placeholder |
| Help | `#help` | `FutureWorkspacePanel.tsx` | placeholder |

---

## 4. Composants frontend par domaine

### 4.1 Entry / auth / shell

| Fichier | Rôle | Statut |
|---|---|---|
| `main.tsx` | bootstrap React | current |
| `AuthContext.tsx` | session auth login/logout/checkAuth | current |
| `ThemeContext.tsx` | light / dark / system + persistance locale | current |
| `ErrorBoundary.tsx` | fallback d’erreur | current |
| `App.tsx` | shell global, sidebar, topbar, navigation hash, branding scopes | current |
| `LoginPanel.tsx` | écran de connexion | partial visuel |

### 4.2 Dashboard / shell polish

| Fichier | Rôle | APIs | Statut |
|---|---|---|---|
| `DashboardPanel.tsx` | cartes résumé, quick links | `getInventoryItems`, `getReservationDrafts`, `getPayments`, `getHahitantsoaEventDrafts` | current |

### 4.3 Titan

| Fichier | Rôle | APIs | Permission gating | Statut |
|---|---|---|---|---|
| `AvailabilityPanel.tsx` | CRUD brouillons Titan + disponibilité | reservations + customers + availability | oui | partial |
| `TitanStockMovementPanel.tsx` | mouvements de stock Titan | stock movements | oui | current |
| `DocumentArtifactPreviewPanel.tsx` | preview HTML privé | documents artifact | lecture | current |
| `DocumentPdfPreviewPanel.tsx` | preview PDF privé | documents pdf | lecture | current |

### 4.4 Hahitantsoa

| Fichier | Rôle | APIs | Permission gating | Statut |
|---|---|---|---|---|
| `HahitantsoaDiscoveryPanel.tsx` | découverte read-only | discovery items | n/a | current |
| `HahitantsoaEventDraftsPanel.tsx` | CRUD, disponibilité, confirm, avenants | hahitantsoa drafts + amendment APIs | oui | current |

### 4.5 Customers

| Fichier | Rôle | APIs | Permission gating | Statut |
|---|---|---|---|---|
| `CustomerPanel.tsx` | liste, détail, create, update, delete, recherche | customers CRUD | oui | partial-to-strong |

### 4.6 Commercial Ops

| Fichier | Rôle | APIs | Permission gating | Statut |
|---|---|---|---|---|
| `HahitantsoaCommercialOpsPanel.tsx` | shell d’onglets ops | none direct | n/a | current |
| `TitanDocumentsPanel.tsx` | templates, instances, HTML, PDF Titan | documents + reservation drafts | oui | current |
| `HahitantsoaDocumentsPanel.tsx` | templates, instances, HTML, PDF HAH | documents + event drafts | oui | current |
| `PaymentWorkflowPanel.tsx` | create + confirm payment | payments | oui | current |
| `BillingInvoicePanel.tsx` | invoices, installments, credit notes, settle/cancel/refund obligation | billing | oui | current |
| `LogisticsDeliveryPanel.tsx` | transitions, lines add/remove, complete passation | logistics | oui | current |
| `ReturnsHandlingPanel.tsx` | inspect + validate return operations | return operations | oui | current |
| `BreakageLossPanel.tsx` | inspect + validate settlements | damage/loss settlements | oui | current |
| `StockMovementLedgerPanel.tsx` | ledger stock read-only | stock movements | lecture | current |

### 4.7 Identity / audit / cashbox / caution

| Fichier | Rôle | APIs | Permission gating | Statut |
|---|---|---|---|---|
| `IdentityPanel.tsx` | roles + assignments read, write stubs | identity | oui | partial |
| `AuditPanel.tsx` | audit log read-only avec filtres | audit | oui | current |
| `CashboxPanel.tsx` | open/close sessions, list sessions, movements | cashbox | oui | current |
| `CautionRefundPanel.tsx` | caution deposits + refund touchpoints | payments + damage/loss | oui | current |

### 4.8 Placeholder workspaces

| Fichier | Rôle | Statut |
|---|---|---|
| `FutureWorkspacePanel.tsx` | placeholder contrôlé pour reports, catalog, procurement, hr, help | intentional placeholder |

---

## 5. Client API frontend

`frontend/src/api.ts` exporte actuellement **77 fonctions**.

Catégories réellement connectées:

- auth / session
- customers
- reservation drafts Titan
- hahitantsoa drafts + amendment flows
- documents HTML/PDF
- payments
- billing / installments / credit notes / refund obligations
- logistics transitions / item lines / passation
- return operations
- damage/loss settlements
- identity
- audit
- cashbox

Attention:

- la présence d’une fonction API ne signifie pas que toute l’UX prototype est finie
- l’absence d’une route React dédiée ne signifie pas absence backend
- F178A/F178B restent la référence pour différencier:
  - `connected but visually incomplete`
  - `backend-only`
  - `intentional placeholder`

---

## 6. Permission-aware gating

Etat actuel:

- FE-A gating reste actif et ne doit pas être régressé
- les panneaux de mutation principaux sont déjà gated
- les panneaux read-only ou placeholder ne doivent pas être interprétés comme des
  “pertes de permission”; certains sont simplement hors scope ou non confirmés

| Composant | Gating | Notes |
|---|---|---|
| `AvailabilityPanel.tsx` | oui | create/update drafts |
| `TitanStockMovementPanel.tsx` | oui | create stock movement |
| `CustomerPanel.tsx` | oui | create/edit/delete |
| `HahitantsoaEventDraftsPanel.tsx` | oui | create/update/delete/confirm/amendment |
| `PaymentWorkflowPanel.tsx` | oui | create/confirm payment |
| `BillingInvoicePanel.tsx` | oui | settle/cancel/installments/credit notes/refund obligation |
| `LogisticsDeliveryPanel.tsx` | oui | transitions, lines, passation |
| `ReturnsHandlingPanel.tsx` | oui | validate return |
| `BreakageLossPanel.tsx` | oui | validate settlement |
| `CashboxPanel.tsx` | oui | open/close sessions, create movement |
| `AuditPanel.tsx` | oui | lecture sensible |
| `IdentityPanel.tsx` | oui | write still partial UI-side |

Gaps réels restants côté permission-aware UX:

- confirmation Titan
- futures surfaces admin/settings
- futures surfaces planning/reports si elles deviennent interactives

---

## 7. Etats UX et tests

Etat général:

- loading / error / empty sont présents sur les principaux panneaux data-fetching
- les tests frontend couvrent les écrans majeurs et les flux FE-C à FE-J
- le responsive/accessibility pass FE-J est mergé

Points encore à surveiller:

- qualité visuelle mobile/tablet sur l’ensemble des écrans opérateurs
- lisibilité logos/surfaces sombres sur tous les modules
- cohérence prototype sur `CustomerPanel`, `AvailabilityPanel`, `IdentityPanel`

---

## 8. Ce qui est déjà livré sur `main`

Déjà merge et à ne plus traiter comme “future work”:

- FE-B0 app shell + theme foundation
- FE-B logistics / returns / damage-loss / ops inventory surfaces
- FE-B0R shell/theme/brand visual polish
- FE-C billing / credit notes / installments / refund obligation operator UI
- FE-D document workflow + PDF trigger / preview surfaces
- FE-E audit log viewer
- FE-F cashbox session management
- FE-G customer file and reservation-related redesign pass
- FE-H dashboard and navigation shell redesign
- FE-I approved placeholders for unmapped or unconfirmed areas
- FE-J responsive / accessibility / dark-mode polish

---

## 9. Vrais gaps frontend restants

Les gaps restants à traiter après FE-J sont:

1. écran `reservation detail` dédié
2. `new reservation wizard`
3. UI complète de confirmation Titan
4. planning/calendar → livré (weekly table via F180D1); calendrier enrichi repoussé
5. enrichissement `client file`
6. `reports/exports` après décision business/légale
7. complétion `settings/admin`
8. QA élargie de fidélité prototype, mobile/tablet, light/dark/logo

Ces gaps doivent être lus avec:

- `docs/audits/F178A_FRONTEND_CONNECTIVITY_AND_HYGIENE_AUDIT.md`
- `docs/design/FRONTEND_PROTOTYPE_GAP_ANALYSIS.md`
- `docs/design/FRONTEND_MIGRATION_ROADMAP_FROM_PROTOTYPE.md`

---

## 10. Bundle frontend recommandé après F178B

Prochain bundle recommandé:

- **FE-K — Reservation detail, new reservation wizard, and Titan confirmation UX**

Pourquoi:

- c’est le plus gros manque fonctionnel encore visible par rapport au prototype
- le backend est déjà suffisamment en place pour éviter d’inventer des contrats
- il ferme l’écart le plus important entre brouillons Titan/Hahitantsoa et un
  vrai parcours opérateur complet

Bundles suivants plausibles:

1. FE-K — reservation detail / new reservation wizard / Titan confirmation
2. FE-L — planning/calendar → livré (weekly table via F180D1)
3. FE-M — enriched client file + cross-linked commercial history
4. FE-N — admin/settings completion
5. FE-O — reports/exports only after business/legal decision

---
*Fin de la cartographie frontend*
