# FRONTEND_MAP.md — Cartographie du frontend

> **Version:** F176A — 2026-06-24
> **Stack:** React 19.2.1, TypeScript 5.9.3 (strict), Vite 7.2.7, Vitest 4.0.16 + jsdom + RTL
> **Router:** Hash-based scope switching (`window.location.hash`) — pas de React Router
> **CSS:** CSS pur (pas de Tailwind, pas de CSS-in-JS)
> **Authentification:** Django session cookie + CSRF token

---

## 1. Architecture globale

> Références design frontend obligatoires avant implémentation:
> `docs/design/CLIENT_APPROVED_UI_REFERENCE.md`,
> `docs/design/UI_MIGRATION_CONTRACT.md`,
> `docs/design/THEME_AND_DARK_MODE_CONTRACT.md`,
> `docs/design/FRONTEND_PROTOTYPE_GAP_ANALYSIS.md`,
> `docs/design/FRONTEND_MIGRATION_ROADMAP_FROM_PROTOTYPE.md`

```
main.tsx
└── <StrictMode>
    └── ErrorBoundary.tsx
        └── AuthContext.tsx (useAuth)
            └── App.tsx
                ├── LoginPanel.tsx        (unauthenticated)
                └── module-panel
                    ├── DashboardPanel.tsx        (#dashboard)
                    ├── Titan scope                (#titan)
                    │   ├── Inline inventory list (App.tsx)
                    │   ├── AvailabilityPanel.tsx
                    │   ├── TitanStockMovementPanel.tsx
                    │   └── DocumentArtifactPreviewPanel.tsx
                    ├── Hahitantsoa scope            (#hahitantsoa)
                    │   ├── HahitantsoaDiscoveryPanel.tsx
                    │   └── HahitantsoaEventDraftsPanel.tsx
                    ├── Customers scope              (#customers)
                    │   └── CustomerPanel.tsx
                    ├── Commercial Ops scope         (#commercial-ops)
                    │   └── HahitantsoaCommercialOpsPanel.tsx
                    │       ├── TitanDocumentsPanel.tsx
                    │       ├── HahitantsoaDocumentsPanel.tsx
                    │       ├── PaymentWorkflowPanel.tsx
                    │       ├── BillingInvoicePanel.tsx
                    │       ├── LogisticsDeliveryPanel.tsx
                    │       ├── ReturnsHandlingPanel.tsx
                    │       ├── BreakageLossPanel.tsx
                    │       └── StockMovementLedgerPanel.tsx
                    ├── Identity scope               (#identity)
                    │   └── IdentityPanel.tsx
                    └── Caution scope                (#caution-refund)
                        └── CautionRefundPanel.tsx
```

---

## 2. Composants détaillés

### 2.1 Entry point et contextes

| Fichier | Rôle | Tests |
|---|---|---|
| `main.tsx` | Point d'entrée Vite/React, rend `App.tsx` | ❌ Non testé (bootstrap) |
| `AuthContext.tsx` | `useAuth()` — états `loading / authenticated / unauthenticated`, login/logout via session Django | Mocké via `vi.mock` dans `App.test.tsx` |
| `ErrorBoundary.tsx` | Capture d'erreurs React, affichage fallback | `ErrorBoundary.test.tsx` |

### 2.2 Navigation / Shell

| Fichier | Rôle | Tests |
|---|---|---|
| `App.tsx` | Shell principal : header, side-nav, hash routing, chargement inventaire global | `App.test.tsx` (~368 lignes) |

**Scopes (hash-based) :**

| Scope | Hash | Composant rendu | Inventaire items passés ? |
|---|---|---|---|
| Dashboard | `#dashboard` | `DashboardPanel` | Non |
| Titan | `#titan` | Inventaire inline + `AvailabilityPanel` + `TitanStockMovementPanel` + `DocumentArtifactPreviewPanel` | Oui |
| Hahitantsoa | `#hahitantsoa` | `HahitantsoaDiscoveryPanel` + `HahitantsoaEventDraftsPanel` | Oui (event drafts) |
| Customers | `#customers` | `CustomerPanel` | Non |
| Commercial Ops | `#commercial-ops` | `HahitantsoaCommercialOpsPanel` (agrégateur onglets) | Non |
| Identity | `#identity` | `IdentityPanel` | Non |
| Caution-refund | `#caution-refund` | `CautionRefundPanel` | Non |

### 2.3 Dashboard

| Fichier | Rôle | API utilisées | Permission gating | Tests |
|---|---|---|---|---|
| `DashboardPanel.tsx` | 4 cartes résumé avec navigation vers scopes | `getInventoryItems`, `getHahitantsoaEventDrafts`, `getReservationDrafts`, `getPayments` | N/A (read-only) | `DashboardPanel.test.tsx` (~202 lignes) |

### 2.4 Titan

| Fichier | Rôle | API utilisées | Permission gating | Tests |
|---|---|---|---|---|
| `AvailabilityPanel.tsx` | Brouillons réservation : CRUD lignes, client, période, notes + disponibilité | `getCustomers`, `getReservationDrafts`, `getReservationDraft`, `createReservationDraft`, `updateReservationDraft`, `getReservationAvailabilitySummary`, `getReservationAvailableItemPreviews`, `getReservationItemAvailabilityPreview`, `checkEndpointPermission` | ✅ Gated create/update | `AvailabilityPanel.test.tsx` (~808 lignes) |
| `TitanStockMovementPanel.tsx` | Mouvements de stock : liste + création | `getStockMovements`, `createStockMovement`, `checkEndpointPermission` | ✅ Gated create | `TitanStockMovementPanel.test.tsx` |
| `DocumentArtifactPreviewPanel.tsx` | Prévisualisation HTML sandboxée (iframe) | `getDocumentArtifactHtml` | N/A (read) | `DocumentArtifactPreviewPanel.test.tsx` |
| `DocumentPdfPreviewPanel.tsx` | Prévisualisation PDF sandboxée (iframe blob) | `getDocumentInstancePdfBlob` | N/A (read) | `DocumentPdfPreviewPanel.test.tsx` |

### 2.5 Hahitantsoa

| Fichier | Rôle | API utilisées | Permission gating | Tests |
|---|---|---|---|---|
| `HahitantsoaDiscoveryPanel.tsx` | Découverte read-only des concepts événement | `getHahitantsoaDiscoveryItems` | N/A (read) | `HahitantsoaDiscoveryPanel.test.tsx` |
| `HahitantsoaEventDraftsPanel.tsx` | CRUD brouillons événement + confirm + avenant (6 APIs amendment) | `getCustomers`, `getHahitantsoaEventDrafts`, `getHahitantsoaEventDraft`, `createHahitantsoaEventDraft`, `updateHahitantsoaEventDraft`, `deleteHahitantsoaEventDraft`, `getHahitantsoaEventDraftAvailabilityPreview`, `getHahitantsoaEventDraftConfirmationPreflight`, `getHahitantsoaEventDraftAmendmentPreflight`, `confirmHahitantsoaEventDraft`, + 6 amendment APIs | ✅ Gated create/update/confirm | `HahitantsoaEventDraftsPanel.test.tsx` |

### 2.6 Customers

| Fichier | Rôle | API utilisées | Permission gating | Tests |
|---|---|---|---|---|
| `CustomerPanel.tsx` | Liste, détail, création, édition, suppression client | `getCustomers`, `getCustomer`, `createCustomer`, `updateCustomer`, `deleteCustomer`, `checkCustomerWritePermission` | ✅ Gated create/edit/delete | `CustomerPanel.test.tsx` |

### 2.7 Commercial Ops (agrégateur)

| Fichier | Rôle | API utilisées | Permission gating | Tests |
|---|---|---|---|---|
| `HahitantsoaCommercialOpsPanel.tsx` | Shell onglets Commercial Ops | Aucune (passe aux enfants) | N/A | `HahitantsoaCommercialOpsPanel.test.tsx` |
| `TitanDocumentsPanel.tsx` | Documents Titan : templates, instances, génération HTML/PDF | `getReservationDrafts`, `getDocumentTemplates`, `getReservationDraftDocumentInstances`, `createReservationDraftDocumentInstance`, `generateReservationDraftDocumentInstance`, `generateReservationDraftDocumentInstancePdf` | N/A (read + write stubs) | `TitanDocumentsPanel.test.tsx` |
| `HahitantsoaDocumentsPanel.tsx` | Documents Hahitantsoa | `getHahitantsoaEventDrafts`, `getDocumentTemplates`, `getHahitantsoaEventDraftDocumentInstances`, `createHahitantsoaEventDraftDocumentInstance`, `generateHahitantsoaEventDraftDocumentInstance`, `generateHahitantsoaEventDraftDocumentInstancePdf` | N/A | `HahitantsoaDocumentsPanel.test.tsx` |
| `PaymentWorkflowPanel.tsx` | Paiements : liste + création + confirmation | `getPayments`, `createPayment`, `confirmPayment`, `checkEndpointPermission` | ✅ Gated create/confirm | `PaymentWorkflowPanel.test.tsx` |
| `BillingInvoicePanel.tsx` | Factures : liste + détail + settle/cancel/installments/credit notes | `getBillingInvoices`, `getBillingCreditNotes`, `settleBillingInvoice`, `cancelBillingInvoice`, `createBillingInvoiceInstallments`, `issueBillingCreditNote`, `cancelBillingCreditNote`, `executeBillingRefundObligation` | ✅ Gated write | `BillingInvoicePanel.test.tsx` |
| `LogisticsDeliveryPanel.tsx` | Événements logistiques : liste read-only | `getLogisticsEvents` | N/A (read) | `LogisticsDeliveryPanel.test.tsx` |
| `ReturnsHandlingPanel.tsx` | Retours : liste read-only | `getReturnOperations` | N/A (read) | `ReturnsHandlingPanel.test.tsx` |
| `BreakageLossPanel.tsx` | Règlements casse/perte : liste read-only | `getDamageLossSettlements` | N/A (read) | `BreakageLossPanel.test.tsx` |
| `StockMovementLedgerPanel.tsx` | Journal mouvements stock : liste read-only | `getStockMovements` | N/A (read) | `StockMovementLedgerPanel.test.tsx` |

### 2.8 Identity

| Fichier | Rôle | API utilisées | Permission gating | Tests |
|---|---|---|---|---|
| `IdentityPanel.tsx` | Rôles (read) + assignations (read) + stubs write | `getRoles`, `getRoleAssignments`, `checkIdentityWritePermission` | ✅ Gated write (overlay "Pending Backend Contract") | `IdentityPanel.test.tsx` |

### 2.9 Caution / Remboursements

| Fichier | Rôle | API utilisées | Permission gating | Tests |
|---|---|---|---|---|
| `CautionRefundPanel.tsx` | Déposer caution + trigger remboursement | `getPayments`, `createPayment`, `getDamageLossSettlements`, `checkEndpointPermission` | ✅ Gated create | `CautionRefundPanel.test.tsx` |

---

## 3. API Client — Dépendances (`api.ts`)

**38 fonctions exportées** réparties par catégorie :

| Catégorie | Fonctions | Nombre |
|---|---|---|
| Inventaire | `getInventoryItems` | 1 |
| Clients | `getCustomers`, `getCustomer`, `createCustomer`, `updateCustomer`, `deleteCustomer`, `checkCustomerWritePermission` | 6 |
| Disponibilité | `getReservationAvailabilitySummary`, `getReservationAvailableItemPreviews`, `getReservationItemAvailabilityPreview` | 3 |
| Brouillons Titan | `getReservationDrafts`, `getReservationDraft`, `createReservationDraft`, `updateReservationDraft` | 4 |
| Découverte Hahitantsoa | `getHahitantsoaDiscoveryItems` | 1 |
| Brouillons Hahitantsoa | `getHahitantsoaEventDrafts`, `getHahitantsoaEventDraft`, `createHahitantsoaEventDraft`, `updateHahitantsoaEventDraft`, `deleteHahitantsoaEventDraft`, `getHahitantsoaEventDraftAvailabilityPreview`, `getHahitantsoaEventDraftConfirmationPreflight`, `getHahitantsoaEventDraftAmendmentPreflight`, `confirmHahitantsoaEventDraft` | 9 |
| Avenant | `getHahitantsoaEventDraftAmendmentRequests`, `createHahitantsoaEventDraftAmendmentRequest`, `updateHahitantsoaEventDraftAmendmentRequest`, `getHahitantsoaEventDraftAmendmentRequest`, `getHahitantsoaEventDraftAmendmentRequestLines`, `createHahitantsoaEventDraftAmendmentRequestLine`, `updateHahitantsoaEventDraftAmendmentRequestLine`, `deleteHahitantsoaEventDraftAmendmentRequestLine`, `getHahitantsoaEventDraftAmendmentRequestAvailabilityPreflight` | 9 |
| Documents | `getDocumentTemplates`, `getDocumentArtifactHtml`, `getReservationDraftDocumentInstances`, `createReservationDraftDocumentInstance`, `getReservationDraftDocumentInstance`, `generateReservationDraftDocumentInstance`, `getHahitantsoaEventDraftDocumentInstances`, `createHahitantsoaEventDraftDocumentInstance`, `getHahitantsoaEventDraftDocumentInstance`, `generateHahitantsoaEventDraftDocumentInstance` | 10 |
| Paiements | `getPayments`, `createPayment`, `getPayment`, `confirmPayment` | 4 |
| Facturation | `getBillingInvoices` | 1 |
| Mouvements stock | `getStockMovements`, `createStockMovement` | 2 |
| Logistique | `getLogisticsEvents` | 1 |
| Retours | `getReturnOperations` | 1 |
| Casse/Perte | `getDamageLossSettlements` | 1 |
| Identity | `getRoles`, `getRoleAssignments`, `checkIdentityWritePermission` | 3 |
| Auth | `login`, `logout`, `checkAuth` | 3 |
| Permissions | `checkEndpointPermission` | 1 |
| **Total** | | **62** |

---

## 4. Permission gating — état actuel

| Composant | Gating actif ? | Actions gatées | Notes |
|---|---|---|---|
| `AvailabilityPanel.tsx` | ✅ | Création, édition brouillon | `checkEndpointPermission` sur `/api/v1/reservations/drafts/` |
| `TitanStockMovementPanel.tsx` | ✅ | "Record Movement" | `checkEndpointPermission` sur `/api/v1/inventory/stock-movements/` |
| `CustomerPanel.tsx` | ✅ | Create, Edit, Delete | `checkCustomerWritePermission` (OPTIONS sur `/api/v1/customers/create/`) |
| `IdentityPanel.tsx` | ✅ | Write ops | Overlay "Pending Backend Contract" si pas de permission |
| `CautionRefundPanel.tsx` | ✅ | "New Caution Deposit" | `checkEndpointPermission` sur paiements |
| `PaymentWorkflowPanel.tsx` | ✅ | "New Payment", confirm | `checkEndpointPermission` sur `/api/v1/payments/` |
| `HahitantsoaEventDraftsPanel.tsx` | ✅ | Create, update, delete, confirm, amendment | Multiple probes |
| **BillingInvoicePanel.tsx** | ✅ | write workflow sur facture, échéanciers, avoirs, remboursement | billing settlement endpoints |
| **LogisticsDeliveryPanel.tsx** | ❌ | N/A (read-only) | Pas de write exposé |
| **ReturnsHandlingPanel.tsx** | ❌ | N/A (read-only) | Pas de write exposé |
| **BreakageLossPanel.tsx** | ❌ | N/A (read-only) | Pas de write exposé |
| **StockMovementLedgerPanel.tsx** | ❌ | N/A (read-only) | Pas de write exposé |

**Gap FE-A :** les 6 panels read-only (Billing, Logistics, Returns, Breakage, Stock Ledger) et les actions write de Titan (confirm, cancel, contract-signed, deposit-received) nécessitent un gating.

---

## 5. États loading / error / empty

**Pattern universel** appliqué à tous les composants data-fetching :

```
state = loading → afficher spinner/explicite
state = error   → afficher notice role="alert" + message + retry éventuel
state = empty   → afficher message explicite + action suggérée
```

| Composant | Loading | Error | Empty | AbortController |
|---|---|---|---|---|
| DashboardPanel | ✅ | ✅ | ✅ | ✅ |
| AvailabilityPanel | ✅ | ✅ | ✅ | ✅ |
| TitanStockMovementPanel | ✅ | ✅ | ✅ | ✅ |
| HahitantsoaDiscoveryPanel | ✅ | ✅ | ✅ | ✅ |
| HahitantsoaEventDraftsPanel | ✅ | ✅ | ✅ | ✅ |
| CustomerPanel | ✅ | ✅ | ✅ | ✅ |
| IdentityPanel | ✅ | ✅ | ✅ | ✅ |
| CautionRefundPanel | ✅ | ✅ | ✅ | ✅ |
| PaymentWorkflowPanel | ✅ | ✅ | ✅ | ✅ |
| LogisticsDeliveryPanel | ✅ | ✅ | ✅ | ✅ |
| ReturnsHandlingPanel | ✅ | ✅ | ✅ | ✅ |
| BreakageLossPanel | ✅ | ✅ | ✅ | ✅ |
| StockMovementLedgerPanel | ✅ | ✅ | ✅ | ✅ |
| BillingInvoicePanel | ✅ | ✅ | ✅ | ✅ |
| TitanDocumentsPanel | ✅ | ✅ | ✅ | ✅ |
| HahitantsoaDocumentsPanel | ✅ | ✅ | ✅ | ✅ |

---

## 6. Tests

| Composant | Fichier test | Couverture |
|---|---|---|
| App | `App.test.tsx` | Navigation, auth states, hash change |
| LoginPanel | `LoginPanel.test.tsx` | Formulaire login |
| DashboardPanel | `DashboardPanel.test.tsx` | Cartes, navigation |
| AvailabilityPanel | `AvailabilityPanel.test.tsx` | CRUD brouillon, disponibilité |
| TitanStockMovementPanel | `TitanStockMovementPanel.test.tsx` | Liste + création |
| DocumentArtifactPreviewPanel | `DocumentArtifactPreviewPanel.test.tsx` | Iframe, erreurs |
| DocumentPdfPreviewPanel | `DocumentPdfPreviewPanel.test.tsx` | Blob iframe, erreurs |
| HahitantsoaDiscoveryPanel | `HahitantsoaDiscoveryPanel.test.tsx` | Liste discovery |
| HahitantsoaEventDraftsPanel | `HahitantsoaEventDraftsPanel.test.tsx` | CRUD + confirm |
| HahitantsoaCommercialOpsPanel | `HahitantsoaCommercialOpsPanel.test.tsx` | Onglets |
| CustomerPanel | `CustomerPanel.test.tsx` | CRUD + search |
| IdentityPanel | `IdentityPanel.test.tsx` | Liste rôles + assignations |
| CautionRefundPanel | `CautionRefundPanel.test.tsx` | Caution + refund |
| PaymentWorkflowPanel | `PaymentWorkflowPanel.test.tsx` | Paiements |
| BillingInvoicePanel | `BillingInvoicePanel.test.tsx` | Liste factures |
| LogisticsDeliveryPanel | `LogisticsDeliveryPanel.test.tsx` | Événements logistiques |
| ReturnsHandlingPanel | `ReturnsHandlingPanel.test.tsx` | Retours |
| BreakageLossPanel | `BreakageLossPanel.test.tsx` | Règlements |
| StockMovementLedgerPanel | `StockMovementLedgerPanel.test.tsx` | Journal stock |
| TitanDocumentsPanel | `TitanDocumentsPanel.test.tsx` | Documents Titan |
| HahitantsoaDocumentsPanel | `HahitantsoaDocumentsPanel.test.tsx` | Documents Hahitantsoa |
| ErrorBoundary | `ErrorBoundary.test.tsx` | Capture erreurs |

**Couverture :** 21 fichiers `.test.tsx` sur 23 fichiers `.tsx` (91%). Seuls `main.tsx` et `AuthContext.tsx` n'ont pas de fichier test dédié (le contexte est mocké dans `App.test.tsx`).

---

## 7. Écrans implémentés vs manquants

### Implémentés (current)

- [x] Dashboard avec métriques
- [x] Inventaire Titan (liste + disponibilité + stock movements)
- [x] Hahitantsoa discovery + event drafts (CRUD + confirm + avenant)
- [x] Clients (CRUD + recherche)
- [x] Identity (read rôles/assignations)
- [x] Commercial Ops aggregator (8 onglets)
- [x] Paiements (create + confirm)
- [x] Caution / remboursements
- [x] Documents (Titan + Hahitantsoa)
- [x] Prévisualisation HTML documents

### Partiels

- [~] Permission-aware gating (7 panels OK, 6 panels read-only sans gating, identity write stubs)
- [~] Logistics (read-only, pas de prep/handover/delivery note UI)
- [~] Billing (read-only, pas de settle/cancel/installments/credit notes UI)
- [x] PDF HTML runtime preview + generation trigger

### Planifiés / Futurs

- [ ] Cashbox session management (backend prêt)
- [ ] Audit log viewer (backend prêt)
- [ ] Reservation confirmation UI côté Titan
- [ ] Venue/room/hall/service CRUD (Hahitantsoa, hors scope MVP actuel)
- [ ] Écrans paramètres (numérotation, templates, seuils)

---

## 8. Frontend bundles recommandés post-gel backend

| Bundle | Scope | Composants impactés | Priorité |
|---|---|---|---|
| **FE-A** | Permission-aware UX gating | Tous les panels write (Billing, Logistics, Returns, Breakage, Stock, Titan confirm) | P0 — sécurité |
| **FE-B** | Logistics operational UI | `LogisticsDeliveryPanel.tsx` étendu + nouveau `LogisticsPrepPanel.tsx` | P0 |
| **FE-C** | Billing/cashbox/credit note UI | `BillingInvoicePanel.tsx` étendu; cashbox complet réservé à FE-F | P1 |
| **FE-D** | PDF generation trigger + viewer | `DocumentArtifactPreviewPanel.tsx`, `DocumentPdfPreviewPanel.tsx`, boutons PDF dans panels docs | P1 |
| **FE-E** | Audit log viewer | Nouveau `AuditLogPanel.tsx` | P2 |
| **FE-F** | Cashbox session management | Nouveau `CashboxPanel.tsx` | P2 |

---
*Fin de la cartographie frontend*
