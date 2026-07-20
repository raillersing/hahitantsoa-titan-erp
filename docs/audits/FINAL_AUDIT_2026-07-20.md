# Audit Complet — Hahitantsoa/Titan ERP — 2026-07-20

## État du projet

- **Branche**: main (clean, 10 commits ahead of origin/main)
- **Tests**: 1546 backend passed + 462 frontend passed (0 failures)
- **Ruff**: 0 erreurs
- **TypeScript**: 0 erreurs
- **Git**: working tree clean, 1 stash vidé, 54 branches nettoyées

## Fonctionnalités connectées (API réelle)

### Backend (14 apps Django)
| App | Modèles | APIs | État |
|-----|---------|------|------|
| inventory | InventoryItem, InventoryAvailability, StockMovement, ReturnOperation, DamageLossSettlement | CRUD read-only + écritures stock/retour/damage | ✅ Complet |
| reservations | ReservationDraft, ReservationDraftLine | Draft CRUD + availability + confirmation | ✅ Complet |
| customers | Customer | CRUD complet | ✅ Complet |
| documents | DocumentInstance, DocumentTemplate, DocumentTemplateVersion | Registry + instances + preview | ✅ Complet |
| hahitantsoa | EventDraft, Venue, Service, AmendmentRequest | Discovery + drafts + availability | ✅ Complet |
| billing | Invoice, Installment, RefundObligation, CreditNote | List + settle + cancel + installments | ✅ Complet |
| payments | Payment | Create + confirm + cancel | ✅ Complet |
| cashbox | CashboxSession, CashboxMovement | Open + close + movements | ✅ Complet |
| logistics | LogisticsEvent, ItemLine | CRUD + transitions + passation | ✅ Complet |
| identity | ApplicationRole, UserRoleAssignment | Roles + assignments | ✅ Complet |
| audit | AuditEvent | Read-only | ✅ Complet |
| notifications | SystemNotification | List + mark read | ✅ Complet |
| excel_import | ImportJob | List + create + validate | ✅ Complet |

### Frontend (40+ pages)
| Page | API connectée | État |
|------|--------------|------|
| Dashboard | Session + résumé | ✅ |
| Customers (list/detail/CRUD) | getCustomers, createCustomer, etc. | ✅ |
| Inventory (catalogue/detail) | getInventoryItems, getInventoryItem | ✅ |
| Stock Movements | getStockMovements + getInventoryItems | ✅ Connecté |
| Stock Preparation | Mock partiel | ⚠️ |
| Inventory Management | Mock partiel | ⚠️ |
| Inventory Item Detail | Mock partiel | ⚠️ |
| Reservations (list/detail/new) | getReservationDrafts, createReservationDraft | ✅ |
| Reservation Detail | Partiellement mock | ⚠️ |
| Hahitantsoa (discovery/drafts) | getHahitantsoaDiscoveryItems, event drafts | ✅ |
| Documents (templates/instances) | getDocumentTemplates, instances | ✅ |
| Billing (invoices) | getBillingInvoices | ✅ |
| Payments | getPayments, createPayment | ✅ |
| Cashbox | getCashboxSessions, movements | ✅ |
| Logistics Dispatch | getLogisticsEvents | ✅ Connecté |
| Logistics Returns | getReturnOperations | ✅ Connecté |
| Breakage/Loss | getDamageLossSettlements | ✅ Connecté |
| Venues | getHahitantsoaVenues | ✅ Connecté |
| Services | getHahitantsoaServices | ✅ Connecté |
| Audit | getAuditEvents | ✅ |
| Identity/Roles | getRoles, assignments | ✅ |
| Notifications | getNotifications | ✅ |
| Excel Import | getImportJobs | ✅ |
| Profile | Session user | ✅ |
| Login/Logout | Session auth | ✅ |
| hr-payroll | Placeholder "en développement" | ❌ |
| purchasing | Placeholder "en développement" | ❌ |
| mobile-tablet | Placeholder "en développement" | ❌ |

## Pages encore en mock partiel

| Page | Ce qui manque |
|------|--------------|
| StockPreparationPage | Données préparation depuis réservations |
| InventoryManagementPage | Vue gestion complète (déjà catalogue) |
| InventoryItemPage | Détail item avec historique mouvements |
| ReservationDetailPage | Détail complet avec lifecycle |
| ReservationNewPage | Wizard complet de création |
| ReservationsPage | Liste avec filtres et statuts |
| DocumentsPage | Éditeur templates (localStorage) |
| BlacklistPage | Liste noire intervenants |
| PackageBuilderPage | Constructeur de packs |
| CautionPage | Gestion cautions |
| CustomersPage | Utilise mockData pour fallback |
| ProspectConversionAssistant | Assistant conversion prospect→client |

## Ce qui reste à implémenter (Roadmap F128)

### Priorité HAUTE
1. **Documents runtime PDF** — Génération de proforma/contrat/facture en PDF
2. **Paiements ledger** — Réconciliation complète, receipts
3. **Reservation lifecycle completion** — Confirmation transactionnelle finale
4. **RBAC expansion** — Tests négatifs ✅ fait, ADR ✅ fait

### Priorité MOYENNE
5. **Stock Preparation** — Connecter aux réservations confirmées
6. **Reservation Detail** — Lifecycle complet (préflight, confirmation, closeout)
7. **Documents Editor** — Remplacer localStorage par API templates
8. **Inventory Management** — Vue complète avec filtres avancés

### Priorité BASSE
9. **HR/Payroll** — Module entièrement nouveau
10. **Purchasing** — Module entièrement nouveau
11. **Mobile/Tablet** — Responsive design
12. **Blacklist** — Liste noire intervenants
13. **Package Builder** — Constructeur de packs matériels

## Sécurité
- RBAC: 2 rôles (identity_admin, reservation_sensitive_operator)
- Toutes les vues ont permission_classes
- Tests négatifs: 35 tests centralisés + 301 existants
- ADR-008 documenté

## Infrastructure
- Docker Compose local (db + redis + backend)
- CI GitHub Actions (backend + frontend + tooling)
- Pas de déploiement staging/production
- Pas de monitoring/logging externe

## Verdict

Le projet est à ~60% de maturité fonctionnelle.
Le backend est solide et bien testé.
Le frontend est largement connecté aux vraies APIs.
Les gaps principaux sont : PDF runtime, lifecycle completion, et pages secondaires encore en mock.
