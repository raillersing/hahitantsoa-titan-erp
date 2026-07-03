# Rapport 6F-R11 — Clarification UX client, annexes et paiements mockés

**Date :** 2026-07-01  
**Mission :** 6F-R11 — Stabilisation UX avant 6G  
**Périmètre :** Frontend prototype (`frontend/src/prototype/*`) uniquement, données mockées, pas de backend/API.

---

## Objectifs

1. Enrichir l'affichage des **annexes Hahitantsoa** dans le contrat.
2. Ajouter un **retour contextuel** entre fiche client, dossier et liste/réservation.
3. Permettre de créer une **nouvelle réservation** et un **nouveau devis** depuis la fiche client avec le client pré-rempli.
4. Maquetter les **paiements en tranches** sur la fiche dossier.

---

## Fichiers modifiés

| Fichier | Changement |
|---|---|
| `frontend/src/prototype/mockData.ts` | Données des annexes Hahitantsoa déjà enrichies en pre-work (18 règles, 9 zones, plan de masse). |
| `frontend/src/prototype/DocumentPreview.tsx` | Rendu structuré des annexes 1-4 pour Hahitantsoa : règlement intérieur, plan de masse + zones, tableau prix de casse, liste intervenants non autorisés. |
| `frontend/src/App.tsx` | Ajout d'un `returnContext` et d'une callback `navigateBack` pour revenir à la page d'origine depuis customer/detail. |
| `frontend/src/prototype/CustomerDetailPage.tsx` | Bouton retour contextuel, boutons *Nouvelle réservation* et *Nouveau devis* avec paramètres client. |
| `frontend/src/prototype/ReservationDetailPage.tsx` | Bouton retour contextuel, bloc **Paiements en tranches** avec historique, formulaire d'ajout, mise à jour du reste à payer. |
| `frontend/src/prototype/ReservationNewPage.tsx` | Prise en charge des paramètres `quote/{clientId}` et `CUST-XXX` pour sauter l'étape client. |
| `frontend/src/prototype/ReservationDetailPage.test.tsx` | Test de paiements en tranches (ajout, calcul reste, solde final). |
| `frontend/src/prototype/TitanAndCustomersPage.test.tsx` | Ajustement du label du bouton retour. |

---

## Décisions et règles métier

- **Hahitantsoa / Titan :** frontière conservée ; pas de local/service exposé dans Titan.
- **Paiements :** historique local mocké, acompte initial calculé à 50 % par défaut si `paidAmount` absent, reste à payer recalculé dynamiquement.
- **Retour contextuel :** la navigation enregistre la provenance (`from`, `param`) lors de l'entrée sur `customer` ou `reservation-detail` et la restitue via `onBack`.
- **Nouveau devis :** redirige vers `reservation-new` avec le paramètre `quote/{clientId}` ; l'assistant démarre directement à l'étape *Choix du volet* avec le client verrouillé.

---

## Qualité

- **Build :** OK (`npm run build` — warning Rollup 500 kB préexistant, non bloquant).
- **Tests :** 35 fichiers, **304 tests passés** (ajout de 1 test).
- **Logs :**
  - Avant : `logs/terminal/f181i-step6fr11-before-client-annexes-payments-ux-*`
  - Après : `logs/terminal/f181i-step6fr11-after-client-annexes-payments-ux-20260701-192007.log`

---

## Non inclus / reste pour 6G

- Pas de persistance backend des paiements (mock local uniquement).
- Pas d'impression PDF ou envoi automatique de proforma.
- Pas de validation réelle de disponibilité lors de la création depuis client.

---

## Statut

Mission 6F-R11 terminée. Code non commité, non poussé. Prêt pour relecture / passage à 6G.
