# NAVIGATION_TREE_TARGET.md — Arborescence de navigation cible

> **Version:** F176A — 2026-06-24
> **Objectif:** montrer la navigation quand l'application sera complète selon Document A/B
> **Statut actuel:** certaines branches sont déjà implémentées, d'autres sont futures

---

## Principes

- Cet arbre reflète la navigation **cible** (Document A/B complété), pas uniquement
  l'implémentation actuelle.
- Chaque nœud indique son statut : `current` (implémenté), `partial` (partiel), `future` (planifié).
- Les routes cibles utilisent la convention hash-based actuelle (`#scope`) ;
  une évolution vers React Router reste possible à l'avenir.

---

## Arborescence complète

```
Hahitantsoa / Titan ERP
├── Dashboard                    #dashboard          [current]
│   └── Cartes résumé (réservations, paiements, logistique, alertes)
│
├── Planning / Disponibilité
│   ├── Résumé disponibilité     #availability-summary  [current]
│   ├── Prévisualisation par période                   [current]
│   └── Prévisualisation par article                   [current]
│
├── Réservations / Brouillons
│   ├── Brouillons Titan         #titan → AvailabilityPanel  [current]
│   │   ├── Création / édition brouillon               [current]
│   │   ├── Marquage contrat signé                     [partial]
│   │   ├── Marquage acompte reçu                     [partial]
│   │   ├── Confirmation transactionnelle               [partial — backend only]
│   │   └── Annulation                                  [partial — backend only]
│   │
│   ├── Brouillons Hahitantsoa   #hahitantsoa → HahitantsoaEventDraftsPanel  [current]
│   │   ├── Création / édition événement               [current]
│   │   ├── Prévisualisation disponibilité             [current]
│   │   ├── Préflight confirmation                      [current]
│   │   ├── Confirmation                                [current]
│   │   ├── Demandes d'avenant                          [current]
│   │   └── Préflight avenant                           [current]
│   │
│   └── Clôture commercial (closeout)
│       ├── Résumé closeout    #commercial-ops         [partial]
│       └── Exécution closeout                         [partial — backend only]
│
├── Clients / Contacts
│   ├── Liste clients            #customers → CustomerPanel  [current]
│   ├── Fiche client (CRUD)                            [current]
│   ├── Recherche avancée                              [current]
│   └── Historique commercial                          [future]
│
├── Catalogue / Articles / Packs
│   ├── Liste articles           #titan (inline)        [current]
│   ├── Détail article                                 [current]
│   └── Gestion des packs                              [future]
│
├── Inventaire / Stock
│   ├── Mouvements de stock      #titan → TitanStockMovementPanel  [current]
│   ├── Journal des mouvements   #commercial-ops → StockMovementLedgerPanel  [current]
│   ├── Seuils et alertes                               [future]
│   └── Fournisseurs / bons de commande                [future]
│
├── Logistique
│   ├── Événements logistiques   #commercial-ops → LogisticsDeliveryPanel  [current]
│   ├── Planification préparation                       [partial]
│   ├── Passation client (signature)                    [partial — backend only]
│   ├── Bon de livraison                                [partial — backend only]
│   ├── Retours            #commercial-ops → ReturnsHandlingPanel  [current]
│   │   ├── Opérations de retour                        [current]
│   │   └── Validation retour                           [partial — backend only]
│   └──
│
├── Documents commerciaux
│   ├── Templates                #titan / #hahitantsoa → DocumentsPanels  [current]
│   ├── Instances générées                             [current]
│   ├── Aperçu HTML (artifact)   #titan → DocumentArtifactPreviewPanel  [current]
│   ├── Génération PDF                                  [partial — backend only]
│   └── Administration templates par opérateur          [future]
│
├── Facturation
│   ├── Factures                 #commercial-ops → BillingInvoicePanel  [current]
│   ├── Règlements de facture                           [future]
│   ├── Annulation de facture                           [future]
│   ├── Échéanciers (J-30, J-10)                        [future]
│   ├── Avoirs (credit notes)                           [future]
│   ├── Numérotation légale                             [future]
│   └── Obligations de remboursement                    [future]
│
├── Paiements
│   ├── Liste des paiements      #commercial-ops → PaymentWorkflowPanel  [current]
│   ├── Enregistrement paiement                         [current]
│   ├── Confirmation paiement                           [current]
│   ├── Annulation / réconciliation                     [future]
│   ├── Remboursements           #caution-refund → CautionRefundPanel  [partial]
│   └── Passerelle MVola                                [future]
│
├── Caisse
│   ├── Sessions caisse                                 [future]
│   ├── Mouvements de caisse                            [future]
│   ├── Clôture et comptage                             [future]
│   └── Export justificatif                             [future]
│
├── Audit
│   ├── Journal d'événements                            [future]
│   ├── Filtres par acteur / action / période           [future]
│   └── Rapport d'intégrité                             [future]
│
├── Utilisateurs / Rôles / Permissions
│   ├── Rôles applicatifs        #identity → IdentityPanel  [current]
│   ├── Assignations de rôles                           [partial]
│   └── Permissions par endpoint                        [current — probe OPTIONS]
│
├── Rapports / Exports
│   ├── Dashboard opérationnel   #dashboard              [partial]
│   ├── Export comptable (SIE/FEC)                       [future]
│   └── Rapport de clôture commercial                    [partial — backend only]
│
└── Paramètres / Règles métier
    ├── Règles de numérotation légale                   [future]
    ├── Seuils d'inventaire                             [future]
    ├── Configuration passerelle paiement               [future]
    └── Templates de documents (admin)                  [future]
```

---

## Table des nœuds détaillée

| Nœud | Route cible | Rôles autorisés | Actions principales | Dépendances backend | Statut frontend | Source Document A/B | UI/UX notes |
|---|---|---|---|---|---|---|---|
| Dashboard | `#dashboard` | Tous authentifiés | Navigation vers modules, cartes résumé | Tous les modules | `current` | Document A | DashboardPanel avec 4 cartes |
| Titan — Inventaire | `#titan` | Tous authentifiés | Liste items, disponibilité, mouvements stock, documents | inventory, reservations | `current` | Document A | App.tsx inline + panels |
| Titan — Disponibilité | `#titan` (sous-panel) | Tous authentifiés | Créer/éditer brouillon, checker période | reservations, inventory | `current` | Document A | AvailabilityPanel |
| Titan — Stock | `#titan` (sous-panel) | `RESERVATION_SENSITIVE_OPERATOR` | Enregistrer mouvement | inventory | `current` | Document A | TitanStockMovementPanel, gating actif |
| Hahitantsoa — Découverte | `#hahitantsoa` | Tous authentifiés | Explorer concepts événement | hahitantsoa | `current` | Document A | HahitantsoaDiscoveryPanel |
| Hahitantsoa — Brouillons | `#hahitantsoa` | Tous authentifiés | CRUD + confirm + avenant | hahitantsoa, inventory | `current` | Document A | HahitantsoaEventDraftsPanel |
| Clients | `#customers` | Tous authentifiés | CRUD + recherche | customers | `current` | Document A | CustomerPanel |
| Commercial Ops | `#commercial-ops` | Tous authentifiés | Vue agrégée documents, paiements, factures, logistique, retours, casse | Tous | `current` | Document A | HahitantsoaCommercialOpsPanel |
| Commercial Ops — Documents Titan | `#commercial-ops` (onglet) | Tous authentifiés | Préparer, générer, prévisualiser | documents, reservations | `current` | Document A | TitanDocumentsPanel |
| Commercial Ops — Documents Hahitantsoa | `#commercial-ops` (onglet) | Tous authentifiés | Préparer, générer, prévisualiser | documents, hahitantsoa | `current` | Document A | HahitantsoaDocumentsPanel |
| Commercial Ops — Paiements | `#commercial-ops` (onglet) | Tous authentifiés | Créer, confirmer paiement | payments | `current` | Document A | PaymentWorkflowPanel |
| Commercial Ops — Factures | `#commercial-ops` (onglet) | Tous authentifiés | Lire factures | billing | `current` | Document A | BillingInvoicePanel (read-only) |
| Commercial Ops — Livraison | `#commercial-ops` (onglet) | Tous authentifiés | Lire événements logistiques | logistics | `current` | Document A | LogisticsDeliveryPanel (read-only) |
| Commercial Ops — Retours | `#commercial-ops` (onglet) | Tous authentifiés | Lire opérations retour | inventory | `current` | Document A | ReturnsHandlingPanel (read-only) |
| Commercial Ops — Casse/Perte | `#commercial-ops` (onglet) | Tous authentifiés | Lire règlements | inventory | `current` | Document A | BreakageLossPanel (read-only) |
| Commercial Ops — Stock Ledger | `#commercial-ops` (onglet) | Tous authentifiés | Lire mouvements stock | inventory | `current` | Document A | StockMovementLedgerPanel (read-only) |
| Identity / Rôles | `#identity` | Tous authentifiés | Lire rôles et assignations | identity | `current` | Document A | IdentityPanel (read) |
| Identity — Gestion rôles | `#identity` (onglet) | `RESERVATION_SENSITIVE_OPERATOR` | Créer/éditer/supprimer rôles | identity | `partial` | Document A | Stub "Pending Backend Contract" |
| Caution / Remboursements | `#caution-refund` | Tous authentifiés | Déposer caution, trigger remboursement | payments, inventory | `current` | Document A | CautionRefundPanel |

---

## Gaps frontend prioritaires (recommandations post-gel)

| Bundle | Gap | Statut actuel | Route concernée |
|---|---|---|---|
| **FE-A** | Permission-aware UX gating dans tous les panels write | Partial — 7 panels gatés, certains write stubs | Toutes les routes write |
| **FE-B** | Logistics operational UI (prep/handover/delivery note) | Read-only seulement | `#commercial-ops` (onglet livraison) |
| **FE-C** | Billing/cashbox/credit note operator UI | Read-only seulement | `#commercial-ops` (factures), nouvelle `#cashbox` |
| **FE-D** | PDF generation trigger + viewer | Backend ready, frontend absent | `#commercial-ops` (documents) |
| **FE-E** | Audit log viewer | Backend ready, frontend absent | Nouvelle `#audit` |
| **FE-F** | Cashbox session management | Backend ready, frontend absent | Nouvelle `#cashbox` |

---
*Fin de l'arborescence de navigation cible*
