# APPLICATION_FUNCTION_CATALOG.md — Catalogue des fonctions ERP

> **Version:** F176A — 2026-06-24
> **Référence backend gel:** F175A (HEAD `5d74979`)
> **Complétude globale estimée:** 81% (F162A), backend ~97% (F175A), frontend ~70%

---

## Légende

| Statut | Signification |
|---|---|
| **Implemented** | Code backend + frontend (si applicable) présents et testés. CI vert. |
| **Partial** | Backend implémenté mais frontend incomplet, ou inversement ; ou fonctionnalité de base sans toutes les règles métier. |
| **Planned** | Planifié dans Document A/B ou la queue orchestrateur, mais pas encore implémenté. |
| **Non confirmé** | Non confirmé dans Document A/B ou les règles métier approuvées. Ne pas implémenter sans décision métier. |

## 1. Périmètres métier Hahitantsoa / Titan

| ID | Fonction | Domaine | Source | Statut | Backend | Frontend | Tests | Règles métier liées | Dépendances | Agent responsable |
|---|---|---|---|---|---|---|---|---|---|---|
| `SCOPE-001` | Délimitation Titan = location pure matériel/article/pack | Scope | DEC-001, Document A | **Implemented** | `backend/apps/inventory/models.py`, `assert_titan_allowed_item_kind` | `App.tsx` boundaryNote | `test_inventory_titan_scope.py` | `scope.md` | inventory, identity | backend-maintenance |
| `SCOPE-002` | Délimitation Hahitantsoa = événement complet (local, lieu, salle, service autorisés) | Scope | DEC-003, Document A | **Implemented** | `backend/apps/hahitantsoa/models.py` | `HahitantsoaDiscoveryPanel.tsx` | `test_hahitantsoa_scope.py` | `scope.md` | hahitantsoa | backend-maintenance |
| `SCOPE-003` | Partage d'inventaire entre Hahitantsoa et Titan avec règles de disponibilité | Scope | INV-004, Document A | **Implemented** | `backend/apps/inventory/models.py` `InventoryAvailability` | Inline inventory list | `test_inventory_availability_*.py` | `scope.md`, `reservations.md` | inventory, reservations, hahitantsoa | backend-maintenance |

## 2. Réservations / Brouillons / Disponibilité

| ID | Fonction | Domaine | Source | Statut | Backend | Frontend | Tests | Règles métier liées | Dépendances | Agent responsable |
|---|---|---|---|---|---|---|---|---|---|---|
| `RES-001` | Création de brouillon de réservation Titan | Réservations | Document A | **Implemented** | `ReservationDraftListCreateAPIView` POST `/api/v1/reservations/drafts/` | `AvailabilityPanel.tsx` create | `test_reservation_draft_api.py` | INV-001, INV-005 | customers, inventory | frontend, backend-maintenance |
| `RES-002` | Mise à jour brouillon Titan (client, période, lignes, notes) | Réservations | Document A | **Implemented** | `ReservationDraftRetrieveAPIView` PATCH | `AvailabilityPanel.tsx` update | `test_reservation_draft_api.py` | INV-001 | customers, inventory | frontend |
| `RES-003` | Prévisualisation disponibilité par période | Réservations | Document A | **Implemented** | `ReservationAvailabilitySummaryAPIView`, `ReservationAvailableItemPreviewsAPIView` | `AvailabilityPanel.tsx` | `test_reservations_availability*.py` | INV-003, INV-004 | inventory | frontend |
| `RES-004` | Prévisualisation disponibilité par article | Réservations | Document A | **Implemented** | `ReservationItemAvailabilityPreviewAPIView` | `AvailabilityPanel.tsx` | `test_reservations_preview*.py` | INV-003 | inventory | frontend |
| `RES-005` | Marquage contrat signé | Réservations | Document A | **Implemented** | `ReservationDraftMarkContractSignedAPIView` | Non confirmé (UI stub) | `test_reservations_confirmation*.py` | INV-002, INV-006 | reservations | frontend |
| `RES-006` | Marquage acompte reçu | Réservations | Document A | **Implemented** | `ReservationDraftMarkRequiredDepositReceivedAPIView` | Non confirmé (UI stub) | `test_reservations_confirmation*.py` | INV-002 | reservations, payments | frontend |
| `RES-007` | Confirmation transactionnelle avec revalidation | Réservations | Document A | **Implemented** | `ReservationDraftConfirmAPIView` (`confirmation.py`, `transaction.atomic()`, `select_for_update`) | Non confirmé (pas de bouton confirm côté Titan) | `test_reservations_confirmation.py`, `test_titan_e2e_operational_acceptance.py` | INV-002, INV-003 | reservations, inventory, payments | frontend |
| `RES-008` | Annulation de brouillon | Réservations | Document A | **Implemented** | `ReservationDraftCancelAPIView` | Non confirmé | `test_reservation_draft_api.py` | INV-001 | reservations | frontend |
| `RES-009` | Brouillons événement Hahitantsoa (CRUD complet) | Réservations | Document A | **Implemented** | `HahitantsoaEventDraftListCreateAPIView`, `HahitantsoaEventDraftRetrieveUpdateAPIView` | `HahitantsoaEventDraftsPanel.tsx` | `test_hahitantsoa_event_draft_api.py` | INV-010, INV-011 | customers, inventory | frontend |
| `RES-010` | Confirmation Hahitantsoa avec préflight | Réservations | Document A | **Implemented** | `HahitantsoaEventDraftConfirmAPIView`, `confirmation_preflight` | `HahitantsoaEventDraftsPanel.tsx` confirm | `test_hahitantsoa_confirmation.py` | INV-002, INV-003 | hahitantsoa, inventory, payments | frontend |
| `RES-011` | Demandes d'avenant Hahitantsoa | Réservations | Document A | **Implemented** | `HahitantsoaEventDraftAmendmentRequestListCreateAPIView` + lines | `HahitantsoaEventDraftsPanel.tsx` amendment | `test_hahitantsoa_event_draft_api.py` | INV-006 | hahitantsoa, inventory | frontend |
| `RES-012` | Préflight avenant (disponibilité) | Réservations | Document A | **Implemented** | `HahitantsoaEventDraftAmendmentRequestAvailabilityPreflightAPIView` | `HahitantsoaEventDraftsPanel.tsx` | `test_hahitantsoa_event_draft_api.py` | INV-003 | hahitantsoa, inventory | frontend |

## 3. Workflow de confirmation

| ID | Fonction | Domaine | Source | Statut | Backend | Frontend | Tests | Règles métier liées | Dépendances | Agent responsable |
|---|---|---|---|---|---|---|---|---|---|---|
| `CNF-001` | Vérification préalable : contrat signé + acompte + disponibilités | Confirmation | Document A | **Implemented** | `get_reservation_draft_confirmation_preflight_service`, `get_hahitantsoa_event_draft_confirmation_preflight` | Préflight affiché dans `HahitantsoaEventDraftsPanel.tsx` | `test_reservations_confirmation_preflight.py`, `test_hahitantsoa_confirmation.py` | INV-002, INV-003 | reservations, hahitantsoa, inventory | frontend, backend-maintenance |
| `CNF-002` | Verrou transactionnel select-for-update | Confirmation | DEC-005 | **Implemented** | `confirmation.py` (`select_for_update`) | N/A (backend only) | `test_reservations_confirmation.py` | INV-003 | reservations, inventory | backend-maintenance |
| `CNF-003` | Prévention double réservation | Confirmation | DEC-005 | **Implemented** | `confirmation.py` double-booking guard | N/A | `test_reservations_confirmation.py` | INV-003 | reservations, inventory | backend-maintenance |

## 4. Clients / Contacts

| ID | Fonction | Domaine | Source | Statut | Backend | Frontend | Tests | Règles métier liées | Dépendances | Agent responsable |
|---|---|---|---|---|---|---|---|---|---|---|
| `CUS-001` | Fichier client (CRUD + soft-delete) | Clients | Document A | **Implemented** | `CustomerListAPIView`, `CustomerCreateAPIView`, `CustomerUpdateAPIView`, `CustomerSoftDeleteAPIView` | `CustomerPanel.tsx` | `test_customer_*.py` (3 fichiers) | — | common | frontend |
| `CUS-002` | Recherche client par nom/email/téléphone | Clients | Document A | **Implemented** | Query params sur `GET /api/v1/customers/` | `CustomerPanel.tsx` search | `test_customer_readonly_api.py` | — | customers | frontend |

## 5. Identité / Rôles / Opérateurs

| ID | Fonction | Domaine | Source | Statut | Backend | Frontend | Tests | Règles métier liées | Dépendances | Agent responsable |
|---|---|---|---|---|---|---|---|---|---|---|
| `IDT-001` | Rôles applicatifs (CRUD) | Identité | Document A | **Implemented** | `ApplicationRoleListCreateAPIView`, `ApplicationRoleDetailAPIView` | `IdentityPanel.tsx` (read) | `test_identity_api.py` | INV-017 | identity | frontend |
| `IDT-002` | Assignation / révocation de rôles | Identité | Document A | **Implemented** | `AssignRoleAPIView`, `RevokeRoleAPIView` | `IdentityPanel.tsx` (stub "Pending Backend Contract") | `test_identity_api.py` | INV-017 | identity | frontend |
| `IDT-003` | Permissions endpoint (OPTIONS probe) | Identité | Document A | **Implemented** | `checkEndpointPermission` côté frontend + backend auth | `checkEndpointPermission` dans `api.ts` | `test_identity_authorization.py` | INV-018 | identity | frontend |
| `IDT-004` | Session auth (login/logout/CSRF) | Identité | Document A | **Implemented** | Django session + CSRF | `AuthContext.tsx`, `LoginPanel.tsx` | `App.test.tsx` | — | identity | frontend |

## 6. Catalogue / Articles / Packs / Inventaire

| ID | Fonction | Domaine | Source | Statut | Backend | Frontend | Tests | Règles métier liées | Dépendances | Agent responsable |
|---|---|---|---|---|---|---|---|---|---|---|
| `INV-001` | Articles d'inventaire (CRUD) | Inventaire | Document A | **Implemented** | `InventoryItemListAPIView`, `InventoryItemRetrieveAPIView` | Inline list in `App.tsx` (Titan scope) | `test_inventory_item_*.py` | INV-004, INV-005 | common, inventory | frontend |
| `INV-002` | Types d'article : matériel, article, pack matériel | Inventaire | DEC-001 | **Implemented** | `InventoryItemKind` enum | `kindLabel()` in `App.tsx` | `test_inventory_titan_scope.py` | INV-005 | inventory | backend-maintenance |
| `INV-003` | Mouvements de stock (entrée/sortie/ajustement) | Inventaire | Document A | **Implemented** | `InventoryStockMovementListCreateAPIView` | `TitanStockMovementPanel.tsx` | `test_inventory_stock_movement_*.py` | INV-014 | inventory, reservations | frontend |
| `INV-004` | Gestion des consommables et seuils | Inventaire | Document A | **Non confirmé** | Modèle de base existe, pas de seuils actifs | Non implémenté | — | INV-014 | inventory | business, backend-maintenance |

## 7. Logistique / Passation / Livraison / Retour / Casse / Perte

| ID | Fonction | Domaine | Source | Statut | Backend | Frontend | Tests | Règles métier liées | Dépendances | Agent responsable |
|---|---|---|---|---|---|---|---|---|---|---|
| `LOG-001` | Événements logistiques (livraison, retrait, préparation, passation) | Logistique | Document A | **Implemented** | `LogisticsEventCreateAPIView`, `LogisticsEventUpdateAPIView`, `LogisticsEventTransitionAPIView` | `LogisticsDeliveryPanel.tsx` (read-only) | `test_logistics_api.py`, `test_logistics_services.py` | INV-010, INV-011 | logistics, reservations, inventory | frontend |
| `LOG-002` | Lignes d'articles dans événement logistique | Logistique | Document A | **Implemented** | `LogisticsEventItemLineAddAPIView`, `LogisticsEventItemLineRemoveAPIView` | Non confirmé | `test_logistics_api.py` | INV-010 | logistics, inventory | frontend |
| `LOG-003` | Passation client (signature) | Logistique | Document B | **Implemented** | `LogisticsEventCompletePassationAPIView` (`complete_handover_passation`) | Non confirmé (UI opérationnel manquant) | `test_logistics_services.py` | INV-011 | logistics, documents | frontend |
| `LOG-004` | Bon de livraison (génération document) | Logistique | Document A/B | **Implemented** | `create_delivery_note_from_handover_event` | Non confirmé | `test_logistics_services.py` | INV-011 | logistics, documents | frontend |
| `LOG-005` | Retour — opérations de retour (intact/cassé/manquant) | Logistique | Document A | **Implemented** | `InventoryReturnOperationListCreateAPIView`, `InventoryReturnOperationValidateAPIView` | `ReturnsHandlingPanel.tsx` (read-only) | `test_inventory_return_operation_*.py` | INV-012 | inventory, logistics | frontend |
| `LOG-006` | Casse/Perte — constat et règlement | Logistique | Document A | **Implemented** | `InventoryDamageLossSettlementListCreateAPIView`, `InventoryDamageLossSettlementValidateAPIView` | `BreakageLossPanel.tsx` (read-only) | `test_inventory_damage_loss_*.py` | INV-013 | inventory, payments | frontend |
| `LOG-007` | Exécution du règlement casse/perte | Logistique | Document A | **Implemented** | `InventoryDamageLossSettlementExecutionExecuteAPIView` | Non confirmé | `test_inventory_damage_loss_*.py` | INV-013 | inventory, billing, payments | frontend |
| `LOG-008` | Remboursement caution (obligation) | Logistique | Document A | **Implemented** | `InventoryCautionRefundObligation` | `CautionRefundPanel.tsx` | `test_inventory_damage_loss_*.py` | INV-013 | inventory, payments | frontend |
| `LOG-009` | Excédent client (facturation supplémentaire) | Logistique | Document A | **Implemented** | `InventoryDamageLossExcessReceivable`, `InventoryExcessReceivableGenerateInvoiceAPIView` | Non confirmé | `test_inventory_damage_loss_*.py` | INV-013 | inventory, billing | frontend |

## 8. Documents commerciaux / Templates / PDF / Signature

| ID | Fonction | Domaine | Source | Statut | Backend | Frontend | Tests | Règles métier liées | Dépendances | Agent responsable |
|---|---|---|---|---|---|---|---|---|---|---|
| `DOC-001` | Registre de templates (proforma, contrat, BL, facture, reçu, avenant) | Documents | Document A | **Implemented** | `DocumentTemplateRegistryAPIView`, `registry.py` | `TitanDocumentsPanel.tsx`, `HahitantsoaDocumentsPanel.tsx` | `test_documents_template_*.py` | — | documents | frontend |
| `DOC-002` | Instanciation de document depuis brouillon | Documents | Document A | **Implemented** | `ReservationDraftDocumentInstanceListCreateAPIView`, `HahitantsoaEventDraftDocumentInstanceListCreateAPIView` | `TitanDocumentsPanel.tsx`, `HahitantsoaDocumentsPanel.tsx` | `test_documents_reservation_draft_instance_api.py`, `test_hahitantsoa_event_draft_document_api.py` | — | documents, reservations, hahitantsoa | frontend |
| `DOC-003` | Génération runtime HTML | Documents | Document A | **Implemented** | `generate_reservation_draft_document_instance_html`, `runtime.py` | `DocumentArtifactPreviewPanel.tsx` (iframe HTML) | `test_documents_runtime_generation.py` | — | documents | frontend |
| `DOC-004` | Génération PDF | Documents | Document A | **Partial** | `DocumentPDFGenerator` ABC + `MockPDFGenerator`, `generate_document_instance_pdf` | Non implémenté (seulement preview HTML) | `test_documents_pdf_generation.py` | — | documents | frontend |
| `DOC-005` | Gestion des templates par opérateur (admin UI) | Documents | Document A | **Non confirmé** | Templates code-defined dans `registry.py` | Non implémenté | — | — | documents | business, frontend |

## 9. Facturation / Factures / Échéanciers / Avoirs / Remboursements / Numérotation légale

| ID | Fonction | Domaine | Source | Statut | Backend | Frontend | Tests | Règles métier liées | Dépendances | Agent responsable |
|---|---|---|---|---|---|---|---|---|---|---|
| `BIL-001` | Facturation — émission de facture | Facturation | Document A | **Implemented** | `BillingInvoiceListAPIView`, settle/cancel/correct | `BillingInvoicePanel.tsx` (read-only) | `test_billing_api.py`, `test_billing_services.py` | — | billing, documents | frontend |
| `BIL-002` | Règlement de facture | Facturation | Document A | **Implemented** | `BillingInvoiceSettleAPIView` | Non confirmé | `test_billing_api.py` | — | billing, payments | frontend |
| `BIL-003` | Annulation de facture | Facturation | Document A | **Implemented** | `BillingInvoiceCancelAPIView` | Non confirmé | `test_billing_api.py` | — | billing | frontend |
| `BIL-004` | Échéanciers (50% J-30, solde J-10) | Facturation | INV-009 | **Implemented** | `BillingInvoiceInstallmentCreateAPIView`, `BillingInstallmentAllocateAPIView` | Non confirmé | `test_billing_installment_*.py` | INV-009 | billing, payments | frontend |
| `BIL-005` | Numérotation légale des factures | Facturation | Document A | **Implemented** | `BillingInvoiceNumberingPolicy`, `assign_invoice_number` | Non confirmé | `test_billing_numbering.py` | — | billing | backend-maintenance |
| `BIL-006` | Avoirs (credit notes) — émission | Facturation | Document A | **Implemented** | `BillingCreditNoteListCreateAPIView` | Non confirmé | `test_billing_credit_notes.py` | — | billing | frontend |
| `BIL-007` | Avoirs — récupération et annulation | Facturation | Document A | **Implemented** | `BillingCreditNoteRetrieveAPIView`, `BillingCreditNoteCancelAPIView` | Non confirmé | `test_billing_credit_notes.py` | — | billing | frontend |
| `BIL-008` | Obligations de remboursement | Facturation | Document A | **Implemented** | `BillingRefundObligation`, `BillingRefundObligationExecuteAPIView` | Non confirmé | `test_billing_refund_obligation.py` | — | billing, payments | frontend |

## 10. Paiements / Acomptes / Remboursements / Réconciliation

| ID | Fonction | Domaine | Source | Statut | Backend | Frontend | Tests | Règles métier liées | Dépendances | Agent responsable |
|---|---|---|---|---|---|---|---|---|---|---|
| `PAY-001` | Enregistrement de paiement (cash, chèque, virement, MVola) | Paiements | INV-007, Document A | **Implemented** | `PaymentListCreateAPIView`, `PaymentConfirmAPIView` | `PaymentWorkflowPanel.tsx` | `test_payments_api.py`, `test_payments_services.py` | INV-007, INV-008 | payments, documents | frontend |
| `PAY-002` | Annulation de paiement | Paiements | Document A | **Implemented** | `PaymentCancelAPIView` | Non confirmé | `test_payments_api.py` | — | payments | frontend |
| `PAY-003` | Réconciliation | Paiements | Document A | **Implemented** | `PaymentReconcileAPIView` | Non confirmé | `test_payments_api.py` | — | payments | frontend |
| `PAY-004` | Remboursement (création + confirmation) | Paiements | Document A | **Implemented** | `RefundPaymentCreateAPIView`, `RefundPaymentConfirmAPIView` | `CautionRefundPanel.tsx` (partiel) | `test_payments_refund.py` | — | payments, inventory | frontend |
| `PAY-005` | Passerelle MVola (backend abstraction) | Paiements | Document A | **Partial** | `PaymentGatewayAdapter` ABC, `MockPaymentGatewayAdapter`, `MVolaGatewayAdapter` (sandbox) | Non implémenté | `test_payments_gateway.py` | — | payments | backend-maintenance (hors gel) |
| `PAY-006` | Callback passerelle | Paiements | Document A | **Implemented** | `GatewayPaymentCallbackAPIView` | Non implémenté | `test_payments_gateway.py` | — | payments | backend-maintenance |

## 11. Caisse / Sessions / Clôtures

| ID | Fonction | Domaine | Source | Statut | Backend | Frontend | Tests | Règles métier liées | Dépendances | Agent responsable |
|---|---|---|---|---|---|---|---|---|---|---|
| `CASH-001` | Ouverture de session caisse | Caisse | INV-015, Document A | **Implemented** | `CashboxSessionOpenAPIView` | Non confirmé | `test_cashbox_api.py`, `test_cashbox_services.py` | INV-015 | cashbox, identity | frontend |
| `CASH-002` | Clôture de session caisse | Caisse | INV-015, Document A | **Implemented** | `CashboxSessionCloseAPIView` | Non confirmé | `test_cashbox_api.py` | INV-015 | cashbox | frontend |
| `CASH-003` | Mouvements de caisse (entrée/sortie) | Caisse | INV-015, Document A | **Implemented** | `CashboxMovementCreateAPIView` | Non confirmé | `test_cashbox_api.py` | INV-015 | cashbox, billing, payments | frontend |
| `CASH-004` | Export justificatif caisse (INV-015) | Caisse | Document A | **Partial** | Modèles existent, format d'export non spécifié | Non implémenté | — | INV-015 | cashbox | business, frontend |

## 12. Audit / Attribution / Actions sensibles

| ID | Fonction | Domaine | Source | Statut | Backend | Frontend | Tests | Règles métier liées | Dépendances | Agent responsable |
|---|---|---|---|---|---|---|---|---|---|---|
| `AUD-001` | Journal d'audit immuable | Audit | INV-018, Document A | **Implemented** | `AuditEventListAPIView`, `AuditEventRetrieveAPIView` | Non confirmé | `test_audit_api.py`, `test_audit_transaction_safety.py` | INV-018 | audit | frontend |
| `AUD-002` | Enregistrement audit transaction-safe | Audit | Document A | **Implemented** | `record_audit_event_on_commit` (`transaction.on_commit`) | N/A | `test_audit_transaction_safety.py` | INV-018 | audit | backend-maintenance |
| `AUD-003` | Attribution durable (created_by, updated_by, confirmed_by) | Audit | Document A | **Implemented** | `AuditableModel` dans `common/models.py` | N/A | `test_reservations_attribution.py` | INV-018 | common | backend-maintenance |

## 13. Reporting / Exports

| ID | Fonction | Domaine | Source | Statut | Backend | Frontend | Tests | Règles métier liées | Dépendances | Agent responsable |
|---|---|---|---|---|---|---|---|---|---|---|
| `RPT-001` | Export comptable (SIE/FEC/plan comptable) | Reporting | Document A | **Non confirmé** | Non implémenté (format non spécifié dans A/B) | Non implémenté | — | — | billing | business, backend-maintenance (hors gel) |
| `RPT-002` | Tableau de bord opérationnel | Reporting | Document A | **Partial** | `DashboardPanel.tsx` (cards basiques) | `DashboardPanel.tsx` | `DashboardPanel.test.tsx` | — | — | frontend |
| `RPT-003` | Rapports de clôture commercial | Reporting | Document A | **Implemented** | `ReservationDraftCloseoutSummaryAPIView` | Non confirmé | `test_reservations_closeout*.py` | — | reservations, billing, payments, logistics, inventory | frontend |

## 14. UX Opérateur Frontend

| ID | Fonction | Domaine | Source | Statut | Backend | Frontend | Tests | Règles métier liées | Dépendances | Agent responsable |
|---|---|---|---|---|---|---|---|---|---|---|
| `UX-001` | Authentification session + gating | UX | Document A | **Implemented** | Django session auth | `LoginPanel.tsx`, `AuthContext.tsx` | `App.test.tsx`, `LoginPanel.test.tsx` | — | identity | frontend |
| `UX-002` | Permission-aware UI gating | UX | Document A | **Partial** | Backend auth complet | `checkEndpointPermission` utilisé dans 7+ panels | Tests par panel | INV-017 | identity | frontend (FE-A recommandé) |
| `UX-003` | États loading / error / empty | UX | `DESIGN.md` | **Implemented** | N/A | Tous les panels | Tests par panel | — | — | frontend |
| `UX-004` | Accessibilité (ARIA, keyboard, focus) | UX | `DESIGN.md` | **Partial** | N/A | `aria-label`, `aria-current`, `role="alert"` dans plusieurs panels | Tests RTL | WCAG | — | frontend (FE-C recommandé) |
| `UX-005` | Responsive | UX | `DESIGN.md` | **Partial** | N/A | CSS basique responsive | Non testé | — | — | frontend |

## 15. Permissions / Sécurité

| ID | Fonction | Domaine | Source | Statut | Backend | Frontend | Tests | Règles métier liées | Dépendances | Agent responsable |
|---|---|---|---|---|---|---|---|---|---|---|
| `SEC-001` | RBAC (rôles + assignations) | Sécurité | Document A | **Implemented** | `ApplicationRole`, `UserRoleAssignment` | `IdentityPanel.tsx` (read) | `test_identity_*.py` (6 fichiers) | INV-017 | identity | backend-maintenance |
| `SEC-002` | Permission objets (HasReservationSensitiveAccess) | Sécurité | Document A | **Implemented** | `HasReservationSensitiveAccess` | Options probe frontend | `test_identity_authorization.py` | INV-018 | identity | backend-maintenance |
| `SEC-003` | CSRF-safe mutations | Sécurité | Document A | **Implemented** | Django CSRF middleware | `getCsrfToken()` dans `api.ts` | `App.test.tsx` | — | identity | frontend |
| `SEC-004` | Documents sensibles privés (CIN, NIF, etc.) | Sécurité | INV-017 | **Non confirmé** | Modèle de base `DocumentInstance` avec flags | Non implémenté | — | INV-017 | documents | business, frontend |

## 16. CI / DevOps / Mise en production

| ID | Fonction | Domaine | Source | Statut | Backend | Frontend | Tests | Règles métier liées | Dépendances | Agent responsable |
|---|---|---|---|---|---|---|---|---|---|---|
| `OPS-001` | Pipeline CI (backend + frontend) | DevOps | Workflow agent | **Implemented** | `.github/workflows/ci.yml` (pytest + ruff + Django checks) | `.github/workflows/ci.yml` (npm test + build) | CI verte | — | — | infra |
| `OPS-002` | Health checks / readiness | DevOps | Document A | **Implemented** | `/healthz/`, `/readyz/` (`config/health.py`) | N/A | `test_metrics_endpoint.py` | — | — | backend-maintenance |
| `OPS-003` | Metrics opérationnels | DevOps | Document A | **Implemented** | `/metrics/` (`config/metrics.py`) | N/A | `test_metrics_endpoint.py` | — | — | backend-maintenance |
| `OPS-004` | Logging structuré | DevOps | Document A | **Implemented** | `LOGGING` dict dans `settings.py` | N/A | N/A | — | — | backend-maintenance |
| `OPS-005` | Docker / Compose local | DevOps | Document A | **Implemented** | `Dockerfile`, `compose.agent-ci.yaml` | N/A | N/A | — | — | infra |
| `OPS-006` | Manifests Kubernetes production | DevOps | Document A | **Planned** | Non implémenté | N/A | — | — | — | infra |
| `OPS-007` | Tests E2E opérationnels | DevOps | Document A | **Implemented** | `test_titan_e2e_operational_acceptance.py` (309 lignes) | Non implémenté | `test_titan_e2e_operational_acceptance.py` | — | — | backend-maintenance |

---

## Synthèse par domaine

| Domaine | Fonctions | Implemented | Partial | Planned | Non confirmé |
|---|---|---:|---:|---:|---:|
| Scope métier | 3 | 3 | 0 | 0 | 0 |
| Réservations | 12 | 10 | 2 | 0 | 0 |
| Confirmation | 3 | 3 | 0 | 0 | 0 |
| Clients | 2 | 2 | 0 | 0 | 0 |
| Identité | 4 | 3 | 1 | 0 | 0 |
| Inventaire | 4 | 3 | 0 | 0 | 1 |
| Logistique | 9 | 7 | 2 | 0 | 0 |
| Documents | 5 | 3 | 1 | 0 | 1 |
| Facturation | 8 | 7 | 0 | 0 | 1 |
| Paiements | 6 | 4 | 2 | 0 | 0 |
| Caisse | 4 | 3 | 1 | 0 | 0 |
| Audit | 3 | 3 | 0 | 0 | 0 |
| Reporting | 3 | 1 | 1 | 0 | 1 |
| UX Frontend | 5 | 3 | 2 | 0 | 0 |
| Sécurité | 4 | 3 | 0 | 0 | 1 |
| DevOps | 7 | 5 | 0 | 1 | 1 |
| **Total** | **82** | **63** | **12** | **1** | **6** |

---
*Fin du catalogue des fonctions*
