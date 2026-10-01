# DEC-008 — Norme canonique de numérotation des dossiers et documents métier

Status: Accepted
Scope: Hahitantsoa & Titan ERP / Transversal
Type: Business-domain & Architecture decision
Date: 2026-10-01

## Contexte

Dans les phases antérieures du système, plusieurs formats de références hétérogènes ont coexisté
(notamment dans certains tests ou jeux d'essai : `HAH-2026-0001`, `LOC-2026-0001`, `BL-HAH-...`,
`BL-TIT-...`). Cette multiplicité génère des incohérences visuelles pour les opérateurs, affaiblit
la traçabilité contradictoire sur le terrain (livraisons, sorties, réceptions, retours, caisse) et
risque d'induire des collisions de séquences.

Cette décision formalise et verrouille la norme de numérotation canonique pour l'ensemble des
dossiers commerciaux et des documents dérivés du système.

---

## 1. Numérotation des dossiers (Références publiques invariantes)

Chaque dossier créé dans l'ERP (qu'il soit à l'état de brouillon, de proforma ou confirmé) se voit
attribuer une référence publique canonique, séquentielle, immuable et garantie sans trou par les
séquences de numérotation (`NumberingSequence`) :

- **Titan** (Location pure de matériel) :
  - Format : `T-{numéro:03d}/{année}`
  - Exemples : `T-001/2026`, `T-002/2026`, `T-003/2026`, `T-004/2026`
- **Hahitantsoa** (Événementiel complet, salle, scénographie) :
  - Format : `H-{numéro:03d}/{année}`
  - Exemples : `H-001/2026`, `H-002/2026`, `H-016/2026`

### Règle d'exclusion :
Les formats ad-hoc ou fantaisistes (`HAH-xxxx`, `LOC-xxxx`, `ED-DEMO-...`, etc.) sont
strictement interdits dans le code métier, les APIs, les migrations, les données de démonstration
et les scénarios de test.

---

## 2. Numérotation des documents dérivés (Suffixes normalisés)

Tous les documents contractuels, opérationnels et comptables rattachés à un dossier héritent
directement de sa référence canonique, suivie d'un suffixe strict en majuscules :

| Type de document | Suffixe normalisé | Exemple Titan | Exemple Hahitantsoa |
| :--- | :---: | :--- | :--- |
| **Proforma initial / révisé** | `-PF` (ou référence dossier) | `T-001/2026-PF` | `H-001/2026-PF` |
| **Contrat officiel** | `-CT` | `T-004/2026-CT` | `H-001/2026-CT` |
| **Fiche de préparation stock** | `-FP` | `T-004/2026-FP` | `H-001/2026-FP` |
| **Bon de Sortie / Bon de Livraison** | `-BL` | `T-004/2026-BL` | `H-001/2026-BL` |
| **Bon de Retour** | `-BR` | `T-004/2026-BR` | `H-001/2026-BR` |
| **Facture définitive** | `-FA` | `T-003/2026-FA` | `H-001/2026-FA` |
| **Facture de casse / réparation** | `-FC` | `T-004/2026-FC` | `H-001/2026-FC` |
| **Décharge / Restitution de caution** | `-DR` | `T-004/2026-DR` | `H-001/2026-DR` |
| **Avenant contractuel** | `-AV-{seq:02d}` | `T-001/2026-AV-01` | `H-001/2026-AV-01` |
| **Reçus de paiement / caution / solde** | `-REC-{seq:02d}` | `T-004/2026-REC-01` | `H-001/2026-REC-01` |

---

## 3. Règles d'affichage et interfaces utilisateur (UI)

1. **Pages opérationnelles spécialisées (Logistique & Inventaire)** :
   - Sur l'écran de **Sortie / Livraison (`#logistics-dispatch`)**, le document physique remis au
     client/transporteur est le **Bon de Sortie / Bon de Livraison**. La référence `BL : T-xxx/2026-BL`
     doit être l'identifiant principal mis en évidence, immédiatement accompagnée du dossier associé
     `Dossier : T-xxx/2026`.
   - Sur l'écran de **Retour / Restitution (`#logistics-returns`)**, les références de retour et de
     livraison contradictoire (`BR : ...` et `BL : ...`) doivent être clairement affichées aux côtés
     du dossier d'origine.
   - Sur l'écran de **Casse & Perte (`#breakage-loss`)**, le dossier régularisé doit afficher sa
     référence canonique `Dossier : T-xxx/2026` et le BL de départ, et non un identifiant technique
     ou un UUID tronqué.

2. **Interdiction formelle des identifiants techniques bruts** :
   - Aucun UUID brut, hash hexadécimal ou clé technique de base de données ne doit être affiché
     comme substitut de titre ou d'intitulé métier dans les interfaces opérateurs ou clients.
   - Si une référence n'est pas encore attribuée, le système affiche un état explicite
     (ex. `En cours de validation`, `Non émis`) et non un fallback sur un UUID.

---

## 4. Conformité et gouvernance

- Les modules de services [`backend/apps/common/sequences.py`](backend/apps/common/sequences.py)
  et [`backend/apps/documents/services.py`](backend/apps/documents/services.py) sont les uniques
  points d'autorité pour la génération et le formatage de ces références.
- Toute commande de peuplement ou de démonstration (`seed_complete_demo`, `seed_realistic_lifecycle_scenarios`)
  doit obligatoirement respecter cette nomenclature.
