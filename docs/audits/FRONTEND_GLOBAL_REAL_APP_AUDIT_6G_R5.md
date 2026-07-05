# FRONTEND_GLOBAL_REAL_APP_AUDIT_6G_R5

## 1. Résumé exécutif
- **Verdict global** : Le frontend actuel repose désormais de bout en bout sur l'architecture issue du prototype R1-R6. L'intégration de la nouvelle UI/UX est massivement accomplie, couvrant l'ensemble des modules clés (Clients, Réservations, Inventaire, Logistique, Caisse). 
- **Niveau de maturité frontend estimé** : Élevé sur le plan UX/UI (tous les écrans opérationnels sont conçus, structurés et validés visuellement), mais **Moyen/Faible** sur le plan de l'intégration data, car la grande majorité des composants reposent sur des données simulées (`mockData.ts`) et un état local volatil, en attendant le dégel de l'API backend.
- **Risques majeurs** : 
  - La déconnexion prolongée avec le backend réel risque de rendre la transition douloureuse ("Big Bang" d'intégration API).
  - De nombreuses actions (ex: "Créer", "Confirmer", "Payer") ne déclenchent que des Toast notifications sans mutation persistante.
- **Prochaine mission recommandée** : Poursuivre la feuille de route vers **FE-M — Enriched client file and cross-linked commercial history** ou amorcer une mission de dé-mocking granulaire (reconnecter l'API existante aux nouveaux écrans là où le contrat d'API le permet).

## 2. Sources et documents consultés
- `docs/design/DESIGN.md` (règles canoniques UI/UX)
- `docs/audits/FRONTEND_MOCK_USER_JOURNEY_FINAL_AUDIT_R0C.md`
- `docs/design/FRONTEND_PROTOTYPE_PARITY_R0B_REAL_FRONTEND_AUDIT.md`
- `docs/design/FRONTEND_MIGRATION_ROADMAP_FROM_PROTOTYPE.md`
- Fichiers source du frontend : `App.tsx`, composants dans `frontend/src/prototype/*.tsx`
- **Limites** : Audit statique. L'évaluation des boutons "MOCK" est déduite de l'analyse du code (`onNavigate`, `showToast`, et mutations locales non persistées). Le backend réel et les schémas de BDD n'ont pas été inspectés.

## 3. Cartographie des routes frontend

| Route | Page / Composant | Statut | Données | Boutons principaux | Priorité de correction |
|---|---|---|---|---|---|
| `#dashboard` | `DashboardPage` | OK | MOCK | Voir KPI, Accès rapides | P3 |
| `#customers` | `CustomersPage` | OK | MOCK | Nouveau Client/Prospect | P3 |
| `#customer/*` | `CustomerDetailPage` | OK | MOCK | Convertir en Client, Modifier, Proforma | P2 |
| `#reservations` | `ReservationsPage` | OK | MOCK | Nouvelle Réservation, Filtrer | P3 |
| `#reservation-new` | `ReservationNewPage` | OK | MOCK | Suivant (Wizard 3 étapes), Sauvegarder | P3 |
| `#reservation-detail`| `ReservationDetailPage` | OK | MOCK | Confirmer, Ajouter Paiement, Contrat | P2 |
| `#hahitantsoa` | `HahitantsoaPage` | OK | MOCK | Créer événement, Devis | P3 |
| `#titan` | `TitanPage` | OK | MOCK | Louer matériel | P3 |
| `#inventory` | `InventoryPage` | OK | MOCK | Sélection Multiple, Filtrer, Ajouter | P3 |
| `#inventory-management`| `InventoryManagementPage`| OK | MOCK | Sync, Actions par lot | P3 |
| `#inventory-item/*` | `InventoryItemPage` | OK | MOCK | Upload Image (Local), Modifier stock | P3 |
| `#packages` | `PackageBuilderPage` | OK | MOCK | Créer Pack, Upload Image, Ajouter Art. | P3 |
| `#stock-preparation` | `StockPreparationPage`| OK | MOCK | Mettre au max, Marquer comme Prêt | P3 |
| `#logistics-dispatch`| `LogisticsDispatchPage`| OK | MOCK | Assigner véhicule, Marquer en livraison| P3 |
| `#logistics-returns` | `LogisticsReturnsPage`| OK | MOCK | Confirmer retour complet/partiel | P3 |
| `#breakage-loss` | `BreakageLossPage` | OK | MOCK | Imputer casse au client, Classer perte | P3 |
| `#commercial-ops` | `CommercialOpsPage` | OK | MOCK | Afficher Facture, Relancer | P3 |
| `#cashbox` | `CashboxPage` | OK | MOCK | Nouvelle session, Clôturer | P3 |
| `#planning` | `PlanningPage` | OK | MOCK | Mois/Semaine, Nouveau RDV | P3 |
| `#reports` | `ReportsPage` | OK | MOCK | Exporter Excel/PDF | P2 |
| `#admin` | `PlaceholderPage` | PLACEHOLDER | N/A | Retour | P1 |
| `#agenda-visitors` | `PlaceholderPage` | PLACEHOLDER | N/A | Retour | P1 |
| `#documents` | `PlaceholderPage` | PLACEHOLDER | N/A | Retour | P2 |
| `#hr-payroll` | `PlaceholderPage` | PLACEHOLDER | N/A | Retour | P3 |

## 4. Audit page par page

- **#customers & #customer/*** :
  - *Objectif* : Gérer le cycle de vie CRM (Prospects vs Clients).
  - *État* : UX très aboutie. Filtres efficaces. Assistant de conversion bloquant.
  - *Boutons OK* : Navigation, Onglets.
  - *Boutons mock* : "Créer Proforma", "Confirmer acompte" (mise à jour état local sans API).
  - *Incohérences* : L'historique des réservations est en dur, la modification de fiche ne persiste pas en BDD.
  - *Recommandation* : Cibler l'enrichissement croisé (FE-M) et le dé-mocking dès que possible.

- **#reservation-new & #reservation-detail** :
  - *Objectif* : Wizard de création et gestion de la confirmation / paiements.
  - *État* : Très robuste. Séparation Titre/Usage/Lieu.
  - *Boutons OK* : Steps du Wizard, Ajout au panier, Navigation.
  - *Boutons mock* : "Sauvegarder Brouillon", "Confirmer".
  - *Tests existants* : Couverture Vitest/RTL forte.
  - *Recommandation* : L'UI est prête. En attente de l'API.

- **Catalogue / Inventaire / Packs** :
  - *Objectif* : Gérer les articles louables et les packs composites.
  - *État* : UX affinée (Sélection multiple, grilles adaptatives, upload local sans backend). Noms complets des packs gérés.
  - *Boutons OK* : Changement de vue, sélection, upload image locale (`createObjectURL`).
  - *Boutons mock* : "Sauvegarder" modifie `mockData`, pas l'API.

- **Logistique (Préparation, Sortie, Retour, Casse)** :
  - *Objectif* : Suivi physique du stock lié aux réservations.
  - *État* : Complet visuellement.
  - *Boutons OK* : Filtres de statut.
  - *Boutons mock* : "Mettre au max", "Marquer comme prêt", "Confirmer retour". L'application affiche un toast mais ne synchronise pas le backend.

## 5. Audit des workflows métier

- **Client / Prospect** : Conforme au modèle de conversion strict validé (Acompte requis pour passer Client).
- **Hahitantsoa vs Titan** : Frontières respectées. Titan est pure location (matériel, pas de "salle" ou "service"). Hahitantsoa propose l'écosystème événementiel (lieux, traiteur).
- **Catalogue / Inventaire / Packs** : L'inventaire (opérationnel) et le catalogue (commercial) sont désormais bien distingués. Les images s'ajoutent en RAM avec fallback.
- **Logistique** : Flux complet matérialisé par des panneaux dédiés (Prépa -> Sortie -> Retour -> Dégradations).
- **Finance** : Facturation, proforma et caisse sont présents en lecture seule mockée. Les exports n'existent pas encore.
- **Pilotage** : Placeholder massif pour la configuration Admin (`#admin`), l'Import/Export, et le Payroll.

## 6. Boutons et actions problématiques

| Page | Bouton | Problème | Impact | Priorité | Recommandation |
|---|---|---|---|---|---|
| Toutes | "Enregistrer" / "Confirmer" | Mutations 100% locales (Mock) | Illusion de persistance | P1 | Stratégie de dé-mocking |
| `#inventory-item` | "Changer image" | Utilise `URL.createObjectURL` en RAM | Perte au rafraîchissement | P2 | Implémenter S3/API Upload |
| `#reports` | "Export Excel" | Affiche un Toast uniquement | Impossibilité d'audit externe | P2 | Implémenter l'export CSV/XLSX |
| `Dashboard` | Liens `Paramètres` / `Admin` | Pointe vers `PlaceholderPage` | Frustration UX | P1 | Créer `AdminPage.tsx` |

## 7. Écarts avec documents projet

| Règle documentée | État frontend | Écart | Priorité |
|---|---|---|---|
| Maintien de la cohérence API backend | Appels API remplacés par `mockData` (suite à l'intégration du prototype) | L'application réelle ne lit/écrit plus la vraie DB sur les modules majeurs | P0 |
| FE-N : Settings / admin completion | Route `#admin` redirige vers Placeholder | Admin / IdentityPanel non branché | P2 |
| Rapports légaux (FE-O) | Aucune interface d'export réel | Pas de génération de livre comptable ou inventaire | P2 |

## 8. Écarts avec prototype validé

| Fonctionnalité prototype | État réel (App.tsx actuel) | Décision |
|---|---|---|
| Shell et Navigation | 100% Parité (L'App utilise `AppShell` du prototype) | Déjà fait |
| UX Prospects / Clients | 100% Parité | Déjà fait |
| Wizard de réservation | 100% Parité | Déjà fait |
| Logistique complète | 100% Parité | Déjà fait |
| *Note* | Le prototype **EST** devenu le frontend réel. Il n'y a plus d'écart visuel. L'écart est désormais uniquement sur l'accès aux données réelles. | - |

## 9. Ce qu’il ne faut pas refaire

- **Ne pas reconstruire le dashboard** : Il est opérationnel, clair et validé.
- **Ne pas reconstruire la sidebar (`AppShell.tsx`)**.
- **Ne pas refaire le flux Clients & Prospects** (qui gère déjà l'assistant de conversion).
- **Ne pas refaire le Catalogue / Inventaire / Packs** (UX finalisée et validée récemment).
- **Ne pas remplacer l'actuel App.tsx par l'ancien routing** : Le choix d'exposer les composants du prototype en tant que frontend principal est assumé.
- **Ne pas toucher au backend** sans mission dédiée pour dégeler l'API.

## 10. Backlog priorisé des prochaines missions frontend

1. **Mission : 6G-R6-FE-ADMIN-SETTINGS** (P1 : page importante partielle)
   - *Objectif* : Remplacer le placeholder `#admin` par un véritable panneau de configuration reprenant l'ancien `IdentityPanel.tsx` (rôles, permissions, paramètres agence).
   - *Fichiers probables* : `AdminPage.tsx`, `App.tsx`
   - *Validation* : Naviguer sur #admin, voir les tabs Utilisateurs, Rôles, Agences.

2. **Mission : 6G-R6-FE-CUSTOMER-ENRICHMENT** (P2 : amélioration UX - *FE-M*)
   - *Objectif* : Enrichir `CustomerDetailPage.tsx` avec les onglets / listes croisées vers les factures, les mouvements logistiques du client et les documents signés.
   - *Fichiers probables* : `CustomerDetailPage.tsx`
   - *Validation* : Sur la fiche d'un client actif, voir tout son historique financier et matériel sans chercher ailleurs.

3. **Mission : 6G-R7-FE-REPORTS-EXPORTS** (P2 : amélioration métier - *FE-O*)
   - *Objectif* : Développer la page `#reports` pour proposer les téléchargements légaux (Livre de Caisse, Registre de Réservations, Inventaire Valorisé) même en mock data dans un premier temps (télécharger un CSV simulé).
   - *Fichiers probables* : `ReportsPage.tsx`, utilitaires d'export CSV.

4. **Mission : 6G-R8-FE-DATA-DEMOCKING-PLAN** (P0 : bloque workflow métier)
   - *Objectif* : Commencer à reconnecter les composants de lecture (Listes Clients, Réservations, Inventaire) sur l'API `api.ts` au lieu de `mockData.ts`, au travers d'une couche d'adaptation.
   - *Fichiers probables* : Hooks personnalisés (`useCustomers`, `useReservations`), `api.ts`.

## 11. Checklist finale
- [x] Aucun code modifié (seul cet audit a été rédigé).
- [x] Aucun secret lu (pas d'accès à `.env`).
- [x] Aucun backend/Docker/migration touché.
- [x] Rapport créé sous `docs/audits/FRONTEND_GLOBAL_REAL_APP_AUDIT_6G_R5.md`.
- [x] Aucune PR sans validation.
