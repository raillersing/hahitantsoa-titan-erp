# Mission 6F-R10 — Stabilisation documents, réservations et tables avant 6G

> **ID :** 6F-R10  
> **Date :** 2026-07-01  
> **Auteur :** Agent FE-A (implémentation) / FE-F (review)  
> **Statut :** terminée  
> **Nature :** frontend-only, mock-only, corrections ciblées + nouvelle page + tests

---

## 1. Résumé de la mission

Corriger les bugs bloquants restants après 6F-R9 sur le prototype mocké ERP Hahitantsoa/Titan :

- crash `DocumentPreview` sur `#reservation-detail/RES-2026-0142` ;
- toutes les utilisations non sécurisées de `toLocaleString()` dans le périmètre prototype ;
- colonne `STATUT` dupliquée dans `TitanPage` ;
- colonne `Action` redondante dans l’historique client ;
- création d’une page unique `#reservations` pour retrouver tous les dossiers ;
- tests de non-régression et de couverture des parcours critiques.

---

## 2. Cause exacte du crash DocumentPreview sur RES-2026-0142

`RES-2026-0142` est une réservation Hahitantsoa. `ReservationDetailPage.tsx` construisait les tableaux `materials` et `services` à partir des lignes de réservation, mais **sans** fournir de propriété `price`.

Dans `DocumentPreview.tsx`, les lignes de proforma/facture affichaient :

```tsx
<td>{m.price.toLocaleString('fr-FR', {minimumFractionDigits: 2})}</td>
```

Avec `m.price === undefined`, cela produisait :

```
Cannot read properties of undefined (reading 'toLocaleString')
```

L’erreur remontait dans `ErrorBoundary.tsx` et provoquait un écran blanc.

---

## 3. Corrections toLocaleString / formatage robuste

### 3.1 Helpers centralisés dans `mockData.ts`

- `formatMoney(value)` : monnaie avec suffixe `Ar`, fallback `0 Ar`.
- `formatMoneyRaw(value)` : nombre avec 2 décimales, fallback `0,00`.
- `safeNumber(value, fallback = 0)` : convertit string/number/undefined en number, fallback sur `NaN` ou vide.
- `formatNumber(value)` : format générique.
- `formatQuantity(value)` : quantité numérique sécurisée.

### 3.2 DocumentPreview robuste

- Tous les montants passent par `safeNumber()` + `formatMoneyRaw()`.
- Gestion des `materials`/`services` vides avec message : *“Aucune ligne à afficher dans ce document mock.”*
- Lignes matériels/services avec fallback sur `name`, `designation`, `quantity`, `price`.
- Sous-total, remise, total à payer sécurisés via `safeSubTotal`, `safeDiscount`, `safeTotal`.
- Dépôt de garantie Hahitantsoa sécurisé.
- Labels contractuels : `CONTRAT DE LOCATION DE MATERIELS EVENEMENTIELS « TITAN RENTAL »`, `CONTRAT DE LOCATION « HAHITANTSOA »` inchangés.

### 3.3 ReservationDetailPage robuste

- `materials`/`services` construits avec `price: safeNumber(line.price, 0)` et `quantity: safeNumber(line.qty, 1)`.
- Résumé financier (`Total TTC`, `Acompte`, `Reste`) continue d’utiliser `formatMoney()` déjà sécurisé.
- Onglets Titan : bouton contrat simplifié (`setPreviewDoc('contrat')`) pour éviter la condition inutile.

### 3.4 Autres fichiers

Les occurrences de `toLocaleString()` restantes hors périmètre prototype (panels opérationnels, `CustomerPanel.tsx`, `StockMovementLedgerPanel.tsx`, etc.) n'ont pas été modifiées car :
- elles concernent des panels en dehors de la mission 6F-R10 ;
- elles utilisent majoritairement des dates (`Date.toLocaleString()` ou `Date.toLocaleDateString()`) sur des valeurs déjà contrôlées ;
- la cible explicite était `frontend/src/prototype` et les pages détail/document/table.

---

## 4. Corrections documents Titan/Hahitantsoa

Validation manuelle simulée via tests :

| Route / document | État après correction |
|------------------|-----------------------|
| `#reservation-detail/LOC-2026-0089` Proforma | ✅ |
| `#reservation-detail/LOC-2026-0089` Facture | ✅ |
| `#reservation-detail/LOC-2026-0089` Contrat Titan | ✅ |
| `#reservation-detail/LOC-2026-0088` Proforma | ✅ |
| `#reservation-detail/LOC-2026-0088` Facture | ✅ |
| `#reservation-detail/LOC-2026-0088` Contrat Titan | ✅ |
| `#reservation-detail/RES-2026-0142` Proforma | ✅ |
| `#reservation-detail/RES-2026-0142` Facture | ✅ |
| `#reservation-detail/RES-2026-0142` Contrat Hahitantsoa | ✅ |
| `#reservation-detail/RES-2026-0142` Annexes | ✅ |

Labels exacts préservés :
- `P R O F O R M A`
- `F A C T U R E`
- `CONTRAT DE LOCATION DE MATERIELS EVENEMENTIELS « TITAN RENTAL »`
- `CONTRAT DE LOCATION « HAHITANTSOA »`

`R E M I S E` reste corrigé (pas de `R E M I S e`).

---

## 5. Correction colonne STATUT dupliquée dans Titan

Dans `TitanPage.tsx`, l’en-tête contenait deux `<th>Statut</th>`. Suppression du doublon. La colonne unique `Statut` est maintenant la dernière colonne avec `rounded-tr-lg`.

---

## 6. Correction colonnes ACTION redondantes

### 6.1 `CustomerDetailPage.tsx`

- Suppression de la colonne `Action` / bouton `Ouvrir` dans l’historique des dossiers.
- L’ID dossier reste cliquable et navigue vers `#reservation-detail/{id}`.

### 6.2 `TitanPage.tsx`, `HahitantsoaPage.tsx`, `CustomersPage.tsx`

- Déjà corrigés en 6F-R9 : colonnes `Actions`/`Voir fiche` supprimées.
- Vérification complémentaire 6F-R10 : aucune colonne `Action`/`Actions` redondante dans ces trois pages.

### 6.3 Règle UX appliquée

- Lien = navigation.
- Bouton = action.
Les IDs et clients sont des liens (boutons stylisés) ; les vraies actions restent des boutons explicites.

---

## 7. Création page `#reservations`

### 7.1 Fichiers créés

- `frontend/src/prototype/ReservationsPage.tsx`
- `frontend/src/prototype/ReservationsPage.test.tsx`

### 7.2 Intégration

- `App.tsx` : ajout du scope `reservations`, route `#reservations`, rendu de `<ReservationsPage />`.
- `AppShell.tsx` :
  - entrée de menu *“Toutes les réservations”* dans la sidebar, au-dessus de Hahitantsoa/Titan ;
  - breadcrumb `Réservations > Toutes les réservations` ;
  - titre `Toutes les réservations`.

### 7.3 Fonctionnalités

- Liste consolidée Hahitantsoa + Titan.
- Colonnes : ID, Module, Client, Titre, Date, Total, Reste, Statut.
- Filtres : Tous, Hahitantsoa, Titan, En cours, Proforma, Confirmée, Sortie, Terminée.
- Recherche texte sur ID, client, titre, statut.
- ID cliquable → `#reservation-detail/{id}`.
- Client cliquable → `#customer/{id}`.
- Total reste à payer affiché.

### 7.4 Données

Utilise exclusivement `mockReservations` et `mockClients`. Aucun appel API/backend.

---

## 8. Corrections Hahitantsoa

- `HahitantsoaPage.tsx` : numéros de réservation et noms clients cliquables (déjà corrigé en 6F-R9, revérifié).
- `DocumentPreview.tsx` : rendu robuste pour les documents Hahitantsoa avec données partielles.
- Ligne `Location local` dans proforma Hahitantsoa : prix sécurisé via `formatMoneyRaw(hDetails?.venuePrice)`.

---

## 9. Tests ajoutés/modifiés

### 9.1 Nouveaux tests

- `frontend/src/prototype/DocumentPreviewCrash.test.tsx` (7 tests) :
  - Proforma/Facture/Contrat Titan pour `LOC-2026-0088` et `LOC-2026-0089`.
  - Proforma/Facture/Contrat Hahitantsoa pour `RES-2026-0142`.
  - Vérification `REMISE`, jamais `REMISe`.
- `frontend/src/prototype/ReservationsPage.test.tsx` (8 tests) :
  - affichage consolidé ;
  - filtres Titan / Hahitantsoa ;
  - recherche par ID ;
  - clic ID et clic client ;
  - état vide.

### 9.2 Tests mis à jour

- `frontend/src/prototype/TitanAndCustomersPage.test.tsx` : 8 tests couvrant navigation Titan/Hahitantsoa/Customers, édition client, breadcrumb.
- `frontend/src/prototype/ReservationDetailCrash.test.tsx` : 3 tests de rendu sans crash des réservations.

### 9.3 Résultats des tests

```text
Test Files  35 passed (35)
     Tests  303 passed (303)
   Duration  54.80s
```

---

## 10. Résultat exact build

```text
> hahitantsoa-titan-erp-frontend@0.1.0 build
> tsc --noEmit && vite build

vite v7.3.5 building client environment for production...
transforming...
✓ 62 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   1.30 kB │ gzip:   0.71 kB
dist/assets/index-DQS7BfTV.css    6.01 kB │ gzip:   1.73 kB
dist/assets/index-C4OlmQ_9.js   518.07 kB │ gzip: 116.57 kB

(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 5.98s
```

Le warning de chunk > 500 kB est préexistant et non bloquant.

---

## 11. Fichiers modifiés par 6F-R10

| Fichier | Raison |
|---------|--------|
| `frontend/src/prototype/mockData.ts` | Nouveaux helpers `formatMoneyRaw`, `safeNumber`, `formatNumber`, `formatQuantity` |
| `frontend/src/prototype/DocumentPreview.tsx` | Robustesse montants, fallback lignes vides, REMISE, labels préservés |
| `frontend/src/prototype/ReservationDetailPage.tsx` | `materials`/`services` avec prix, simplification bouton contrat |
| `frontend/src/prototype/TitanPage.tsx` | Suppression colonne STATUT dupliquée, cohérence données mock |
| `frontend/src/prototype/CustomerDetailPage.tsx` | Suppression colonne Action redondante dans historique |
| `frontend/src/prototype/ReservationsPage.tsx` | **Nouveau** — index consolidé des réservations/locations |
| `frontend/src/App.tsx` | Route `#reservations` et intégration page |
| `frontend/src/prototype/AppShell.tsx` | Menu sidebar + breadcrumb + titre |
| `frontend/src/prototype/ReservationsPage.test.tsx` | **Nouveau** — tests page réservations |
| `frontend/src/prototype/DocumentPreviewCrash.test.tsx` | **Nouveau** — tests crash safety documents |
| `frontend/src/prototype/TitanAndCustomersPage.test.tsx` | Mis à jour pour 6F-R9/6F-R10 |
| `frontend/src/prototype/ReservationDetailCrash.test.tsx` | Créé en 6F-R9, toujours passant |

---

## 12–17. Confirmations

- ✅ Frontend-only.
- ✅ Mock-only.
- ✅ Aucun backend modifié.
- ✅ Aucun Docker modifié.
- ✅ Aucune migration modifiée.
- ✅ Aucun `.env` ou secret lu/modifié.
- ✅ Aucun commit.
- ✅ Aucun stage.
- ✅ Aucune PR.
- ✅ Aucun push.
- ✅ Mission 6G non lancée.

---

## 18. Recommandation

**La stabilisation 6F-R10 est terminée.**

Les parcours critiques sont corrigés et couverts par les tests :
- documents Titan/Hahitantsoa sans crash ;
- tables sans colonnes redondantes ;
- page `#reservations` fonctionnelle ;
- fiche client avec historique cliquable.

**Recommandation :** effectuer un smoke test manuel rapide sur `#reservation-detail/RES-2026-0142`, `#titan`, `#customers`, `#customer/CUST-001`, `#reservations`, puis passer à la mission 6G Clients & Prospects.

---

*Fin du rapport.*
