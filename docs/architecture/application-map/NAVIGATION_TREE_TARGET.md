# NAVIGATION_TREE_TARGET.md — Arborescence de navigation cible

> **Version:** F181A — 2026-07-21
> **Etat frontend de reference:** `main` @ `e0914dc`

---

## Principes

- cet arbre reste la navigation cible de l’ERP
- il ne doit plus marquer FE-C à FE-J comme futurs: ces bundles sont déjà merge
- les placeholders existants doivent être lus comme placeholders assumés, pas
  comme “travail oublié”
- avant tout nouveau bundle frontend, consulter F178A et F178B

---

## Arborescence cible mise à jour

```text
Hahitantsoa / Titan ERP
├── Dashboard                         #dashboard         [current]
├── Planning / Calendar              #planning          [current (weekly table)]
├── Titan reservations               #titan             [partial]
│   ├── disponibilité                [current]
│   ├── brouillons                   [current]
│   ├── confirmation Titan           [partial]
│   └── detail reservation           [missing]
├── Hahitantsoa reservations         #hahitantsoa       [current]
│   ├── discovery                    [current]
│   ├── event drafts CRUD            [current]
│   ├── confirmation                 [current]
│   └── amendment flow               [current]
├── Customers / Client file          #customers         [partial]
├── Commercial Ops                   #commercial-ops    [current]
│   ├── Documents Titan              [current]
│   ├── Documents Hahitantsoa        [current]
│   ├── Payments                     [current]
│   ├── Billing / installments / credit notes [current]
│   ├── Logistics / passation        [current]
│   ├── Returns                      [current]
│   ├── Damage / loss                [current]
│   └── Stock ledger                 [current]
├── Identity / Roles                 #identity          [partial]
├── Audit                            #audit             [current]
├── Cashbox                          #cashbox           [current]
├── Caution / Refunds                #caution-refund    [current]
├── Reports / Exports                #reports           [placeholder]
├── Catalog                          #catalog           [placeholder]
├── Procurement                      #procurement       [placeholder]
├── HR                               #hr                [placeholder]
└── Help / Onboarding                #help              [placeholder]
```

---

## Table des nœuds principaux

| Nœud | Route | Statut frontend | Notes |
|---|---|---|---|
| Dashboard | `#dashboard` | current | shell et quick actions FE-H en place |
| Planning | `#planning` | current (weekly table) | PlanningPanel déployé avec filtres Titan/HAH, navigation semaine |
| Titan | `#titan` | partial | cœur opérateur présent; confirmation/detail/wizard encore incomplets |
| Hahitantsoa | `#hahitantsoa` | current | CRUD + confirm + avenants |
| Customers | `#customers` | partial | fichier client encore à enrichir |
| Commercial Ops | `#commercial-ops` | current | FE-B / FE-C / FE-D livrés |
| Identity | `#identity` | partial | lecture OK, write admin encore partiel |
| Audit | `#audit` | current | FE-E livré |
| Cashbox | `#cashbox` | current | FE-F livré |
| Caution | `#caution-refund` | current | touchpoints paiements/remboursements |
| Reports | `#reports` | placeholder | décision business/légale requise |
| Catalog | `#catalog` | placeholder | pas encore de workflow approuvé |
| Procurement | `#procurement` | placeholder | pas encore de contrat approuvé |
| HR | `#hr` | placeholder | hors priorité ERP actuelle |
| Help | `#help` | placeholder | aide opérateur non contractualisée |

---

## Gaps frontend restants

Les vrais gaps post-FE-J sont:

- `reservation detail` dédié
- `new reservation wizard`
- confirmation Titan complète
- planning/calendar → livré (weekly table via F180D1); calendrier enrichi repoussé
- client file enrichi
- reports/exports après décision métier/légale
- complétion admin/settings
- QA visuelle élargie mobile/tablet/light-dark/logo

---

## Bundle recommandé

Bundle recommandé après F178B:

- **FE-K — Reservation detail, reservation wizard, and Titan confirmation UX**

---
*Fin de l’arborescence cible*
