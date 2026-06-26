# F180D4 — End-to-end / manual workflow validation report

> **Version:** F180D4 — 2026-06-26
> **HEAD de validation:** `a338ad0` (main after D3 merge)
> **Validation type:** Code inspection + documentation audit (E2E browser tests non disponibles dans l'environnement WSL courant)

---

## 1. Stratégie de validation

### Pourquoi pas d'E2E automatisé ?

Le dépôt ne contient **aucun outillage E2E existant** :

- `tests/e2e/` est un répertoire vide (`.gitkeep`)
- Aucune configuration Playwright, Cypress, Puppeteer ou Selenium n'existe
- Le seul test dit "E2E" est un test back-end pytest (`test_titan_e2e_operational_acceptance.py`)
- Les tests frontend utilisent Vitest + jsdom (tests composants, pas browser)
- `package.json` ne déclare aucune dépendance E2E

Ajouter Playwright nécessiterait :
1. Installation et configuration du package
2. Configuration CI dédiée
3. Serveur de développement frontend + backend opérationnel en CI
4. Fixtures de données E2E

**Décision :** Rapport de validation manuelle (code inspection + documentation audit). C'est l'approche la plus sobre, alignée avec la règle Ponytail (étape 6 : écrire la plus petite implémentation robuste — ici, un rapport suffit).

### Méthode

- Inspection du code frontend (24 panneaux React + App.tsx + API client)
- Inspection du code backend (endpoints, services, models)
- Audit de la documentation (cartographie, design, guide testeur)
- Vérification de la couverture des workflows utilisateur
- Classification des écarts

---

## 2. Workflows validés

### 2.1 Login avec utilisateurs dev/admin

| Élément | Statut | Preuve |
|---------|--------|--------|
| LoginPanel.tsx | **Connecté** | `login()` POST /api-auth/login/, `checkAuth()` GET /items |
| AuthContext.tsx | **Connecté** | Session Django, gère loading/unauthenticated/authenticated |
| seed_dev_user (dev/dev) | **Livré** | D3, `seed_all_demo` l'inclut |
| seed_dev_admin (admin/admin) | **Livré** | D3, commande séparée |
| Déconnexion | **Connecté** | `logout()` GET /api-auth/logout/ |

**Gaps :** Aucun.

### 2.2 Seed demo depuis un état propre

| Étape | Statut | Preuve |
|-------|--------|--------|
| docker compose up -d db redis | **Documenté** | `LOCAL_TESTER_GUIDE.md` |
| migrate | **Documenté** | `LOCAL_TESTER_GUIDE.md` |
| seed_all_demo | **Livré** | D3 — 6 seeds en ordre de dépendance |
| seed_dev_admin (optionnel) | **Livré** | D3 |
| npm run dev | **Documenté** | `LOCAL_TESTER_GUIDE.md` |

**Gaps :** Aucun.

### 2.3 Titan workflow

| Sous-workflow | Frontend | API | Statut |
|---|---|---|---|
| Sélection client | `CustomerPanel.tsx` | customers CRUD | **Connecté** |
| Inspection brouillons/réservations | `AvailabilityPanel.tsx` | GET /drafts/ | **Connecté** |
| Création brouillon | `AvailabilityPanel.tsx` | POST /drafts/ | **Connecté** |
| Disponibilité/planning | `AvailabilityPanel.tsx` + `PlanningPanel.tsx` | availability-summary, available-item-previews | **Connecté** |
| Documents (proforma, contrat, facture) | `TitanDocumentsPanel.tsx` | documents instances + generate + PDF | **Connecté** |
| Contrat signé | `AvailabilityPanel.tsx` | POST /drafts/{id}/contract-signed/ | **Connecté** |
| Dépôt reçu | `AvailabilityPanel.tsx` | POST /drafts/{id}/required-deposit-received/ | **Connecté** |
| Confirmation Titan | API endpoint existe, UI partielle | POST /drafts/{id}/confirm/ | **Partiel** (pas de vue dédiée) |
| Facture | `BillingInvoicePanel.tsx` | billing invoices CRUD | **Connecté** |
| Paiement | `PaymentWorkflowPanel.tsx` | payments create/confirm | **Connecté** |
| Logistique | `LogisticsDeliveryPanel.tsx` | logistics events, transitions, passation | **Connecté** |
| Retour | `ReturnsHandlingPanel.tsx` | return operations validate | **Connecté** |
| Casse/perte | `BreakageLossPanel.tsx` | damage/loss settlements validate | **Connecté** |
| Audit | `AuditPanel.tsx` | audit events list/detail | **Connecté** |

**Gaps :**
- Pas d'écran `reservation detail` dédié (gap post-FE-K)
- Pas de `new reservation wizard` (gap post-FE-K)
- UI de confirmation Titan reste intégrée dans AvailabilityPanel, pas d'étape dédiée

### 2.4 Hahitantsoa workflow

| Sous-workflow | Frontend | API | Statut |
|---|---|---|---|
| Découverte événements | `HahitantsoaDiscoveryPanel.tsx` | GET /discovery-items/ | **Connecté** |
| CRUD brouillons événement | `HahitantsoaEventDraftsPanel.tsx` | event-drafts CRUD | **Connecté** |
| Détail événement | `HahitantsoaEventDraftsPanel.tsx` | GET /event-drafts/{id}/ | **Connecté** |
| Disponibilité | `HahitantsoaEventDraftsPanel.tsx` | availability-preview | **Connecté** |
| Confirmation | `HahitantsoaEventDraftsPanel.tsx` | confirmation-preflight, confirm | **Connecté** (avec étape "Confirmé") |
| Avenants | `HahitantsoaEventDraftsPanel.tsx` | amendment-requests CRUD + lines | **Connecté** |
| Documents | `HahitantsoaDocumentsPanel.tsx` | documents instances + generate + PDF | **Connecté** |
| Facturation/paiement/logistique | Liens vers `Commercial Ops` | billing, payments, logistics | **Connecté** (via onglets) |

**Gaps :**
- Certaines étapes bloquées ou partielles documentées clairement ci-dessous
- Pas de vue kanban logistique Hahitantsoa dédiée (utilise le panneau générique)

### 2.5 Planning hebdomadaire

| Fonctionnalité | Statut |
|---|---|
| Tableau hebdomadaire avec réservations Titan | **Connecté** (PlanningPanel.tsx) |
| Tableau hebdomadaire avec événements Hahitantsoa | **Connecté** |
| Filtres Titan/HAH/Tous | **Connecté** |
| Navigation semaine précédente/suivante | **Connecté** |
| Scope tags, durée, nombre de ressources | **Connecté** (livré dans D1) |
| Vue mensuelle/agenda | **Non implémenté** (futur) |

### 2.6 Fiche client et opérations commerciales liées

| Fonctionnalité | Statut |
|---|---|
| Liste clients, recherche | **Connecté** |
| Création, modification, suppression client | **Connecté** |
| Détail client | **Partiel** (enrichissement attendu) |
| Commercial Ops (onglets) | **Connecté** |
| Documents liés | **Connecté** |
| Paiements liés | **Connecté** |
| Facturation liée | **Connecté** |
| Logistique liée | **Connecté** |

### 2.7 Dashboard / Audit / Identity

| Fonctionnalité | Statut |
|---|---|
| Dashboard (4 métriques, quick links) | **Connecté** |
| Audit (log avec filtres) | **Connecté** |
| Identity (rôles + assignations lecture) | **Partiel** (écriture admin partielle) |
| Cahier de caisse (sessions + mouvements) | **Connecté** |
| Caution / remboursements | **Connecté** |

### 2.8 Thème, responsive, états

| Fonctionnalité | Statut |
|---|---|
| Light/dark/system theme | **Connecté** (ThemeContext + CSS variables) |
| Responsive sidebar | **Connecté** (CSS media queries) |
| États loading | **Présents** sur tous les panneaux data-fetching |
| États error | **Présents** |
| États empty | **Présents** |
| États denied/read-only | **Présents** (permission gating) |

---

## 3. Corrections appliquées dans ce bundle

### 3.1 Stale planning references (8 fichiers)

| Fichier | Correction |
|---|---|
| `frontend/src/App.tsx` | `eyebrow:` "Prototype placeholder" → "Weekly planning"; `badge:` "Future" → "Weekly planner"; `boundaryNote:` mis à jour |
| `frontend/src/FutureWorkspacePanel.tsx` | Entrée `planning` supprimée du `PANEL_CONTENT` et du type `FutureScope` |
| `docs/architecture/application-map/FRONTEND_MAP.md` | Planning: `FutureWorkspacePanel` placeholder → `PlanningPanel` current |
| `docs/architecture/application-map/API_AND_DATA_FLOW_MAP.md` | Planning: "intentional placeholder" → "connected via PlanningPanel" |
| `docs/architecture/application-map/NAVIGATION_TREE_TARGET.md` | Planning: "placeholder" → "current (weekly table)"; gaps mis à jour |
| `docs/design/FRONTEND_PROTOTYPE_GAP_ANALYSIS.md` | Planning: "placeholder/not implemented" → "current (weekly table)/partial" |
| `docs/design/FRONTEND_MIGRATION_ROADMAP_FROM_PROTOTYPE.md` | FE-L marqué comme livré (F180D1) au lieu de "à faire" |
| `docs/ai-agents/orchestrator-task-queue.md` | D3→merged, D4→active; HEAD SHA mis à jour |

### 3.2 Bug fix backport (D3)

Le bug `seed_demo_hahitantsoa_event_drafts` (nom de champ `hahitantsoa_event_draft` → `event_draft`) a été corrigé dans D3. Il n'a pas été ré-ouvert dans D4.

---

## 4. Classification des écarts restants

| Écart | Classification |
|---|---|
| Pas d'écran `reservation detail` dédié | (6) post-MVP/future scope — FE-K |
| Pas de `new reservation wizard` | (6) post-MVP/future scope — FE-K |
| UI confirmation Titan partielle | (2) small follow-up frontend polish |
| Calendrier enrichi (mois/agenda) | (6) post-MVP/future scope |
| Fiche client à enrichir | (6) post-MVP/future scope — FE-M |
| Identity write admin partiel | (6) post-MVP/future scope — FE-N |
| Reports/exports | (5) business/legal decision — D2 blocked |
| Planning, catalog, procurement, HR, help | (4) intentional placeholders |

---

## 5. Estimation de complétude

| Domaine | Estimation |
|---|---|
| Backend | ~95%+ (gelé depuis F175A) |
| Frontend (workflows connectés) | ~85% |
| Documentation (cartographie + design) | ~90% (après corrections D4) |
| Tests (backend) | 1465 tests pass |
| Tests (frontend) | 246 tests pass |
| **Global** | **~88%** |

---

## 6. Procédure de validation manuelle

Pour exécuter la validation manuelle complète :

1. Démarrer l'environnement (voir `docs/testing/LOCAL_TESTER_GUIDE.md`)
2. Exécuter `seed_all_demo`
3. Suivre les scénarios A à F du guide testeur
4. Vérifier que chaque workflow aboutit sans erreur 500
5. Vérifier les états loading → données → empty sur chaque panneau
6. Tester light/dark theme
7. Tester responsive (mobile/tablet/desktop)
8. Documenter tout écart non classifié

---

## 7. Prochain bundle recommandé

**F180D5 — Fidelity / responsive / accessibility polish**

- Amélioration visuelle des panneaux existants
- Tests de contraste et accessibilité
- Cohérence prototype
- Préparation pour la mise en production pilote
