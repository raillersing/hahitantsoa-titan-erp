# Mission 6F-R7 — Rapport de correction des 2 P1 UX

> **ID :** 6F-R7  
> **Date :** 2026-07-01  
> **Auteur :** Agent FE-A (implémentation) / FE-F (review)  
> **Statut :** terminée — corrections P1 appliquées et validées  
> **Nature :** frontend-only, mock-only, 2 corrections minimales + tests ciblés  

---

## 1. Objectif

Corriger les deux bugs P1 UX identifiés par la revue 6F-R6 avant le lancement de la mission 6G Clients & Prospects.

1. **`TitanPage.tsx`** : le bouton `Détail` de `LOC-2026-0088` naviguait vers un ID incorrect (`RES-2026-0142`).
2. **`CustomersPage.tsx`** : le bouton `Voir fiche` était inactif.

---

## 2. Diagnostic

### P1-1 — TitanPage.tsx

- Emplacement : `frontend/src/prototype/TitanPage.tsx`, lignes 77 et 95.
- Problème : les deux boutons `Détail` utilisaient la valeur hardcodée `RES-2026-0142` au lieu de l’ID de leur ligne respective.
- Conséquence : cliquer sur `Détail` pour `LOC-2026-0088` ouvrait le détail d’une réservation Hahitantsoa incorrecte.
- Route correcte : `onNavigate("reservation-detail", "LOC-2026-0088")` (et `LOC-2026-0089` pour la première ligne).

### P1-2 — CustomersPage.tsx

- Emplacement : `frontend/src/prototype/CustomersPage.tsx`, lignes 63 et 90.
- Problème : les boutons `Voir fiche` étaient des `<button>` sans handler `onClick`.
- Conséquence : le bouton était visuellement présent mais non interactif.
- Route existante : `frontend/src/App.tsx` route `"customer"` vers `CustomerDetailPage` avec `param={activeParam}`.
- IDs clients mockés : `CUST-001` (Ando Rakoto) et `CUST-002` (Rasoa Nomena).
- Route correcte : `onNavigate("customer", "CUST-001")` / `onNavigate("customer", "CUST-002")`.

---

## 3. Corrections appliquées

### 3.1 TitanPage.tsx

```diff
-                <button onClick={() => onNavigate("reservation-detail", "RES-2026-0142")} ...>Détail</button>
+                <button onClick={() => onNavigate("reservation-detail", "LOC-2026-0089")} ...>Détail</button>

-                <button onClick={() => onNavigate("reservation-detail", "RES-2026-0142")} ...>Détail</button>
+                <button onClick={() => onNavigate("reservation-detail", "LOC-2026-0088")} ...>Détail</button>
```

### 3.2 CustomersPage.tsx

```diff
-                <button className="...">Voir fiche</button>
+                <button onClick={() => onNavigate("customer", "CUST-001")} className="...">Voir fiche</button>

-                <button className="...">Voir fiche</button>
+                <button onClick={() => onNavigate("customer", "CUST-002")} className="...">Voir fiche</button>
```

### 3.3 Tests ajoutés

Fichier créé : `frontend/src/prototype/TitanAndCustomersPage.test.tsx`

Couverture :

- `TitanPage` — bouton `Détail` de `LOC-2026-0088` appelle `onNavigate("reservation-detail", "LOC-2026-0088")`.
- `TitanPage` — bouton `Détail` de `LOC-2026-0089` appelle `onNavigate("reservation-detail", "LOC-2026-0089")`.
- `CustomersPage` — boutons `Voir fiche` appellent `onNavigate("customer", "CUST-001")` et `onNavigate("customer", "CUST-002")`.

---

## 4. Résultats de validation

### Build frontend

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
dist/assets/index-D6jxLx_7.js   497.77 kB │ gzip: 113.26 kB
✓ built in 3.47s
```

### Tests frontend

```text
 Test Files  32 passed (32)
      Tests  280 passed (280)
   Start at  14:04:28
   Duration  50.43s
```

Avant 6F-R7 : 31 fichiers / 277 tests.  
Après 6F-R7 : 32 fichiers / 280 tests (ajout du fichier de test 6F-R7).

---

## 5. Fichiers modifiés par 6F-R7

| Fichier | Modification |
|---------|--------------|
| `frontend/src/prototype/TitanPage.tsx` | Correction des deux routes `Détail` |
| `frontend/src/prototype/CustomersPage.tsx` | Ajout des handlers `onClick` sur les boutons `Voir fiche` |
| `frontend/src/prototype/TitanAndCustomersPage.test.tsx` | Nouveau fichier de tests ciblés (créé) |

---

## 6. Confirmations

- ✅ **Frontend-only** : seuls des fichiers React du prototype frontend ont été modifiés.
- ✅ **Mock-only** : aucune connexion API/backend ajoutée ; les données restent mockées.
- ✅ **Aucun backend modifié**.
- ✅ **Aucun fichier Docker modifié**.
- ✅ **Aucune migration modifiée**.
- ✅ **Aucun `.env` lu/affiché/modifié**.
- ✅ **Aucun secret exposé**.
- ✅ **Aucune dépendance externe ajoutée**.
- ✅ **Aucun commit effectué**.
- ✅ **Aucun stage effectué**.
- ✅ **Aucune PR créée**.
- ✅ **Aucun push effectué**.
- ✅ **Mission 6G non lancée**.

---

## 7. Vérification Git

Baseline avant 6F-R7 conservée dans :

- `logs/terminal/f181e-step6fr7-before-p1-ux-fixes-status.txt`
- `logs/terminal/f181e-step6fr7-before-p1-ux-fixes-name-status.txt`
- `logs/terminal/f181e-step6fr7-before-p1-ux-fixes-numstat.txt`
- `logs/terminal/f181e-step6fr7-before-p1-ux-fixes.patch`
- `logs/terminal/f181e-step6fr7-before-p1-ux-fixes-log.txt`

Diff restreint aux fichiers 6F-R7 :

```text
M	frontend/src/prototype/CustomersPage.tsx
M	frontend/src/prototype/TitanPage.tsx
```

Le nouveau fichier de test est non tracké (`?? frontend/src/prototype/TitanAndCustomersPage.test.tsx`).

Aucun fichier hors périmètre n’a été touché par les corrections elles-mêmes. Les modifications préexistantes du worktree (fichiers ` M ` et `??` autres) datent des missions antérieures et n’ont pas été altérées.

---

## 8. Recommandation

Les deux P1 UX sont corrigés et validés par build + tests verts.  
**La mission 6G Clients & Prospects peut maintenant démarrer**, en embarquant éventuellement les recommandations P2/P3 de `docs/design/UX_COMPLETION_REVIEW_6F_R6.md` si elles entrent dans le périmètre de 6G.

---

*Fin du rapport.*
