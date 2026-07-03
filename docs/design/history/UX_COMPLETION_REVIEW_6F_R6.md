# Mission 6F-R6 — Revue UX Completion / Smoke Review

> **ID :** 6F-R6  
> **Date :** 2026-07-01  
> **Auteur :** Agent FE-F (review-only)  
> **Statut :** revue complète du prototype mocké avant mission 6G Clients & Prospects  
> **Nature :** documentation / UX review uniquement — aucun code modifié  

---

## 1. Résumé exécutif

Cette revue UX a été menée sur le **frontend prototype mocké** du ERP Hahitantsoa/Titan, dans la continuité de la référence UX canonique produite en mission **6F-R5** (`docs/design/UX_REFERENCE.md`).

Elle couvre :

- la lecture des sources obligatoires (UX_REFERENCE, DESIGN.md, parcours prototypes) ;
- l’exécution du build et des tests frontend ;
- un smoke-test de navigation par hash ;
- une analyse de fuite API/backend dans le module prototype ;
- la vérification des frontières métier Hahitantsoa / Titan ;
- la rédaction d’un rapport structuré en 14 sections avec constats, écarts et recommandations classées par criticité.

### Verdict global

Le prototype mocké est **fonctionnellement complet et cohérent avec la référence UX canonique 6F-R5**. Les principaux parcours (création de réservation Hahitantsoa/Titan, détail, stock, logistique, casse/caution, documents, clients, caisse, reporting, aide) sont implémentés et visuellement alignés.  
**Aucune modification de code n’est requise à ce stade.** Les écarts identifiés sont majoritairement des améliorations P2/P3 (robustesse, accessibilité, wording, états vides, cohérence responsive) qui devront être traitées dans des PR techniques de finalisation ou durant la mission 6G.

### Points positifs majeurs

- Parcours Hahitantsoa/Titan strictement séparés, visuellement et fonctionnellement.
- Assistant de création de réservation en 9 étapes, avec brouillon `localStorage`, aperçu proforma/contrat via `DocumentPreview`.
- Inventaire & stocks couverts : stock, mouvements, préparation, sortie, retour, casse/perte, caution.
- Documents commerciaux intégrés : proforma, facture, contrats Hahitantsoa/Titan, labels préservés.
- Dark mode supporté via `dark`/`theme-dark` ; thème par défaut `light`.
- Tests frontend passants (31/31 fichiers, 277/277 tests).
- Build production réussi.

---

## 2. Scope et méthodologie

### Fichiers et pages examinées

| Domaine | Pages/fichiers |
|---------|----------------|
| Navigation | `frontend/src/App.tsx`, `frontend/src/prototype/AppShell.tsx` |
| Dashboard / Planning | `DashboardPage.tsx`, `PlanningPage.tsx` |
| Réservations | `HahitantsoaPage.tsx`, `TitanPage.tsx`, `ReservationNewPage.tsx`, `ReservationDetailPage.tsx` |
| Clients | `CustomersPage.tsx`, `CustomerDetailPage.tsx` |
| Inventaire & Stocks | `InventoryPage.tsx`, `InventoryItemPage.tsx`, `StockMovementsPage.tsx`, `StockPreparationPage.tsx`, `LogisticsDispatchPage.tsx`, `LogisticsReturnsPage.tsx`, `BreakageLossPage.tsx` |
| Catalogue | `PackageBuilderPage.tsx`, `ServicesPage.tsx`, `BlacklistPage.tsx` |
| Finance & Docs | `CommercialOpsPage.tsx`, `CashboxPage.tsx`, `CautionPage.tsx`, `DocumentPreview.tsx` |
| Pilotage | `ReportsPage.tsx`, `HelpPage.tsx`, `AuditPage.tsx` |
| Données mockées | `frontend/src/prototype/mockData.ts` |
| Sources UX | `docs/design/UX_REFERENCE.md`, `docs/design/DESIGN.md` |

### Commandes et validations exécutées

| Validation | Commande / source | Résultat |
|------------|-------------------|----------|
| Build frontend | `cd frontend && npm run build` | ✅ OK — `tsc --noEmit && vite build` |
| Tests frontend | `cd frontend && npm test` | ✅ OK — 31 fichiers, 277 tests passants |
| Smoke navigation | `curl` sur 10 hash routes | ✅ 200 partout |
| Fuite API | `grep` imports `api/axios/backend`, `fetch`, `http` dans `frontend/src/prototype/` | ✅ Aucun appel backend réel détecté |
| localStorage usage | `grep localStorage` | ✅ usage limité au thème et au brouillon de réservation |
| Frontière Titan | `grep` venue/local/room/hall/service dans Titan | ✅ Respectée ; seule destination de livraison autorisée |
| Labels documents | `grep` dans `DocumentPreview.tsx` | ✅ `CONTRAT DE LOCATION DE MATERIELS EVENEMENTIELS « TITAN RENTAL »`, `CONTRAT DE LOCATION « HAHITANTSOA »`, `P R O F O R M A`, `F A C T U R E` présents |
| Git baseline | `git status --short`, `git log --oneline -5` | Baseline sur `54dfcf8` feat(titan) ; 6F-R5 comme fichiers docs non trackés |

### Hypothèses de revue

- Phase prototype : les données sont mockées. L’UX ne doit donc pas être jugée sur la persistance réelle, mais sur la clarté du feedback utilisateur.
- Les écarts UI mineurs (typographie, espacement, wording) sont relevés mais ne bloquent pas la finalisation UX.
- Cette revue ne remplace pas un test utilisateur complet ; elle identifie les points à valider ou à corriger avant 6G.

---

## 3. Couverture fonctionnelle par module

### 3.1 Navigation globale

- **Sidebar** hiérarchique complète avec groupes : Accueil, Commercial, Réservations, Inventaire & Stocks, Finance & Opérations, Pilotage.
- **Breadcrumbs** présents dans `AppShell` pour les sous-sections inventaire et les détails de réservation.
- **Thème** : switch light/dark en topbar, persistance `localStorage`.
- **Hash routing** simple via `window.history.replaceState` et `hashchange`.

**Constats :**
- Le breadcrumb est minimal mais fonctionnel.
- Pas de recherche globale, pas de raccourcis clavier documentés (P3).
- Le lien "Déconnexion" navigue vers `login` mais il s’agit d’une `PlaceholderPage` (acceptable en prototype).

### 3.2 Dashboard

- 4 KPIs (Hahitantsoa, Titan, retours, reste à payer) avec call-to-action.
- Graphique d’activité 7 jours stylisé (bars CSS).
- Alertes & notifications.
- Tableau "Dossiers en cours".

**Constats :**
- Les KPIs sont statiques/mockés ; le wording "+12%" n’indique pas la période de référence (P3).
- Les alertes sont cliquables et redirigent vers le parcours concerné. ✅

### 3.3 Planning

- Vue semaine statique du 23–29 juin 2026.
- Filtres Hahitantsoa / Titan.
- Bouton "Nouveau RDV" (no-op toast).

**Constats :**
- Vue purement indicative. Pas d’interaction de création/édition réelle (P2).
- Pas de date dynamique (P3).

### 3.4 Réservations — Liste Hahitantsoa / Titan

- `HahitantsoaPage` et `TitanPage` présentent des tableaux de réservations.
- Filtres visuels en pill (non fonctionnels mais clairement identifiés comme filtres).
- Workflow Hahitantsoa en icônes de statut.
- Message de règle Titan en bannière ambrée.

**Constats :**
- Dans `TitanPage`, le bouton "Détail" de la deuxième ligne (`LOC-2026-0088`) navigue vers `RES-2026-0142` au lieu du bon ID. **P1 — navigation incorrecte.**
- Les filtres sont des placeholders visuels (P2 — doivent être implémentés ou marqués "à venir").

### 3.5 Création de réservation (`ReservationNewPage`)

- 9 étapes : choix du parcours (client first / domain first), client, domaine, détails, catalogue, services/livraison, résumé, proforma, paiement, contrat.
- Brouillon `localStorage` avec sauvegarde/restauration/suppression.
- Domaines strictement séparés : Hahitantsoa propose local, durée, services, packages ; Titan propose destination, période, mode de mouvement, véhicule.
- Tarifs, remise, caution calculées dynamiquement.
- Aperçu proforma/contrat via `DocumentPreview`.

**Constats positifs :**
- Gestion des champs conditionnels par type d’événement (mariage, fiançailles, baptême, autre). ✅
- Clamp de quantités par stock disponible. ✅
- Rappel métier Titan explicite : "Aucun champ lié à un local ou un service événementiel ne doit figurer ici." ✅

**Constats à améliorer :**
- Le brouillon est affiché dans l’UI uniquement s’il existe (`localStorage.getItem("prototypeReservationDraft")`), mais il n’y a pas de gestion de conflit si l’utilisateur ouvre un autre brouillon. **P2.**
- L’alerte native `alert()` est utilisée pour la sauvegarde de brouillon. **P2 — remplacer par toast inline.**
- Pas de confirmation explicite avant de quitter l’assistant avec des modifications non sauvegardées. **P2.**
- Le résumé affiche des dates vides (`Du  au`) si elles ne sont pas renseignées. **P2 — afficher un placeholder.**

### 3.6 Détail de réservation (`ReservationDetailPage`)

- Timeline Proforma → Contrat → Acompte → Confirmée → Sortie → Retour.
- Onglets spécifiques Titan : Contrat & Proforma, Préparation, Sortie/Livraison, Retour, Casse, Caution.
- Lignes de réservation Hahitantsoa en tableau.
- Résumé financier (total, acompte, reste).

**Constats :**
- Timeline codée en dur (`isDone = idx <= 3`), donc le statut "Confirmée" est toujours actif même si la réservation est à un autre stade. **P2 — lier au vrai statut de la réservation.**
- Les onglets Titan sont bien séparés, mais les données sont statiques et non issues du dossier réel. Acceptable en prototype, mais à lier au mock en P2.
- Le lien "Client" navigue vers `customer/{id}` ✅.

### 3.7 Clients

- `CustomersPage` : tableau avec recherche, filtres visuels, badges documentaires.
- `CustomerDetailPage` : fiche, coordonnées, historique des dossiers, actions rapides.

**Constats :**
- Le bouton "Voir fiche" dans `CustomersPage` n’est pas cliquable / ne navigue pas. **P1 — action inactive.**
- `CustomerDetailPage` affiche des coordonnées très réduites (email + téléphone uniquement) ; les champs identité (CIN, NIF, STAT, adresse) ne sont pas affichés sauf via le contrat. **P2 — enrichir la fiche client.**

### 3.8 Inventaire & Stocks

| Page | Couverture | État |
|------|------------|------|
| `InventoryPage` | KPIs, filtres catégorie/statut, tableau articles, actions rapides | ✅ |
| `InventoryItemPage` | Fiche article, stocks, mouvements, prix, actions | ✅ |
| `StockMovementsPage` | Liste filtrée par type de mouvement, annulation toast | ✅ |
| `StockPreparationPage` | Préparations par dossier, ajustement quantités, remplacement, marquer prêt | ✅ |
| `LogisticsDispatchPage` | Sorties/livraisons, photos, signature, BL | ✅ |
| `LogisticsReturnsPage` | Retours attendus, état au retour, nettoyage, casse/perte, pénalités retard | ✅ |
| `BreakageLossPage` | Casse/perte, caution, retenue, différence à facturer, clôture | ✅ |
| `CautionPage` | Liste des cautions, statuts, restitution | ✅ |

**Constats transversaux :**
- Classement cohérent et feedback toast sur chaque action. ✅
- Quelques états vides bien gérés. ✅
- La signature client dans `LogisticsDispatchPage` mute le DOM directement (`e.currentTarget.innerHTML = ...`) — fonctionne mais non idéal pour React. **P3.**
- `BreakageLossPage` n’a pas de classes dark mode complètes (arrière-plans `bg-white`, `bg-slate-50` sans variantes `dark:`). **P2 — incohérence dark mode.**

### 3.9 Catalogue (Packages, Services, Liste noire)

- `PackageBuilderPage` : liste + édition de packages, composition articles, prix forfaitaire vs estimation.
- `ServicesPage` : catalogue de services Hahitantsoa, activation/désactivation.
- `BlacklistPage` : liste noire d’intervenants.

**Constats :**
- Les trois pages gèrent CRUD simulé côté state. ✅
- Wording cohérent : "Exclusif Hahitantsoa" sous les services. ✅
- Pas de confirmation avant suppression de package. **P2.**

### 3.10 Documents commerciaux

- `CommercialOpsPage` : liste proforma/facture/reçu + timeline des échéances + modale facture.
- `DocumentPreview.tsx` : rendu proforma/facture/contrat avec labels canoniques.

**Constats :**
- La facture modale est hardcodée pour `Rasoamanana L.` avec un service traiteur — elle ne provient pas d’une réservation réelle. **P2 — lier au dossier.**
- Les labels Hahitantsoa/Titan sont correctement conservés. ✅

### 3.11 Caisse et Reporting

- `CashboxPage` : KPIs entrées/sorties/solde, tableau mouvements récents.
- `ReportsPage` : graphique CA mensuel, liste rapports exportables (no-op).

**Constats :**
- Fonctionnellement statique mais clair. ✅
- Les actions d’export sont des toasts — acceptable en prototype (P3).

### 3.12 Aide & Audit

- `HelpPage` : cartes manuel + support.
- `AuditPage` : journal d’audit mocké.

**Constats :**
- Liens support no-op (P3).
- `AuditPage` affiche IP en clair — acceptable dans un journal interne, mais à lier au backend en P2.

---

## 4. Alignement avec la référence UX canonique (6F-R5)

La référence UX (`docs/design/UX_REFERENCE.md`) définit 27 sections couvrant principes, parcours, états transversaux, matrices boutons/tests et gaps P0–P3.  
L’alignement du prototype avec cette référence est **globalement bon**. Les écarts identifiés sont listés dans la section 8.

| Thème | Alignement | Remarque |
|-------|------------|----------|
| Principes UX globaux | ✅ Fort | clarté, feedback, état explicite, progressive disclosure |
| Navigation | ✅ Bon | sidebar, breadcrumbs, hash routing |
| Dashboard | ✅ Bon | KPIs + alertes + dossiers en cours |
| Parcours Hahitantsoa | ✅ Très bon | local, durée, services, packages, avenant |
| Parcours Titan | ✅ Très bon | destination, période, mouvement, caution |
| Inventaire & stocks | ✅ Très bon | stock, mouvements, préparation, logistique, retour, casse |
| Clients | ⚠️ Moyen | fiche trop réduite, action "Voir fiche" inactive |
| Documents | ✅ Bon | labels préservés, aperçu intégré |
| Caisse/Reporting | ✅ Bon | maquettes fonctionnelles |
| Accessibilité | ⚠️ Partiel | focus visible, labels liés, contrastes globalement OK ; quelques icônes sans texte alternatif |
| Responsive | ⚠️ Partiel | tableaux avec `overflow-x-auto`, sidebar fixe 288px |
| Dark mode | ⚠️ Partiel | la plupart des pages supportent `dark:` ; `BreakageLossPage` en dérive |

---

## 5. Conformité aux principes DESIGN.md

`docs/design/DESIGN.md` impose :

1. **Clarté opérationnelle avant esthétique** — respecté globalement. ✅
2. **Progressive disclosure** — respecté (résumé puis détail). ✅
3. **État explicite brouillon vs commit** — partiel : le brouillon existe mais n’est pas clairement distingué visuellement d’un dossier confirmé dans les listes. **P2.**
4. **Actions sensibles isolées** — respecté (boutons de confirmation, caution, clôture en couleur distincte). ✅
5. **Titan reste dans DEC-001** — respecté. ✅
6. **Ne pas inventer de comportement backend** — respecté : toutes les actions sont des toasts/state local. ✅
7. **Accessibilité** — partiel : quelques boutons icônes sans `aria-label`, focus pas toujours visible. **P2.**
8. **Responsive** — partiel : tableaux scrollables, mais certains boutons pourraient être plus grands sur mobile. **P3.**

---

## 6. Frontières métier Hahitantsoa / Titan

### Constat global

La frontière est **correctement préservée** dans le prototype.

### Preuves relevées

- `TitanPage.tsx` affiche : "Location de matériel uniquement — Aucun local ni service".
- `ReservationNewPage.tsx` : le parcours Titan affiche un rappel : "Aucun champ lié à un local ou un service événementiel ne doit figurer ici."
- `DocumentPreview.tsx` : labels distincts :
  - `CONTRAT DE LOCATION DE MATERIELS EVENEMENTIELS « TITAN RENTAL »`
  - `CONTRAT DE LOCATION « HAHITANTSOA »`
- Les services (`hahitantsoaMockServices`) et les packages ne sont présentés que dans le parcours Hahitantsoa.
- Aucun appel à des entités `venue`, `room`, `hall`, `service`, `event_service`, `ancillary` dans le périmètre Titan (hors destination de livraison, qui est autorisée).

### Écart mineur

- Dans `TitanPage.tsx`, le wording "Articles" dans le tableau est acceptable, mais on pourrait le préciser "Matériels / packs" pour renforcer la frontière. **P3.**

---

## 7. Vérification API leakage / données mockées

### Constat global

Le module prototype est **100 % mocké**. Aucune fuite vers le backend réel n’a été détectée.

### Preuves

- Aucun import `api`, `axios`, `backend` dans `frontend/src/prototype/`.
- Aucun appel `fetch`, `axios`, `get/post http`.
- Les seules références à `localStorage` concernent :
  - le thème (`theme`) dans `AppShell.tsx` ;
  - le brouillon de réservation (`prototypeReservationDraft`) dans `ReservationNewPage.tsx`.

### Implications UX

- Toute action produit un feedback local (toast, état, alert). C’est cohérent avec la phase prototype.
- L’utilisateur ne peut pas croire que les données sont persistantes en base ; le wording "Mock" ou "Simulation" apparaît par endroits. Cependant, certains libellés pourraient être plus explicites, par exemple "Enregistrer (local)" au lieu de "Enregistrer". **P3.**

---

## 8. Gaps UX identifiés (classés par criticité)

### 8.1 P1 — Doit être corrigé avant une démo utilisateur

| # | Écran | Problème | Impact | Recommandation |
|---|-------|----------|--------|----------------|
| P1-01 | `TitanPage.tsx` | Le bouton Détail de `LOC-2026-0088` navigue vers `RES-2026-0142` au lieu de `LOC-2026-0088`. | Navigation incorrecte ; l’utilisateur se retrouve sur le mauvais dossier. | Corriger `onNavigate("reservation-detail", "LOC-2026-0088")`. |
| P1-02 | `CustomersPage.tsx` | Le bouton "Voir fiche" n’est pas cliquable / ne navigue pas. | Impossible d’ouvrir la fiche client depuis la liste. | Ajouter `onClick={() => onNavigate("customer", client.id)}`. |

### 8.2 P2 — À corriger dans la prochaine PR frontend de finalisation

| # | Écran | Problème | Impact | Recommandation |
|---|-------|----------|--------|----------------|
| P2-01 | `ReservationNewPage.tsx` | Utilisation d’`alert()` pour confirmer la sauvegarde du brouillon. | Interrompt le flux et dégrade l’expérience. | Remplacer par un toast inline. |
| P2-02 | `ReservationNewPage.tsx` | Pas de confirmation avant de quitter l’assistant avec un brouillon modifié. | Risque de perte de saisie. | Ajouter un handler `beforeunload` et/ou une modale de confirmation. |
| P2-03 | `ReservationNewPage.tsx` | Le résumé affiche `Du  au` quand les dates sont vides. | Apparence cassée. | Afficher un placeholder "Dates non renseignées". |
| P2-04 | `ReservationDetailPage.tsx` | Timeline toujours fixée sur "Confirmée" (`idx <= 3`). | Indication de statut fausse. | Lier `isDone`/`isActive` au statut réel de la réservation. |
| P2-05 | `ReservationDetailPage.tsx` | Données des onglets Titan statiques/hardcodées. | Incohérence avec le dossier. | Brancher sur `mockData.ts` et le paramètre. |
| P2-06 | `BreakageLossPage.tsx` | Pas de variantes `dark:` sur les arrière-plans principaux. | Incohérence dark mode. | Ajouter `dark:bg-slate-800` etc. |
| P2-07 | `CustomerDetailPage.tsx` | Fiche client trop réduite. | Manque d’informations opérationnelles. | Afficher CIN/NIF/STAT/adresse selon type, avec accès aux justificatifs sécurisés. |
| P2-08 | `CustomersPage.tsx` | Filtres non fonctionnels. | Apparence trompeuse. | Les implémenter ou les marquer "À venir". |
| P2-09 | `PackageBuilderPage.tsx` | Suppression sans confirmation. | Risque de perte. | Ajouter une modale de confirmation. |
| P2-10 | `CommercialOpsPage.tsx` | Facture modale hardcodée. | Ne reflète pas un dossier réel. | Lier la modale au dossier sélectionné ou marquer "Aperçu type". |
| P2-11 | Accessibilité | Plusieurs boutons icônes sans `aria-label`. | Difficulté pour les lecteurs d’écran. | Ajouter `aria-label` ou `title` explicite. |

### 8.3 P3 — Améliorations futures / nice-to-have

| # | Écran | Problème | Recommandation |
|---|-------|----------|----------------|
| P3-01 | Global | Pas de recherche globale. | Ajouter une barre de recherche transversale (quand API prête). |
| P3-02 | Global | Pas de raccourcis clavier documentés. | Documenter les raccourcis principaux (navigation, création, recherche). |
| P3-03 | Dashboard | KPIs sans période de référence. | Ajouter un sélecteur de période ou un sous-titre. |
| P3-04 | Planning | Vue statique. | Connecter aux données et permettre création/édition. |
| P3-05 | `LogisticsDispatchPage.tsx` | Signature via mutation DOM directe. | Utiliser un composant React dédié (canvas/signature-pad mock). |
| P3-06 | `ReservationNewPage.tsx` | Wording "Enregistrer" pour le brouillon local. | Préciser "Enregistrer en local" ou "Sauvegarder brouillon". |
| P3-07 | `ReportsPage.tsx` | Export no-op. | Implémenter export CSV/PDF ou marquer "Mock". |
| P3-08 | `HelpPage.tsx` | Liens support no-op. | Connecter aux vraies ressources ou indiquer "Bientôt disponible". |
| P3-09 | Responsive | Taille des boutons et filtres sur mobile. | Augmenter les touch targets (min 44px). |

---

## 9. Tests et build

### Build

```text
> hahitantsoa-titan-erp-frontend@0.1.0 build
> tsc --noEmit && vite build

vite v7.3.5 building client environment for production...
transforming...
✓ 61 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   1.30 kB │ gzip:   0.71 kB
dist/assets/index-DQS7BfTV.css    6.01 kB │ gzip:   1.73 kB
dist/assets/index-C2QzkwXL.js   497.70 kB │ gzip: 113.24 kB
✓ built in 3.73s
```

### Tests

```text
Test Files  31 passed (31)
     Tests  277 passed (277)
  Start at  13:47:00
Duration  42.75s
```

Aucun test n’a été ajouté, supprimé ou modifié dans le cadre de cette revue.

---

## 10. Smoke-test navigation

| URL testée | Code HTTP | Titre |
|------------|-----------|-------|
| `http://localhost:5173/` | 200 | `Hahitantsoa / Titan ERP` |
| `/#hahitantsoa` | 200 | `Hahitantsoa / Titan ERP` |
| `/#titan` | 200 | `Hahitantsoa / Titan ERP` |
| `/#inventory` | 200 | `Hahitantsoa / Titan ERP` |
| `/#reservation-new` | 200 | `Hahitantsoa / Titan ERP` |
| `/#reservation-detail/RES-2026-0142` | 200 | `Hahitantsoa / Titan ERP` |
| `/#commercial-ops` | 200 | `Hahitantsoa / Titan ERP` |
| `/#cashbox` | 200 | `Hahitantsoa / Titan ERP` |
| `/#reports` | 200 | `Hahitantsoa / Titan ERP` |
| `/#help` | 200 | `Hahitantsoa / Titan ERP` |

Le serveur de dev Vite était déjà actif ; le smoke-test n’a pas nécessité de le relancer.

---

## 11. Risques et dépendances pour la suite

| Risque | Impact | Mitigation |
|--------|--------|------------|
| Les P1 (navigation Titan et fiche client) restent dans le prototype et peuvent être oubliés. | Mauvaise démo, confusion utilisateur. | Inclure P1-01 et P1-02 dans le périmètre de la première tâche frontend de 6G. |
| L’écart "timeline statique" en détail de réservation peut fausser la perception du workflow. | L’utilisateur ne comprend pas l’état réel du dossier. | Traiter P2-04 dès la mission 6G. |
| Les pages sans dark mode complet (`BreakageLossPage`) créent une régression visuelle en dark. | Incohérence thème. | P2-06 doit être traité avant de livrer dark mode comme stable. |
| Les actions no-op restent sans marquage explicite "Mock". | L’utilisateur peut croire à un dysfonctionnement. | P3-06/07/08 : ajouter des badges "Simulation" ou "À venir". |

---

## 12. Recommandations pour la mission 6G — Clients & Prospects

La mission 6G devra s’appuyer sur cette revue pour :

1. **Corriger les P1** :
   - `TitanPage.tsx` : lier le bouton Détail au bon ID de location.
   - `CustomersPage.tsx` : rendre "Voir fiche" navigable vers `customer/{id}`.

2. **Enrichir la fiche client** (`CustomerDetailPage.tsx`) :
   - afficher les champs identité selon type (Particulier vs Entreprise) ;
   - lister les justificatifs sans exposer d’URL publique permanente ;
   - afficher l’historique complet des dossiers, paiements et cautions.

3. **Stabiliser les filtres et la recherche** dans `CustomersPage`.

4. **Garder la frontière Hahitantsoa/Titan** : les prospects/clients peuvent être communs, mais les actions commerciales doivent rester domain-correctes.

5. **Documenter les écarts** dans la section clients de `docs/design/UX_REFERENCE.md` si des décisions UX nouvelles sont prises.

---

## 13. Livrables de cette revue

- `docs/design/UX_COMPLETION_REVIEW_6F_R6.md` (présent document).
- Logs de validation dans `logs/terminal/` :
  - `6f-r6-api-leak-check-20260701-134853.log`
  - `6f-r6-boundary-check-20260701-134900.log`
  - `6f-r6-nav-smoke-20260701-134956.log`
- Build et tests passants (résultats conservés dans le récapitulatif ci-dessus).

Aucun fichier source n’a été modifié.

---

## 14. Conclusion et autorisation de suite

La revue UX Completion 6F-R6 est **terminée**. Le prototype mocké couvre l’intégralité des parcours définis dans la référence UX canonique 6F-R5. Les écarts identifiés sont documentés, classés et prêts à être traités dans la mission **6G Clients & Prospects** ou dans une PR technique de finalisation frontend.

**Aucun code n’a été modifié.** Aucune PR n’est nécessaire pour cette livraison documentation-only.  
La suite logique est la mission **6G Clients & Prospects**, qui devra intégrer les recommandations de la section 12 et prioriser les P1.

---

*Fin du document.*
