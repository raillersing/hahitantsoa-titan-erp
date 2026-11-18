# Matrice normative d'accès et partage des dossiers — Lot A0 (Révisée)

Date : 16 novembre 2026  
Baseline auditée et vérifiée : `c0aa4ea7200e1a73cf18e2159a95aeb470608e05` (main propre, identique au SHA du plan)  
Statut : **RÉFÉRENCE NORMATIVE A0 RÉVISÉE — CADRE CONTRACTUEL VALIDÉ AVEC RÉSERVES D01 ; ÉTAT LOCAL : LOT A3 LIVRÉ EN PR #929 (SHA e1ce04b, CI GITHUB ACTIONS VERTE RUN 43842713724), LOT A1 EN PRÉPARATION ACTIVE SUR FEAT/BACKEND-ACCESS-LOT-A1**  
Worktree documentaire : `/home/raillersing/projects/erp-access-plan-20261116`  
Profil documentaire : codex-native-wsl-mutating  

---

## 1. Contexte, Méthodologie et Périmètre

### 1.1 Objectif
Formaliser la matrice normative exhaustive régissant l'ensemble des accès utilisateurs, la visibilité des données et le partage des dossiers au sein de l'ERP Hahitantsoa / Titan. Ce livrable constitue le contrat préalable obligatoire (Lot A0) avant toute modification de code backend (Lots A1 à A5) ou frontend (Lots B1 à B4).

### 1.2 Principes directeurs intangibles (R01 à R12)
- **R01. Dossiers partagés :** Les dossiers d'entreprise (clients, réservations, devis, contrats, factures, événements logistiques) sont partagés entre collaborateurs autorisés. L'attribut `created_by` est une attribution d'audit infalsifiable ; il ne confère aucun droit de propriété exclusive.
- **R02. Consultation et édition ordinaire des brouillons :** La consultation et l'édition ordinaire des brouillons de réservation demeurent ouvertes à tout utilisateur authentifié actif (`IsAuthenticatedReservationDraftBoundary`), conformément à l'amendement du 6 novembre de l'ADR-011.
- **R03. Opérations sensibles protégées :** La confirmation contractuelle, la signature, l'annulation, la clôture, l'encaissement et les écritures financières requièrent une capacité explicite, le respect strict des prérequis métier (INV-SEQ-01), une attribution d'audit nominative et des verrous transactionnels (`select_for_update`).
- **R04. Distinction Gérant vs Staff / Superuser :** Le gérant d'entreprise (`owner_manager`) dispose des pleins pouvoirs de gestion métier opérationnelle, mais n'est ni `is_staff` ni `is_superuser`. Aucun compte ne doit être promu `is_staff` pour contourner un refus fonctionnel. `is_staff` est réservé à l'administration technique `/admin/` et aux purges de tests (`canSuperAdminDelete`). `is_superuser` est réservé à la plateforme technique.
- **R05. Séparation Stock/Logistique vs Finance :** Les rôles magasinier (`storekeeper`) et responsable logistique (`logistics_manager`) gèrent le catalogue, les emplacements et les opérations physiques, sans aucun droit d'encaissement, de confirmation contractuelle ou de transaction financière sur la casse.
- **R06. Périmètres personnels préservés :** La caisse individuelle (opérateur de session), les notifications privées, les jobs d'import Excel et les sessions temporaires de l'assistant de réservation restent strictement isolés à leur créateur.
- **R07. Sources des droits :** Les capacités effectives proviennent exclusivement des affectations actives (`UserRoleAssignment`) et des groupes historiques supportés. Un intitulé personnalisé ou une description textuelle n'accorde aucune permission.
- **R08. Comptes inactifs et sessions :** Les comptes désactivés (`is_active=False`) perdent immédiatement toute capacité et leurs sessions sont révoquées.
- **R09. Documents privés protégés :** Accès serveur contrôlé par catégorie (opérationnelle vs financière), règle identique en HTML et PDF, absence de fuite de chemins locaux ou d'URL permanentes publiques.
- **R10. Frontière Titan / Hahitantsoa :** Titan est strictement limité au matériel (`material`, `article`, `material_pack`). Aucun lieu (`venue`) ni service ne doit être exposé dans Titan.
- **R11. Séquencement contractuel invariant & Clôture :** Signature préalable obligatoire avant enregistrement de versement contractuel (DEC-009 / INV-SEQ-01). Clôture définitive conditionnée à la restitution intégrale du matériel, au règlement de la casse/caution et au solde facturation (DEC-007).
- **R12. Préservation des écrans validés :** L'interface commerciale validée ne doit pas être altérée, masquée ou réduite pour masquer une insuffisance de contrat API.

---

## 2. Relevé des Décisions Arbitrées et Points Restant à Décider (D01 à D06)

| Point | Intitulé | Décision Arbitrée & Cadrage | Points Restant à Préciser / Décider Avant Implémentation | Statut Lot Dérivé |
|---|---|---|---|---|
| **D01** | **Comptable (`accountant`)** | **Accès approuvé :** profils bancaires agence, enregistrement et confirmation des paiements effectivement reçus (sur contrats signés INV-SEQ-01), rapprochement bancaire, facturation (émission, échéances, imputation) et consultation/téléchargement des documents financiers autorisés (`billing_invoice`, `receipt`, `proforma`).<br>**Interdiction absolue :** aucun pouvoir de signature de contrat (`mark_contract_signed`), ni de confirmation commerciale de réservation (`confirm_reservation_draft_service`). | **Points réservés restant à préciser séparément :** Conditions, validations et contrôles existants pour les **avoirs** (`credit-notes`), les **annulations de paiement** (`cancel_payment`) et les **remboursements** (`refund` / `refund-deposit-excess`). Leur validation n'est pas acquise d'office par le droit général de gestion financière. | **Lot A1 cadré pour paiements/factures/banques**.<br>Avoirs/remboursements/annulations réservés pour revue spécifique. |
| **D02** | **Gérant propriétaire (`owner_manager`)** | **Accès approuvé :** gestion des paramètres métier autorisés sans octroi de `is_staff`.<br>**Champs concernés :** délai de validité des contrats (`contract_validity_days`), forfaits de versements de réservation (`deposit_amount`), profils bancaires par défaut pour les documents (`is_default_for_documents`), consultation et compteur de départ des séquences de numérotation.<br>**Invariants protégés :** horaires d'accès veille calculés automatiquement selon l'occupation de la veille (Article 3, DEC-009) et **non librement modifiables**. Protections anti-collision sur séquences de numérotation ; interdiction de modifier rétroactivement les documents signés. | Aucun arbitrage ouvert sur le périmètre métier. | **Lot A5 débloqué pour réglages métier** |
| **D03** | **Support et Signalements de bugs (`BugReport`)** | **Accès approuvé :** tout collaborateur consulte uniquement ses propres signalements (`reporter=request.user`). La vue globale et la mise à jour des statuts sont ouvertes à `owner_manager` et aux administrateurs techniques autorisés (`is_staff` / `is_superuser`).<br>**Règle de séparation :** politique support explicite ; `canManageIdentity` n'accorde pas ce droit automatiquement. | Aucun arbitrage ouvert. | **Lot A4 débloqué pour support** |
| **D04** | **Responsables éligibles de Visite (`VisitAppointment.responsible_id`)** | **Accès approuvé :** remplacement du filtre `is_staff=True` par un sélecteur métier ciblant les utilisateurs actifs détenant un mandat `owner_manager`, `manager`, `reservation_sensitive_operator` ou privilèges techniques autorisés.<br>**Règle de parité :** la même règle fondée sur les droits effectifs s'applique à la liste d'exposition (`VisitResponsibleListAPIView`) et à la validation du serializer (`responsible_id`). Un utilisateur cumulant des rôles reste éligible s'il détient le mandat requis. | Aucun arbitrage ouvert. | **Lot A4 débloqué pour visites** |
| **D05** | **Visibilité des données et montants** | **Comportement confirmé :** maintien du comportement actuel des dossiers partagés (accès authentifié aux totaux et lignes pour travail collaboratif) et préservation stricte des restrictions particulières (pièces privées, données personnelles, caisses, exports). Ce n'est ni une autorisation générale de tout voir sans restriction, ni une interdiction d'ajouter des filtres futurs. | Aucun arbitrage ouvert. | **Périmètre stabilisé** |
| **D06** | **Catalogue des rôles et cumuls** | **Comportement confirmé :** conservation stricte des rôles et capacités actuels sans ajout implicite. Pas de capacité logistique accordée au livreur sans décision spécifique. Cumuls par affectations multiples (`UserRoleAssignment`). | Aucun arbitrage ouvert. | **Périmètre stabilisé** |

---

## 3. Matrice Normative Complète (Vérifiée Sources Réelles)

### Colonnes de la matrice :
1. **Domaine :** Domaine fonctionnel
2. **Route API Réelle :** Chemin effectif dans `urls.py`
3. **Méthode :** Méthode HTTP (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`)
4. **Vue & Service Réels :** Classe de vue DRF et service métier invoqué
5. **Code Actuel :** Contrôle et permissions actuellement en place à la baseline `c0aa4ea`
6. **Cible Proposée :** Habilitation et contrôles conformes au plan
7. **Décision Approuvée :** Source contractuelle (ADR, DEC, D01–D06)
8. **Portée Objet :** Partagée, Personnelle, ou Sécurisée
9. **Attribution & Audit :** Champ modèle (`created_by`/`updated_by`) et événement immuable `record_audit_event_on_commit`
10. **Test de Référence Réel :** Fichier de test existant ou cible

---

### Tableau Détaillé des Domaines Fonctionnels

| Domaine | Route API Réelle | Méthode | Vue & Service Réels | Code Actuel (Baseline) | Cible Proposée | Décision Approuvée | Portée Objet | Attribution & Audit | Test de Référence Réel |
|---|---|---|---|---|---|---|---|---|---|
| **Clients** | `/api/v1/customers/` | `GET` | `CustomerListAPIView`<br>`active_customers()` | `IsAuthenticated` | Inchangé | ADR-011 amendement | Partagée | Non | `tests/backend/test_customer_api.py` |
| **Clients** | `/api/v1/customers/<uuid:pk>/timeline/` | `GET` | `CustomerCommercialTimelineAPIView` | `IsAuthenticated` | Inchangé | ADR-011 amendement | Partagée | Non | `tests/backend/test_customer_api.py` |
| **Clients** | `/api/v1/customers/create/` | `POST` | `CustomerCreateAPIView`<br>`create_customer` | `HasReservationSensitiveAccess` | Inchangé (`canSensitiveWrite`) | ADR-011 / DEC-006 | Partagée | `created_by=request.user`<br>Audit: `customer_created` | `tests/backend/test_customer_api.py` |
| **Clients** | `/api/v1/customers/<uuid:pk>/update/` | `PATCH` | `CustomerUpdateAPIView` | `HasReservationSensitiveAccess` | Inchangé (`canSensitiveWrite`) | ADR-011 / DEC-006 | Partagée | `updated_by=request.user`<br>Audit: `customer_updated` | `tests/backend/test_customer_api.py` |
| **Clients** | `/api/v1/customers/<uuid:pk>/delete/` | `POST` | `CustomerSoftDeleteAPIView` | `HasSuperAdminAccess` (`is_staff=True`) | Inchangé (Staff technique uniquement) | ADR-011 amendement / R04 | Partagée | `updated_by=request.user`<br>Audit: `customer_deleted` | `tests/backend/test_customer_api.py` |
| **Réservations (Brouillons)** | `/api/v1/reservations/drafts/` | `GET` | `ReservationDraftListCreateAPIView` | `IsAuthenticatedReservationDraftBoundary` | Inchangé (Brouillons partagés) | ADR-011 amendement / R01 | Partagée | Non | `tests/backend/test_reservation_api.py` |
| **Réservations (Brouillons)** | `/api/v1/reservations/drafts/` | `POST` | `ReservationDraftListCreateAPIView`<br>`perform_create` | `IsAuthenticatedReservationDraftBoundary` | Inchangé (Création par tout collaborateur) | ADR-011 amendement / R02 | Partagée | `created_by=request.user` | `tests/backend/test_reservation_api.py` |
| **Réservations (Brouillons)** | `/api/v1/reservations/drafts/<uuid:pk>/` | `PATCH` | `ReservationDraftRetrieveAPIView` | `IsAuthenticatedReservationDraftBoundary` | Inchangé (Édition ordinaire partagée) | ADR-011 amendement / R02 | Partagée | `updated_by=request.user` | `tests/backend/test_reservation_api.py` |
| **Réservations (Contrat)** | `/api/v1/reservations/drafts/<uuid:pk>/contract-signed/` | `POST` | `ReservationDraftMarkContractSignedAPIView`<br>`mark_contract_signed` | `HasReservationSensitiveAccess`<br>Vérifie `valid_until >= now()` | Inchangé (`canSensitiveWrite`, refus strict comptable) | DEC-009 / INV-SEQ-01 / D01 | Partagée | `updated_by=request.user`<br>Audit: `reservation.contract_signed` | `tests/backend/test_contract_validity_and_access_rules.py` |
| **Réservations (Versement)** | `/api/v1/reservations/drafts/<uuid:pk>/required-deposit-received/` | `POST` | `ReservationDraftMarkRequiredDepositReceivedAPIView`<br>`mark_required_deposit_received` | `HasReservationSensitiveAccess`<br>Vérifie contrat signé | Inchangé (`canSensitiveWrite`) | DEC-009 / INV-SEQ-01 | Partagée | `updated_by=request.user`<br>Audit: `reservation.deposit_marked` | `tests/backend/test_contract_validity_and_access_rules.py` |
| **Réservations (Confirmation)** | `/api/v1/reservations/drafts/<uuid:pk>/confirm/` | `POST` | `ReservationDraftConfirmAPIView`<br>`confirm_reservation_draft_service` | `HasReservationSensitiveAccess`<br>Verrous + dispo + contrat signé + versement | Inchangé (`canSensitiveWrite`, refus strict comptable) | ADR-004, DEC-005, DEC-006, D01 | Partagée | `confirmed_by=request.user`<br>Audit: `reservation.confirmed` | `tests/backend/test_reservation_confirmation.py` |
| **Réservations (Annulation)** | `/api/v1/reservations/drafts/<uuid:pk>/cancel/` | `POST` | `ReservationDraftCancelAPIView`<br>`cancel_reservation_draft_service` | `HasReservationSensitiveAccess` | Inchangé (`canSensitiveWrite`) | DEC-006 / R03 | Partagée | `cancelled_by=request.user`<br>Audit: `reservation.cancelled` | `tests/backend/test_reservation_confirmation.py` |
| **Réservations (Clôture)** | `/api/v1/reservations/drafts/<uuid:pk>/closeout/execute/` | `POST` | `ReservationDraftCloseoutExecuteAPIView`<br>`execute_reservation_closeout_service` | `HasReservationSensitiveAccess`<br>Vérifie retours 100%, casse soldée, caution soldée, facturation soldée | Inchangé (`canSensitiveWrite`) | DEC-007 / R11 | Partagée | `closed_by=request.user`<br>Audit: `reservation.closed` | `tests/backend/test_reservation_closeout.py` |
| **Assistant (Wizard)** | `/api/v1/reservations/wizard-sessions/` | `GET` / `POST` | `ReservationWizardSessionListCreateAPIView` | `IsAuthenticated`<br>Filtre `created_by=request.user` | Inchangé (Session personnelle isolée) | ADR-011 amendement / R06 | **Personnelle** | `created_by=request.user` | `tests/backend/test_wizard_concurrency.py` |
| **Assistant (Wizard)** | `/api/v1/reservations/wizard-sessions/<uuid:session_id>/draft/` | `POST` | `ReservationWizardDraftCreateAPIView`<br>`promote_wizard_session_to_draft` | `IsAuthenticated`<br>Opérateur de la session | Inchangé (Promotion vers dossier partagé) | ADR-011 amendement / R01 / R06 | Personnelle $\to$ Partagée | `created_by=request.user` | `tests/backend/test_wizard_concurrency.py` |
| **Inventaire** | `/api/v1/inventory/items/` | `GET` | `InventoryItemListAPIView` | `IsAuthenticated`<br>Filtre `is_active=True` | Inchangé (Articles inactifs pour gestion) | ADR-011 amendement | Partagée | Non | `tests/backend/test_inventory_api.py` |
| **Inventaire** | `/api/v1/inventory/items/` | `POST` | `InventoryItemListAPIView` | `HasInventoryManagementAccess` | Inchangé (`canManageInventory`) | ADR-011 amendement | Partagée | `created_by=request.user` | `tests/backend/test_inventory_api.py` |
| **Inventaire (Rangements)** | `/api/v1/inventory/storage-locations/` | `POST` | `InventoryStorageLocationListCreateAPIView`<br>`create_inventory_storage_location` | `HasReservationSensitiveAccess` *(Bloque magasinier à la baseline)* | `HasInventoryManagementAccess` *(Livré en PR #929)* | ADR-011 amendement / R05 / Constat 5 | Partagée | `created_by=request.user` | `tests/backend/test_inventory_storage_location_auth.py` |
| **Inventaire (Mouvements)** | `/api/v1/inventory/stock-movements/` | `POST` | `InventoryStockMovementListCreateAPIView` | `HasLogisticsOperationAccess` | Inchangé (`canOperateLogistics`) | ADR-011 / R05 | Partagée | `actor=request.user` | `tests/backend/test_inventory_api.py` |
| **Logistique (Plannings)** | `/api/v1/logistics/events/` | `GET` | `LogisticsEventListAPIView` | `HasLogisticsOperationAccess` | Inchangé (`canOperateLogistics`) | ADR-011 | Partagée | Non | `tests/backend/test_logistics_api.py` |
| **Logistique (Passation)** | `/api/v1/logistics/events/<uuid:id>/passation/` | `POST` | `LogisticsEventPassationAPIView` | `HasLogisticsOperationAccess` | Inchangé (`canOperateLogistics`) | ADR-011 | Partagée | `actor=request.user`<br>Audit: `logistics.passation` | `tests/backend/test_logistics_api.py` |
| **Logistique (Dérogation)** | `/api/v1/logistics/events/<uuid:id>/override/` | `POST` | `LogisticsOverrideAPIView` | `HasLogisticsOverrideAccess` | Inchangé (`canOverrideLogistics`) | ADR-011 | Partagée | `actor=request.user`<br>Audit: `logistics.override` | `tests/backend/test_logistics_override.py` |
| **Caisse (Sessions)** | `/api/v1/cashbox/sessions/` | `GET` | `CashboxSessionListAPIView`<br>`_sessions_visible_to_actor` | Filtre `operator=actor` sauf si superviseur ou staff | Inchangé (Caisse personnelle / vue superviseur) | ADR-011 amendement / R06 | **Personnelle / Supervisée** | Non | `tests/backend/test_cashbox_api.py` |
| **Caisse (Ouverture)** | `/api/v1/cashbox/sessions/open/` | `POST` | `CashboxSessionOpenAPIView`<br>`open_cashbox_session` | `HasCashboxOperationAccess` | Rejet `actor=None`, contrôle persistant acteur actif *(Livré en PR #929)* | ADR-011 | Personnelle | `operator=request.user`<br>Audit: `cashbox.opened` | `tests/backend/test_cashbox_auth_guard.py` |
| **Caisse (Mouvement)** | `/api/v1/cashbox/sessions/<uuid:id>/movements/` | `POST` | `CashboxMovementCreateAPIView`<br>`record_cashbox_movement` | Vue vérifie session visible ; service ne vérifiait pas `actor` | Renforcement service sous verrou de session : rechargement acteur actif en base, contrôle continu de capacité opérateur et superviseur *(Livré en PR #929)* | ADR-011 / Constat 8 | Personnelle | `actor=request.user` | `tests/backend/test_cashbox_auth_guard.py` |
| **Caisse (Comptage)** | `/api/v1/cashbox/sessions/<uuid:id>/submit-count/` | `POST` | `CashboxSessionCountSubmitAPIView`<br>`submit_cashbox_count` | Vue vérifie session visible ; service ne vérifiait pas `actor` | Renforcement service sous verrou de session : rechargement acteur actif en base, contrôle continu de capacité opérateur et superviseur *(Livré en PR #929)* | ADR-011 / Constat 8 | Personnelle | `actor=request.user` | `tests/backend/test_cashbox_auth_guard.py` |
| **Caisse (Validation)** | `/api/v1/cashbox/sessions/<uuid:id>/validate-count/` | `POST` | `CashboxSessionCountValidateAPIView`<br>`validate_cashbox_count` | `require_cashbox_supervisor_actor` dans service | Contrôle acteur persistant actif *(Livré en PR #929)* | ADR-011 / R06 | Supervisée | `supervisor=request.user`<br>Audit: `cashbox.validated` | `tests/backend/test_cashbox_auth_guard.py` |
| **Caisse (Réouverture)** | `/api/v1/cashbox/sessions/<uuid:id>/reopen/` | `POST` | `CashboxSessionReopenAPIView`<br>`reopen_cashbox_session` | `require_cashbox_supervisor_actor` dans service | Contrôle acteur persistant actif *(Livré en PR #929)* | ADR-011 | Supervisée | `supervisor=request.user`<br>Audit: `cashbox.reopened` | `tests/backend/test_cashbox_auth_guard.py` |
| **Finance (Banques)** | `/api/v1/finance/banks/` | `GET` / `POST` / `PATCH` | `FinanceBankProfileListCreateAPIView`<br>`FinanceBankProfileUpdateAPIView` | `HasReservationSensitiveAccess` *(Bloque comptable)* | `HasFinancialOperationAccess` (`canSensitiveWrite` OU `canManageFinance`, préservant gérant/manager et ouvrant comptable) *(Lot A1)* | D01 approuvé / Constat 1 | Partagée | `updated_by=request.user`<br>Audit bancaire | `tests/backend/test_finance_api.py` |
| **Finance (Journaux)** | Service interne | N/A | `record_financial_journal_entry` | `require_reservation_sensitive_actor` | Consultation des services existants approuvée ; écritures réservées pending arbitrage spécifique (aucun nouvel endpoint/workflow) | D01 réservé | Partagée | `actor=request.user` | `tests/backend/test_finance_api.py` |
| **Finance (Transferts)** | Service interne | N/A | `record_financial_transfer` | `require_reservation_sensitive_actor` | Consultation des services existants approuvée ; écritures réservées pending arbitrage spécifique (aucun nouvel endpoint/workflow) | D01 réservé | Partagée | `actor=request.user` | `tests/backend/test_finance_api.py` |
| **Paiements (Enregistrement)** | `/api/v1/payments/` | `POST` | `PaymentListCreateAPIView` | `HasReservationSensitiveAccess` *(Bloque comptable)* | `HasFinancialOperationAccess` (`canSensitiveWrite` OU `canManageFinance`, préservant gérant/manager et ouvrant comptable) *(Lot A1)* | D01 approuvé / INV-SEQ-01 | Partagée | `created_by=request.user`<br>Audit: `payment.created` | `tests/backend/test_payment_api.py` |
| **Paiements (Confirmation)** | `/api/v1/payments/<uuid:id>/confirm/` | `POST` | `PaymentConfirmAPIView` | `HasReservationSensitiveAccess` *(Bloque comptable)* | `HasFinancialOperationAccess` (`canSensitiveWrite` OU `canManageFinance`) *(Lot A1)* | D01 approuvé | Partagée | `confirmed_by=request.user`<br>Audit: `payment.confirmed` | `tests/backend/test_payment_api.py` |
| **Paiements (Acompte atomique)** | `/api/v1/payments/deposits/record/` | `POST` | `DepositRecordingAPIView` | `HasReservationSensitiveAccess` *(Bloque comptable)* | `HasFinancialOperationAccess` (`canSensitiveWrite` OU `canManageFinance`, signature contrat requise) *(Lot A1)* | D01 approuvé / DEC-009 | Partagée | `created_by=request.user`<br>Audit: `deposit.recorded` | `tests/backend/test_payment_api.py` |
| **Paiements (Rapprochement direct)** | `/api/v1/payments/<uuid:id>/reconcile/` | `POST` | `PaymentReconcileAPIView` | `HasReservationSensitiveAccess` *(Bloque comptable)* | `HasFinancialOperationAccess` (`canSensitiveWrite` OU `canManageFinance`) *(Lot A1)* | D01 approuvé | Partagée | Non | `tests/backend/test_payment_api.py` |
| **Paiements (Rapprochement CSV)** | `/api/v1/payments/reconciliation/imports/csv/`<br>`/api/v1/payments/reconciliation/imports/<uuid:id>/commit/` | `POST` | `PaymentReconciliationCsvPreviewAPIView`<br>`PaymentReconciliationImportCommitAPIView` | `HasReservationSensitiveAccess` *(Bloque comptable)* | `HasFinancialOperationAccess` (`canSensitiveWrite` OU `canManageFinance`) *(Lot A1)* | D01 approuvé | Partagée | `imported_by=request.user`<br>Audit: `reconciliation.committed` | `tests/backend/test_payment_api.py` |
| **Paiements (Rappel WhatsApp)** | `/api/v1/payments/reminder/whatsapp/` | `GET` | `PaymentReminderWhatsAppAPIView` | `HasReservationSensitiveAccess` *(Bloque comptable)* | `HasFinancialOperationAccess` (`canSensitiveWrite` OU `canManageFinance`) *(Lot A1)* | D01 approuvé | Partagée | Non | `tests/backend/test_payment_api.py` |
| **Paiements (Annulation)** | `/api/v1/payments/<uuid:id>/cancel/` | `POST` | `PaymentCancelAPIView` | `HasReservationSensitiveAccess` | Maintenu sensible jusqu'à décision spécifique | D01 point réservé | Partagée | `cancelled_by=request.user`<br>Audit: `payment.cancelled` | `tests/backend/test_payment_api.py` |
| **Paiements (Remboursement)** | `/api/v1/payments/refund/`<br>`/api/v1/payments/<uuid:id>/refund-confirm/` | `POST` | `RefundPaymentCreateAPIView`<br>`RefundPaymentConfirmAPIView` | `HasReservationSensitiveAccess` | Maintenu sensible jusqu'à décision spécifique | D01 point réservé | Partagée | `refunded_by=request.user`<br>Audit: `payment.refunded` | `tests/backend/test_payment_api.py` |
| **Facturation (Invoices)** | `/api/v1/billing/invoices/`<br>`/api/v1/billing/invoices/<uuid:id>/` | `GET` | `BillingInvoiceListAPIView`<br>`BillingInvoiceRetrieveAPIView` | `IsAuthenticatedBillingBoundary` | Déjà conforme (ouvert à tout collaborateur authentifié) | ADR-011 amendement / D01 | Partagée | Non | `tests/backend/test_billing_api.py` |
| **Facturation (Règlement)** | `/api/v1/billing/invoices/<uuid:id>/settle/` | `POST` | `BillingInvoiceSettleAPIView` | `HasReservationSensitiveAccess` *(Bloque comptable)* | `HasFinancialOperationAccess` (`canSensitiveWrite` OU `canManageFinance`) *(Lot A1)* | D01 approuvé | Partagée | `settled_by=request.user`<br>Audit: `invoice.settled` | `tests/backend/test_billing_api.py` |
| **Facturation (Échéances)** | `/api/v1/billing/invoices/<uuid:id>/installments/` | `POST` | `BillingInvoiceInstallmentCreateAPIView` | `HasReservationSensitiveAccess` *(Bloque comptable)* | `HasFinancialOperationAccess` (`canSensitiveWrite` OU `canManageFinance`) *(Lot A1)* | D01 approuvé | Partagée | `created_by=request.user` | `tests/backend/test_billing_api.py` |
| **Facturation (Imputation)** | `/api/v1/billing/installments/<uuid:id>/allocate/` | `POST` | `BillingInstallmentAllocateAPIView` | `HasReservationSensitiveAccess` *(Bloque comptable)* | `HasFinancialOperationAccess` (`canSensitiveWrite` OU `canManageFinance`) *(Lot A1)* | D01 approuvé | Partagée | `allocated_by=request.user` | `tests/backend/test_billing_api.py` |
| **Facturation (Avoirs)** | `/api/v1/billing/invoices/<uuid:id>/credit-notes/` | `POST` | `BillingCreditNoteListCreateAPIView` | `HasReservationSensitiveAccess` | Maintenu sensible jusqu'à décision spécifique | D01 point réservé | Partagée | `created_by=request.user`<br>Audit: `credit_note.issued` | `tests/backend/test_billing_api.py` |
| **Facturation (Annulation)** | `/api/v1/billing/invoices/<uuid:id>/cancel/` | `POST` | `BillingInvoiceCancelAPIView` | `HasReservationSensitiveAccess` | Maintenu sensible jusqu'à décision spécifique | D01 point réservé | Partagée | `cancelled_by=request.user`<br>Audit: `invoice.cancelled` | `tests/backend/test_billing_api.py` |
| **Documents (Instances Privées)** | `/api/v1/documents/instances/<uuid:id>/artifact/`<br>`/api/v1/documents/instances/<uuid:id>/pdf/` | `GET` | `DocumentInstancePrivateArtifactAPIView`<br>`DocumentInstancePDFRetrieveAPIView` | Vue exige `HasLogisticsOperationAccess` *(Bloque comptable sur factures/reçus)* | Politique unifiée par catégorie :<br>- Logistique : `canOperateLogistics`<br>- Financier : `canManageFinance`<br>- Gérant/Manager : plein accès *(Lot A2)* | R09 / D01 approuvé / Constat 7 | Catégorie autorisée | Non | `tests/backend/test_documents.py` |
| **Rapports (Données & Exports)** | `/api/v1/reports/<str:category>/`<br>`/api/v1/reports/exports/<str:export_type>/` | `GET` | `ReportDataAPIView`<br>`SalesJournalExportAPIView` etc. | Backend filtre catégories par rôle (`common/reports.py`) ; UI bloque sur `canSensitiveWrite` | Backend OK. Cible : exposer `reportCategories` dans la session et adapter l'UI *(Lot A5 / B1 / B2)* | D01 approuvé / Constat 2 | Catégories autorisées | Audit export CSV: `report.exported` | `tests/backend/test_reports.py` |
| **Visites (Responsables)** | `/api/v1/visits/responsibles/` | `GET` | `VisitResponsibleListAPIView` | Filtre `is_staff=True` *(Exclut gérant et manager non-staff)* | Sélecteur métier : actifs avec `owner_manager`, `manager`, `reservation_sensitive_operator` ou privilèges techniques *(Lot A4)* | D04 approuvé / Constat 3 | Partagée | Non | `tests/backend/test_visits.py` |
| **Support (Signalements)** | `/api/v1/notifications/bug-reports/` | `GET` | `BugReportListCreateAPIView` | Filtre `reporter=user` sauf si `is_staff`/`is_superuser` | Ouvrir vue globale à `owner_manager` en plus de `is_staff` *(Lot A4)* | D03 approuvé / Constat 4 | Supervisée | Non | `tests/backend/test_bug_reports.py` |
| **Support (Statut Ticket)** | `/api/v1/notifications/bug-reports/<uuid:id>/status/` | `PATCH` | `BugReportStatusAPIView` | Exige `is_staff`/`is_superuser` | Ouvrir mise à jour à `owner_manager` en plus de `is_staff` *(Lot A4)* | D03 approuvé / Constat 4 | Supervisée | `updated_by=request.user` | `tests/backend/test_bug_reports.py` |
| **Paramètres (Conditions Hahitantsoa)** | `/api/v1/hahitantsoa/commercial-terms/` | `PATCH` | `HahitantsoaCommercialTermsAPIView` | `HasSuperAdminAccess` (`is_staff=True`) | Ouvrir à `owner_manager` pour paramètres métier (`contract_validity_days`, `deposit_amount`) *(Lot A5)* | D02 approuvé / Constat 39 | Partagée | `updated_by=request.user` | `tests/backend/test_commercial_terms.py` |
| **Paramètres (Numérotation)** | `/api/v1/numbering/sequences/` | `POST` | `NumberingSequenceListConfigureAPIView` | `HasIdentityAdminAccess` (`canManageIdentity`) | Inchangé (`owner_manager`, `identity_admin`, staff) ; protections anti-collision conservées | D02 approuvé / DEC-008 | Sécurisée | `configured_by=request.user`<br>Audit: `numbering.configured` | `tests/backend/test_numbering_standards.py` |
| **Authentification (Session)** | `/api/v1/auth/session/` | `GET` | `SessionStateAPIView` | Renvoie `user`, `roles`, `capabilities` booléennes | Extension cible : ajouter `reportCategories: list[str]` dérivé de `categories_for_user_roles(user)` *(Lot A5 / B1)* | Contrat technique stabilisé | N/A | Non | `tests/backend/test_auth_session.py` |

---

## 4. Précision sur les Extensions Cibles et Identifiants

### 4.1 Endpoint de Session Réel et Extension Cible
Le véritable endpoint de session est :  
`GET /api/v1/auth/session/` (et non `/api/v1/identity/session/`).

La structure actuelle renvoie :
```json
{
  "authenticated": true,
  "user": {
    "id": "1",
    "username": "comptable",
    "display_name": "Ando Comptable",
    "is_staff": false,
    "roles": ["accountant"],
    "capabilities": {
      "canActivatePayroll": true,
      "canEditPayroll": false,
      "canManageFinance": true,
      "canManageIdentity": false,
      "canManageInventory": false,
      "canOperateCashbox": false,
      "canOperateLogistics": false,
      "canOverrideLogistics": false,
      "canSensitiveWrite": false,
      "canSuperAdminDelete": false,
      "canSuperviseCashbox": false,
      "canViewAudit": false,
      "canViewPayroll": true
    }
  }
}
```

**Extension cible à implémenter (Lot A5 / B1) :**  
Ajouter le champ `reportCategories` sous `user` :
```json
"reportCategories": ["sales_billing", "payments"]
```
Les identifiants canoniques de catégories (définis dans `apps.common.reports.ReportCategory`) sont strictement :
- `"reservations"`
- `"sales_billing"`
- `"payments"`
- `"prospects"`
- `"logistics"`
- `"inventory"`
- `"documents"`

---

## 5. Synthèse des Conditions Métier Clés et Séparation des Pouvoirs

1. **Conditions de clôture d'un contrat (R11 / DEC-007) :**
   La clôture définitive (`execute_reservation_closeout_service`) impose le recontrôle transactionnel strict de 4 invariants :
   - Tous les articles loués sont restitués (`returns_complete == True`).
   - Toutes les anomalies de casse/perte constatées ont été arbitrées et soldées financièrement (`damage_settled == True`).
   - Les dépôts de garantie / cautions ont été intégralement restitués ou affectés (`caution_cleared == True`).
   - La facturation du dossier est soldée (`billing_settled == True`).
   Aucune exception de clôture partielle n'est admise.

2. **Conditions et exceptions de supervision de caisse (R06 / Constat 8) :**
   - Un caissier / opérateur ordinaire ne voit et ne manipule que sa propre session (`session.operator == request.user`).
   - Le superviseur (`canSuperviseCashbox`) peut superviser toutes les caisses, valider les comptages et réouvrir exceptionnellement des caisses.
   - **Exception de contrôle interne :** Un superviseur ne peut jamais valider son propre comptage s'il est lui-même l'opérateur de la session de caisse (`session.operator != request.user`).

3. **Distinction Attribution (`created_by`) vs Audit immuable :**
   - `created_by` / `updated_by` : Attribution nominative persistée sur l'objet métier. Ne constitue pas un verrou de propriété exclusive.
   - `record_audit_event_on_commit` : Événement immuable en base de données, déclenché uniquement sur confirmation transactionnelle (succès non réversible par rollback) pour garantir l'historique légal des opérations sensibles.

4. **Distinction `is_staff` vs `is_superuser` :**
   - `is_staff` : Accès technique à Django Admin (`/admin/`), purge de données de test (`canSuperAdminDelete`).
   - `is_superuser` : Privilège absolu de plateforme. Aucun rôle d'entreprise (`owner_manager`, `manager`, etc.) n'attribue `is_staff` ou `is_superuser`.

5. **Statut et limites strictes du Livreur (`delivery_driver` / R05 / D06) :**
   - Le rôle livreur n'a aucune capacité d'administration, de modification de catalogue, de gestion des stocks (`canManageInventory`), ni de gestion logistique générale (`canOperateLogistics`).
   - Il dispose uniquement des accès d'exécution de livraison nécessaires à ses missions, sans attribution implicite de rôle ni extension de périmètre.

6. **Préservation des droits existants (non-régression commerciale D01) :**
   - L'ouverture des fonctions financières au comptable (`canManageFinance`) ne remplace pas mécaniquement les droits commerciaux existants.
   - Les opérateurs commerciaux détenant `canSensitiveWrite` (gérants, managers, opérateurs sensibles) conservent l'intégralité de leurs droits opérationnels sur les règlements, la facturation et les profils bancaires.
   - Les contrôles combinent formellement `canSensitiveWrite OR canManageFinance` via la politique `HasFinancialOperationAccess`.
