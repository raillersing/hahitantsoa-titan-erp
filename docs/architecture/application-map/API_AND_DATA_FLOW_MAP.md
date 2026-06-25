# API_AND_DATA_FLOW_MAP.md — Flux API et donnees

> **Version:** F178B — 2026-06-25
> **Etat frontend de reference:** `main` @ `8cde58a775a44cd92112b9537347ec32c885c47b`

---

## 1. Regles de lecture

- backend/API reste autoritaire sur le comportement
- F178A/F178B doivent être lus avant tout nouveau bundle frontend
- ce document distingue:
  - `connected`
  - `connected but still partial visually`
  - `backend only`
  - `intentional placeholder`

---

## 2. Mapping frontend → API → backend

### 2.1 Dashboard

| Frontend | API | Backend | Statut |
|---|---|---|---|
| `DashboardPanel.tsx` | inventory, reservation drafts, payments, hahitantsoa drafts | inventory, reservations, payments, hahitantsoa | connected |

### 2.2 Titan

| Frontend | API | Backend | Statut |
|---|---|---|---|
| `AvailabilityPanel.tsx` | draft CRUD + availability previews | reservations + inventory + customers | connected |
| `TitanStockMovementPanel.tsx` | stock movement list/create | inventory | connected |
| `DocumentArtifactPreviewPanel.tsx` | private HTML artifact | documents | connected |
| `DocumentPdfPreviewPanel.tsx` | private PDF artifact | documents | connected |

Titan gap restant:

- confirmation Titan lifecycle UI n’est pas encore connectée côté écran, bien
  que le backend existe

### 2.3 Hahitantsoa

| Frontend | API | Backend | Statut |
|---|---|---|---|
| `HahitantsoaDiscoveryPanel.tsx` | discovery items | hahitantsoa | connected |
| `HahitantsoaEventDraftsPanel.tsx` | draft CRUD + confirm + amendment + preflights | hahitantsoa + inventory + customers | connected |

### 2.4 Customers

| Frontend | API | Backend | Statut |
|---|---|---|---|
| `CustomerPanel.tsx` | list/detail/create/update/delete/search | customers | connected |

### 2.5 Documents

| Frontend | API | Backend | Statut |
|---|---|---|---|
| `TitanDocumentsPanel.tsx` | templates, instances, HTML generate, PDF generate | documents + reservations | connected |
| `HahitantsoaDocumentsPanel.tsx` | templates, instances, HTML generate, PDF generate | documents + hahitantsoa | connected |
| preview panels | artifact HTML / PDF retrieval | documents | connected |

### 2.6 Payments / Billing / Cashbox

| Frontend | API | Backend | Statut |
|---|---|---|---|
| `PaymentWorkflowPanel.tsx` | payment list/create/confirm | payments | connected |
| `BillingInvoicePanel.tsx` | invoices, settle, cancel, installments, credit notes, refund obligations | billing + payments | connected |
| `CashboxPanel.tsx` | sessions list/open/close, movements list/create | cashbox | connected |
| `CautionRefundPanel.tsx` | payments + damage/loss touchpoints | payments + inventory | connected |

### 2.7 Logistics / Returns / Damage

| Frontend | API | Backend | Statut |
|---|---|---|---|
| `LogisticsDeliveryPanel.tsx` | event list, status transition, item lines add/remove, complete passation | logistics + documents + inventory | connected |
| `ReturnsHandlingPanel.tsx` | list + validate | inventory return operations | connected |
| `BreakageLossPanel.tsx` | list + validate | inventory damage/loss settlements | connected |
| `StockMovementLedgerPanel.tsx` | list ledger | inventory stock movements | connected |

### 2.8 Identity / Audit

| Frontend | API | Backend | Statut |
|---|---|---|---|
| `IdentityPanel.tsx` | roles + assignments | identity | partial |
| `AuditPanel.tsx` | audit events list/detail | audit | connected |

### 2.9 Placeholder routes

| Frontend | API | Backend | Statut |
|---|---|---|---|
| `#planning` | aucune route dédiée nouvelle | backend partiel via reservations/logistics | intentional placeholder |
| `#reports` | aucune action export live | non confirmé | intentional placeholder |
| `#catalog`, `#procurement`, `#hr`, `#help` | aucune API dédiée actuelle | non confirmé ou futur | intentional placeholder |

---

## 3. Workflows clés

### 3.1 Titan drafts

Connecté aujourd’hui:

- create draft
- update draft
- availability summary
- item preview availability

Reste à connecter:

- contract signed marker
- deposit received marker
- Titan confirmation
- dedicated reservation detail / wizard

### 3.2 Hahitantsoa drafts

Connecté aujourd’hui:

- create/update/delete
- availability preview
- confirmation preflight
- confirm
- amendment requests and lines
- amendment availability preflight

### 3.3 Logistics

Connecté aujourd’hui:

- list delivery/handover events
- transition status
- add/remove item lines
- complete passation

Le gap n’est plus API-connectivité mais plutôt:

- profondeur UX
- lisibilité prototype
- couverture de scénarios opérateurs plus détaillés

### 3.4 Finance

Connecté aujourd’hui:

- payments create/confirm
- billing settle/cancel
- installment schedule create
- credit note issue/cancel
- refund obligation execute
- cashbox session lifecycle

Le gap n’est plus “frontend absent”, mais:

- densité UX
- ecrans dédiés plus riches
- regroupement visuel plus fidèle au prototype

---

## 4. Résumé connectivité

| Domaine | Statut |
|---|---|
| Auth | connected |
| Customers | connected |
| Titan drafts | partial |
| Hahitantsoa drafts | connected |
| Documents / PDF | connected |
| Billing / payments | connected |
| Cashbox | connected |
| Logistics / returns / damage | connected |
| Audit | connected |
| Identity write admin | partial |
| Planning | placeholder |
| Reports / exports | placeholder |

---
*Fin des flux API et donnees*
