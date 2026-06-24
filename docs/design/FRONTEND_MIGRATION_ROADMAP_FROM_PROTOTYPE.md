# Roadmap de migration frontend depuis le prototype

> Version: F177A - 2026-06-24

## Principe

Le prototype impose un shell global et une thematique claire/sombre absents du
frontend actuel. Un bundle de fondation FE-B0 est donc requis avant la migration
des grands ecrans operationnels.

## Ordre recommande

### 1. FE-B0 - App shell, architecture de marque, et fondation light/dark

- Pages prototype source: `dashboard`, `login`, shell sidebar/topbar global
- Sources cartographie: `FRONTEND_MAP.md`, `NAVIGATION_TREE_TARGET.md`
- Cibles React: `frontend/src/App.tsx`, styles globaux, shell layout, auth shell
- APIs: aucune nouvelle
- Patterns: sidebar, topbar, scope badges, token system, theme attributes
- Impact theme: fondation complete
- Tests: navigation shell, auth shell, theme light/dark/system, focus visible
- Hard stops: logos illisibles sur dark, drift backend, nouveau dependency need
- Docs a mettre a jour apres implementation: oui

### 2. FE-B - UI operationnelle logistique depuis le prototype

- Pages prototype source: `logistics`, `returns`, `damage`, `inventory`
- Sources cartographie: `NAVIGATION_TREE_TARGET.md`, `API_AND_DATA_FLOW_MAP.md`
- Cibles React: `LogisticsDeliveryPanel.tsx`, `ReturnsHandlingPanel.tsx`,
  `BreakageLossPanel.tsx`, `StockMovementLedgerPanel.tsx`
- APIs: logistics, return operations, damage/loss, stock movements
- Patterns: workflow board, action bar, badges, tables, timeline
- Impact theme: surfaces operationnelles completes
- Tests: gating write/read-only, list/detail, empty/error, responsive
- Hard stops: besoin de nouvel endpoint, conflit scope HAH/TIT
- Docs update: oui si navigation/flows changent

### 3. FE-C - Billing / cashbox / credit note operator UI

- Prototype source: `billing`, `cashbox`
- Application-map source: billing, payments, cashbox nodes
- Cibles React: `BillingInvoicePanel.tsx`, `PaymentWorkflowPanel.tsx`, nouvelle route `#cashbox`
- APIs: billing, payments, cashbox
- Patterns: documents commerciaux, payment dialog, session cards, summaries
- Impact theme: badges finance, denied states, modal surfaces
- Tests: create/confirm/denied, read-only, snapshot both themes
- Hard stops: decisions business manquantes sur certains flux fiscaux
- Docs update: oui

### 4. FE-D - PDF generation trigger et workflow documentaire

- Prototype source: `documents`, `reservation-detail`
- Application-map source: documents flows
- Cibles React: docs panels, artifact preview, actions generation
- APIs: document templates, instances, generate PDF/HTML
- Patterns: template cards, preview panel, action bar, status pills
- Impact theme: preview shell, CTA contrastes
- Tests: permissions, generation states, preview fallback
- Hard stops: PDF runtime limitations non doc-only
- Docs update: oui

### 5. FE-E - Audit log viewer et UX securite

- Prototype source: `audit`, `admin`
- Application-map source: audit + identity
- Cibles React: nouvelle route `#audit`, `IdentityPanel.tsx`
- APIs: audit, roles, assignments
- Patterns: tables filtrees, status pills, security views
- Impact theme: audit badges, denied/read-only clarity
- Tests: read-only secure filters, keyboard nav, both themes
- Hard stops: toute demande d'exposer donnees protegees
- Docs update: oui

### 6. FE-F - Gestion des sessions de caisse

- Prototype source: `cashbox`
- Application-map source: cashbox functions
- Cibles React: nouvelle route `#cashbox`
- APIs: open/close session, movements
- Patterns: session cards, totals, forms, warnings
- Impact theme: finance surfaces and warning states
- Tests: session lifecycle, denied, dark mode readability
- Hard stops: backend contract mismatch
- Docs update: oui

### 7. FE-G - Redesign fiche client et detail reservation

- Prototype source: `clients`, `client-file`, `reservations-hah`,
  `reservations-titan`, `reservation-new`, `reservation-detail`
- Application-map source: customers + reservations
- Cibles React: `CustomerPanel.tsx`, `AvailabilityPanel.tsx`,
  `HahitantsoaEventDraftsPanel.tsx`, nouvelles sous-routes/detail flows
- APIs: customers, reservations, hahitantsoa drafts, preflights
- Patterns: split view, wizard, stepper, timeline, summary cards
- Impact theme: broad surface coverage
- Tests: mutation flows, read-only confirmed state, theme matrix
- Hard stops: prototype demands conflicting with confirmation rules
- Docs update: oui

### 8. FE-H - Dashboard et navigation shell redesign avec branding Ergon/Hahitantsoa/Titan

- Prototype source: `dashboard`, `notifications`, `help`
- Application-map source: nav tree complete
- Cibles React: `App.tsx`, `DashboardPanel.tsx`, shell nav
- APIs: dashboard current APIs only
- Patterns: KPI cards, quick actions, role navigation, notification entry points
- Impact theme: full shell polish
- Tests: role-filtered nav, current route highlight, theme + responsive
- Hard stops: nav nodes without approved map
- Docs update: oui

### 9. FE-I - Reports/exports placeholders et business-decision gates

- Prototype source: `reports`, `appointments`, `catalog`, `venues`, `procurement`, `hr`, `help`
- Application-map source: nodes future/non confirms
- Cibles React: placeholder routes/cards only as approved
- APIs: only confirmed APIs
- Patterns: placeholder cards, decision gates, empty states
- Impact theme: moderate
- Tests: no false affordance, denied/read-only, routing
- Hard stops: toute invention de backend ou de scope non confirme
- Docs update: oui

### 10. FE-J - Responsive mobile/tablette polish

- Prototype source: `mobile`, compact shell behaviors
- Application-map source: transverse
- Cibles React: global shell/components
- APIs: aucune nouvelle
- Patterns: stacked sections, drawers, touch targets, compact tables
- Impact theme: both themes on small screens
- Tests: viewport regressions, touch target, focus order
- Hard stops: perte d'information critique sur mobile
- Docs update: oui si navigation change
