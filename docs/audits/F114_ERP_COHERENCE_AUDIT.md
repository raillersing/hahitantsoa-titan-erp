# F114 - Audit global de cohérence ERP vs documentation finale

## 1. Métadonnées

| Champ | Valeur |
|---|---|
| Tâche | F114-8 - Audit global orchestré du projet ERP |
| Branche | `docs/f114-erp-coherence-audit` |
| Base `main` auditée | `478a7e0` |
| Commit F114 audité | `17c885a` |
| Nature | Audit-only, sans correction applicative |
| Date | 2026-06-11 |
| Livrable unique | `docs/audits/F114_ERP_COHERENCE_AUDIT.md` |

Le message du commit `17c885a` décrit une ancienne version du rapport et contient des
affirmations désormais contredites par l'audit orchestré. Il devra être amendé avant une PR,
mais F114-8 ne modifie aucun commit.

## 2. Résumé exécutif

### Niveau global de cohérence

Le dépôt fournit un **MVP de préparation partiellement cohérent**, mais pas encore un ERP
opérationnel complet. Le score estimatif pondéré de complétude par rapport à l'ERP cible est de
**28,2 %**.

### Principales conformités confirmées

- Les kinds inventory Titan de premier niveau sont limités à `material`, `article` et
  `material_pack` par le modèle, la contrainte DB, les serializers, les selectors et les tests.
- Les périodes de disponibilité imposent `end_at > start_at` et utilisent des intervalles
  demi-ouverts `[start_at, end_at)`.
- Les réservations persistées sont uniquement des brouillons `draft`; leur création ne confirme
  rien et ne bloque pas inventory.
- La preview proforma expose explicitement l'absence de confirmation, paiement, facture,
  contrat et blocage inventory.
- Hahitantsoa et Titan disposent de surfaces frontend et backend distinctes.
- Le workflow CI est configuré pour Ruff, pytest, Vitest et le build frontend.
- Le workflow agents F115A documente l'orchestration multi-agents, le wrapper terminal et le
  merge humain.

### Principaux écarts confirmés

- Aucun workflow de confirmation transactionnelle, contrat signé, acompte ou allocation
  cross-scope n'existe.
- Les écritures frontend de brouillons n'envoient pas de jeton CSRF et les erreurs API métier
  sont remplacées par un message générique.
- Contrats, paiements, caisse, logistique, audit actif, documents sensibles, stock, achats et
  Hahitantsoa complete-event ne sont pas implémentés.
- La cible Python documentée est 3.13, tandis que le projet et la CI exigent Python 3.14.
- Les tests E2E, seuils de couverture, contrôles de dérive migrations et plusieurs outils qualité
  cibles sont absents.

### Risques prioritaires

1. Accès authentifié actuellement large sans matrice métier ou data scoping approuvé.
2. Absence d'audit et d'attribution fiable des écritures actuelles.
3. Sémantique non définie des périodes de disponibilité soft-deleted, actuellement encore
   considérées comme conflits.
4. Future double allocation si une confirmation est ajoutée sans service transactionnel.
5. Confusion possible entre `reserved` technique et réservation confirmée.

### Ordre recommandé des futures PR

Commencer par décider puis appliquer la sémantique soft-delete, définir les permissions et
sécuriser l'audit des écritures actuelles. Formaliser ensuite capacité inventory, packs, contrat
et paiement avant d'implémenter une confirmation transactionnelle et le partage
Hahitantsoa/Titan.

## 3. Sources inspectées

| Source | Chemin | Rôle dans l'audit | Statut | Remarques |
|---|---|---|---|---|
| Règles agents | `AGENTS.md` | Invariants, architecture cible, sécurité, workflow | Inspecté | Inclut INV-001 à INV-018 et workflow F115A |
| Instructions agents VS Code | `.github/copilot-instructions.md` | Scope et sécurité opérationnelle | Inspecté | Merge humain, wrapper obligatoire |
| Workflow orchestrateur | `docs/codex/orchestrated-multi-agent-workflow.md` | Méthode F114-8 | Inspecté | Rôles et consolidation appliqués |
| Règles métier | `docs/business-rules/**` | Exigences ERP par domaine | Inspecté | Scope, inventory, réservation, paiement, logistique, caisse, audit |
| Décisions | `docs/decisions/**` | Sources prioritaires Titan/Hahitantsoa | Inspecté | DEC-001, DEC-002, DEC-003 |
| ADR | `docs/adr/**` | Architecture et règles acceptées | Inspecté | Notamment ADR-003 à ADR-010 |
| Architecture | `docs/architecture/**` | Contrats et architecture cible | Inspecté | Contrats Hahitantsoa read-only et disponibilité partagée |
| Runbooks | `docs/runbooks/**` | Validation locale, CI, acceptance | Inspecté | Branch protection absente documentée |
| Backend | `backend/apps/**`, `backend/config/**` | Comportement runtime et API | Inspecté | Modèles, services, serializers, views, URLs, settings |
| Frontend | `frontend/src/**`, `frontend/package.json` | UI, appels API et contraintes visibles | Inspecté | Titan, Hahitantsoa, brouillons, disponibilité |
| Tests | `tests/backend/**`, `tests/e2e/**`, `frontend/src/*.test.tsx` | Couverture automatisée | Inspecté | `tests/e2e` ne contient qu'un `.gitkeep` |
| CI et qualité | `.github/workflows/ci.yml`, `pyproject.toml` | Gates configurés et versions | Inspecté | Contradiction Python 3.13/3.14 |
| Scripts dev | `scripts/dev/**` | Workflow local journalisé | Inspecté | `erp-logged-run`, `erp-quality-check` |
| Document A v3.4 | `docs/references/source/Document_A_CDC_Technique_Evenementiel_v3.4.pdf` | Référence technique | Non extractible localement | Fichier présent, contenu non utilisé comme preuve |
| Document B v3.4 | `docs/references/source/Document_B_Presentation_Metier_Evenementiel_v3.4.pdf` | Référence métier | Non extractible localement | Fichier présent, contenu non utilisé comme preuve |
| Guide v1.8 | `docs/references/source/Guide_Developpement_Hahitantsoa_Titan_v1.8.pdf` | Référence développement | Non extractible localement | Fichier présent, contenu non utilisé comme preuve |

## 4. Méthode d'audit

### Orchestration

F114-8 a assigné explicitement :

- Agent Domaine/Métier ;
- Agent Backend/API ;
- Agent Frontend/UI ;
- Agent Tests/CI/Qualité ;
- Agent Scope/Sécurité ;
- Agent Consolidateur.

Chaque reviewer a comparé le rapport aux fichiers réels du dépôt. Le Consolidateur a rendu
`REQUEST_CHANGES`, demandé les corrections minimales du rapport, résolu les doublons et borné
la réécriture au livrable unique.

### Commandes et validations

Les inspections importantes ont utilisé `scripts/dev/erp-logged-run` avec stdin/heredoc.
Les tâches journalisées principales sont :

- `f114-8-initial-scope` ;
- `f114-8-report-structure-gap` ;
- `f114-8-main-delta-and-source-inventory` ;
- `f114-8-targeted-evidence`.

Le reviewer Tests/CI a confirmé localement Ruff, 32 tests frontend et le build frontend. La
suite backend complète n'a pas été confirmée : 603 tests ont été collectés, 288 ont passé et
315 ont rencontré des erreurs de setup car l'hôte PostgreSQL `db` n'était pas disponible.

### Statuts utilisés

- **Conforme** : comportement confirmé par code, test ou configuration.
- **Partiel** : fondation utile présente, mais exigence incomplète.
- **Écart** : exigence documentée absente ou comportement actuel incohérent.
- **Non confirmé** : preuve insuffisante dans les sources ou validations disponibles.

### Limites

- Le contenu des trois PDF n'a pas pu être extrait localement.
- Aucun test de concurrence ou confirmation n'est possible sans implémentation correspondante.
- Une CI configurée ne prouve pas qu'un passage CI précis est vert.
- L'audit ne constitue pas une preuve de préparation production.

## 5. Matrice globale de cohérence par domaine

| Domaine | Exigence documentaire | État observé dans le dépôt | Fichiers/preuves | Statut | Sévérité | Future PR |
|---|---|---|---|---|---|---|
| Architecture projet / stack / CI | Stack ADR-003 et gates backend/frontend | Monorepo Django/React/PostgreSQL/Redis présent; Python 3.13 documenté mais 3.14 exigé; plusieurs composants cibles absents | `docs/adr/ADR-003-technical-stack.md`, `pyproject.toml`, `.github/workflows/ci.yml` | Partiel | Majeur | F119 |
| Séparation Hahitantsoa vs Titan | Scopes distincts; concepts partagés contrôlés | Surfaces distinctes; ambiguïté documentaire sur `material_pack` Hahitantsoa | `DEC-001`, `DEC-003`, `ADR-006`, contrat shared availability | Partiel | Majeur | F120 |
| Inventaire articles / matériels / packs | Titan limité aux trois kinds; packs physiques sûrs | Kinds top-level fermés; aucune composition de pack | `backend/apps/inventory/models.py`, `scope.py`, tests inventory | Partiel | Majeur | F120 |
| Disponibilité / conflits / stock | Conflits cohérents et allocation fiable | Lecture demi-ouverte; soft-deleted encore considérés comme conflits sans sémantique décidée; aucun stock/capacité/allocation | `inventory/availability.py`, `selectors.py`, `models.py` | Partiel avec UNC-002 | Majeur | F115B-F116 |
| Réservations / brouillons / proformas / confirmation | Proforma non engageant; confirmation conditionnelle et atomique | Brouillons et preview proforma présents; confirmation absente | `reservations/**`, `documents/views.py`, ADR-004 | Partiel | Bloquant | F121-F122 |
| Services annexes | Hahitantsoa peut les couvrir; Titan doit les exclure | Découverte Hahitantsoa seulement; aucun workflow service; Titan top-level les exclut | `hahitantsoa/scope.py`, inventory scope | Partiel | Majeur | F124 |
| Local / événement complet Hahitantsoa | Hahitantsoa complete-event distinct de Titan | Concepts read-only uniquement; aucun événement, lieu ou planning persistant | `DEC-003`, `backend/apps/hahitantsoa/**` | Partiel | Majeur | F124 |
| Tarification / totaux / documents commerciaux | Proformas et calculs commerciaux fiables | Registre et preview sans prix, total, PDF runtime ou document client | `backend/apps/documents/**` | Écart | Majeur | F121 |
| Contrats / paiements / statuts | Contrat signé, acompte, reçus, échéances | Aucun workflow actif | `billing/README.md`, ADR-004, règles paiement | Écart | Bloquant | F121 |
| Logistique / bons / mouvements | Sortie, livraison, retour, casse, perte | Aucun workflow actif | `logistics/README.md`, règles logistique | Écart | Majeur | F125 |
| Permissions / sécurité / documents privés | Autorisations backend et stockage privé | `IsAuthenticated` sans rôles ni data scoping documenté; documents sensibles absents | `settings.py`, views reservations/documents/customers, ADR-007/009 | Partiel avec UNC-001 | Majeur | F117-F118 |
| Audit logs / traçabilité | Actions sensibles attribuées et historisées | Champs acteur nullable non alimentés; suppression physique des lignes; aucun journal actif | `common/models.py`, `reservations/serializers.py`, `audit/README.md` | Écart | Bloquant | F118 |
| Backend API | Contrats explicites, erreurs stables, règles backend | APIs MVP présentes; permissions larges; écritures brouillon sans confirmation | `backend/config/urls.py`, serializers/views, OpenAPI tests | Partiel | Majeur | F117-F127 |
| Frontend UI | UI distincte, contraintes visibles, erreurs API claires | Surfaces MVP présentes; CSRF mutation absent; erreurs génériques; tests scope Titan partiels | `frontend/src/**` | Partiel | Majeur | F119 |
| Tests automatisés | Tests métier critiques, concurrence, E2E, quality gates | Bonne couverture foundation; aucun E2E/concurrence, aucun test de permissions métier fines/data scoping ni journal d'audit actif; suite backend non confirmée ici | `tests/**`, CI, package files | Partiel | Majeur | F119 |
| Scripts/dev / workflow agents / documentation dev | Workflow journalisé, reviews et merge humain | F115A et scripts présents; branch protection non active | `AGENTS.md`, `docs/codex/**`, `scripts/dev/**`, runbook CI | Conforme | Moyen | F121 |

### Matrice des invariants INV-001 à INV-018

| Invariant | Statut | Constat confirmé |
|---|---|---|
| INV-001 | Conforme | Preview proforma liée à un brouillon et effets engageants à `False`. |
| INV-002 | Écart | Aucun service de confirmation avec contrat, acompte et revalidation. |
| INV-003 | Écart | Aucune confirmation transactionnelle, allocation ou ligne verrouillée. |
| INV-004 | Écart | Hahitantsoa ne consomme pas encore la disponibilité partagée. |
| INV-005 | Partiel | Kinds Titan top-level fermés; composition des packs non modélisée. |
| INV-006 | Écart | Aucun contrat signé immuable ni avenant. |
| INV-007 | Écart | Aucun moyen de paiement implémenté. |
| INV-008 | Écart | Aucun paiement validé ni reçu runtime. |
| INV-009 | Écart | Aucun échéancier J-30/J-10 ni caution. |
| INV-010 | Écart | Aucun bon de sortie opérationnel. |
| INV-011 | Écart | Aucun bon de livraison opérationnel. |
| INV-012 | Écart | Aucun retour intact/cassé/manquant. |
| INV-013 | Écart | Aucun flux casse/perte/caution. |
| INV-014 | Écart | Aucun consommable, seuil, fournisseur ou bon de commande. |
| INV-015 | Écart | Aucun domaine caisse. |
| INV-016 | Partiel | Client minimal présent; aucun prospect, agenda ou conversion. |
| INV-017 | Écart | Aucun stockage ou accès contrôlé aux documents sensibles. |
| INV-018 | Écart | Aucun journal actif; attribution actuelle insuffisante. |

## 6. Écarts détaillés

### F114-GAP-001 - Confirmation de réservation absente

- **Domaine :** réservations.
- **Exigence documentaire :** INV-002, INV-003 et ADR-004 imposent contrat signé, acompte,
  revalidation et transaction atomique.
- **Observation dépôt :** `ReservationDraft` ne porte que `draft`; aucun service de
  confirmation, allocation ou verrouillage.
- **Preuves :** `backend/apps/reservations/models.py`, `services.py`, ADR-004.
- **Impact :** impossibilité de confirmer conformément aux règles et risque futur de double
  allocation.
- **Sévérité :** Bloquant.
- **Correction recommandée :** définir le contrat de confirmation, puis un service
  transactionnel testé.
- **Future PR :** F126 puis F127.

### F114-GAP-002 - Disponibilité partagée Hahitantsoa/Titan absente

- **Domaine :** cross-scope.
- **Exigence documentaire :** INV-004 et ADR-005.
- **Observation dépôt :** Hahitantsoa reste une découverte read-only sans consommation de
  disponibilité inventory.
- **Preuves :** `backend/apps/hahitantsoa/selectors.py`, contrat shared availability.
- **Impact :** aucune indisponibilité croisée exécutable.
- **Sévérité :** Majeur.
- **Correction recommandée :** implémenter le contrat read-only partagé après clarification du
  cycle de confirmation.
- **Future PR :** F128.

### F114-GAP-003 - Contrats et avenants absents

- **Domaine :** contrats.
- **Exigence documentaire :** INV-006.
- **Observation dépôt :** aucun modèle, service ou transition contrat/avenant.
- **Preuves :** `backend/apps/documents/README.md`, applications installées dans `settings.py`.
- **Impact :** aucune immutabilité après signature et aucune précondition contractuelle.
- **Sévérité :** Majeur.
- **Correction recommandée :** formaliser le domaine contrat avant la confirmation.
- **Future PR :** F124.

### F114-GAP-004 - Paiements, reçus, échéances et caution absents

- **Domaine :** billing.
- **Exigence documentaire :** INV-007 à INV-009 et INV-013.
- **Observation dépôt :** `billing` indique qu'aucun paiement, reçu, échéance ou solde n'est
  implémenté.
- **Preuves :** `backend/apps/billing/README.md`, règles billing/payments.
- **Impact :** acompte et conditions de confirmation impossibles à vérifier.
- **Sévérité :** Bloquant.
- **Correction recommandée :** concevoir les états et services paiement avant confirmation.
- **Future PR :** F125.

### F114-GAP-005 - Logistique et retours absents

- **Domaine :** logistique.
- **Exigence documentaire :** INV-010 à INV-013.
- **Observation dépôt :** aucun workflow sortie, livraison, retour, casse ou perte.
- **Preuves :** `backend/apps/logistics/README.md`, règles logistique.
- **Impact :** aucune traçabilité opérationnelle après réservation.
- **Sévérité :** Majeur.
- **Correction recommandée :** implémenter après réservation confirmée et caution.
- **Future PR :** F130.

### F114-GAP-006 - Audit, attribution et historique insuffisants

- **Domaine :** audit.
- **Exigence documentaire :** INV-018.
- **Observation dépôt :** aucun journal actif; `created_by`/`updated_by` sont nullable et non
  alimentés par les écritures de brouillon; le remplacement de lignes supprime puis recrée.
- **Preuves :** `backend/apps/common/models.py`, `reservations/serializers.py`,
  `audit/README.md`.
- **Impact :** écritures non attribuables et perte d'historique.
- **Sévérité :** Bloquant.
- **Correction recommandée :** attribuer les acteurs, préserver l'historique et introduire un
  journal d'audit avant actions sensibles.
- **Future PR :** F120.

### F114-GAP-008 - Documents sensibles non pris en charge

- **Domaine :** documents privés.
- **Exigence documentaire :** INV-017 et ADR-007.
- **Observation dépôt :** aucune gestion CIN, NIF, STAT, RCS ou justificatif privé.
- **Preuves :** `backend/apps/documents/README.md`, ADR-007.
- **Impact :** impossible d'ouvrir ce domaine sans stockage et autorisation dédiés.
- **Sévérité :** Majeur.
- **Correction recommandée :** concevoir stockage privé, permissions, conservation et audit.
- **Future PR :** après F117/F120.

### F114-GAP-009 - Composition des packs non modélisée

- **Domaine :** inventory/Titan.
- **Exigence documentaire :** INV-005 et DEC-001 interdisent tout contenu Titan hors scope.
- **Observation dépôt :** `material_pack` est un kind sans lignes de composition.
- **Preuves :** `backend/apps/inventory/models.py`, DEC-001, ADR-006.
- **Impact :** composition, disponibilité agrégée et contenu indirect interdit non vérifiables.
- **Sévérité :** Majeur.
- **Correction recommandée :** décider et tester la composition avant tout pack opérationnel.
- **Future PR :** F122 puis F123.

### F114-GAP-010 - Capacité, stock, quantités et achats absents

- **Domaine :** inventory/approvisionnement.
- **Exigence documentaire :** INV-014 et disponibilité fiable.
- **Observation dépôt :** aucun stock, unité, consommable ou fournisseur; la quantité de ligne
  brouillon est éditable frontend et persistée sans capacité inventory.
- **Preuves :** `inventory/models.py`, `reservations/models.py`, `AvailabilityPanel.tsx`.
- **Impact :** une quantité positive ne prouve pas qu'elle est disponible.
- **Sévérité :** Majeur.
- **Correction recommandée :** décider modèle capacité/unité/stock avant usage métier des
  quantités.
- **Future PR :** F122 puis F123.

### F114-GAP-011 - Hahitantsoa complete-event non implémenté

- **Domaine :** Hahitantsoa.
- **Exigence documentaire :** périmètre événement complet.
- **Observation dépôt :** endpoint et panneau de découverte read-only uniquement.
- **Preuves :** `DEC-003`, `backend/apps/hahitantsoa/**`, `HahitantsoaDiscoveryPanel.tsx`.
- **Impact :** aucun événement, local, planning ou service Hahitantsoa opérationnel.
- **Sévérité :** Majeur.
- **Correction recommandée :** ouvrir progressivement le domaine sans élargir Titan.
- **Future PR :** F129.

### F114-GAP-012 - Documents commerciaux runtime et chemins internes exposés

- **Domaine :** documents.
- **Exigence documentaire :** documents commerciaux fiables et exposition minimale.
- **Observation dépôt :** aucune génération PDF runtime ni calcul; le registre authentifié
  expose notamment `source_reference`, `template_path` et `preview_path`.
- **Preuves :** `documents/serializers.py`, `documents/views.py`, `documents/README.md`.
- **Impact :** preview non exécutable et métadonnées internes exposées.
- **Sévérité :** Majeur.
- **Correction recommandée :** revoir le contrat public avant génération documentaire runtime.
- **Future PR :** F124.

### F114-GAP-013 - Agenda prospect et conversion client absents

- **Domaine :** clients.
- **Exigence documentaire :** INV-016.
- **Observation dépôt :** modèle client minimal; aucun prospect, agenda ou conversion.
- **Preuves :** `backend/apps/customers/models.py`.
- **Impact :** cycle d'acquisition hors runtime.
- **Sévérité :** Moyen.
- **Correction recommandée :** concevoir après sécurisation des données clients.
- **Future PR :** ultérieure.

### F114-GAP-014 - Frontend ERP cible incomplet

- **Domaine :** frontend.
- **Exigence documentaire :** UI des workflows ERP approuvés.
- **Observation dépôt :** catalogue, disponibilité, brouillons et découverte seulement.
- **Preuves :** `frontend/src/App.tsx`, `AvailabilityPanel.tsx`,
  `HahitantsoaDiscoveryPanel.tsx`.
- **Impact :** UI actuelle limitée au MVP de préparation.
- **Sévérité :** Moyen.
- **Correction recommandée :** étendre uniquement après contrats backend et permissions.
- **Future PR :** selon domaines futurs.

### F114-GAP-016 - Domaine caisse absent

- **Domaine :** caisse.
- **Exigence documentaire :** INV-015.
- **Observation dépôt :** aucune application caisse installée ni workflow ouverture/mouvement/
  clôture.
- **Preuves :** `docs/business-rules/cashbox.md`, `backend/config/settings.py`.
- **Impact :** aucune caisse individualisée ni traçabilité financière.
- **Sévérité :** Majeur.
- **Correction recommandée :** concevoir après permissions, audit et paiements.
- **Future PR :** ultérieure après F121.

### F114-GAP-017 - Mutations frontend session sans CSRF

- **Domaine :** frontend/API.
- **Exigence documentaire :** sessions Django et écritures fonctionnelles sécurisées.
- **Observation dépôt :** les helpers `POST`/`PATCH` utilisent `credentials: "include"` mais
  n'envoient aucun token/header CSRF.
- **Preuves :** `frontend/src/api.ts`, configuration DRF session.
- **Impact :** créations et mises à jour de brouillon probablement refusées dans le navigateur.
- **Sévérité :** Majeur.
- **Correction recommandée :** ajouter une intégration CSRF explicite et un test intégré.
- **Future PR :** F119.

### F114-GAP-018 - Erreurs API métier masquées dans le frontend

- **Domaine :** frontend/API.
- **Exigence documentaire :** afficher clairement les refus API.
- **Observation dépôt :** toute réponse non-2xx devient
  `The requested data could not be loaded.`.
- **Preuves :** `frontend/src/api.ts`, `AGENTS.md`.
- **Impact :** utilisateur privé du motif stable du refus.
- **Sévérité :** Moyen.
- **Correction recommandée :** propager de manière sûre les erreurs structurées.
- **Future PR :** F119.

### F114-GAP-019 - Garde Titan frontend partiellement testé

- **Domaine :** frontend/tests.
- **Exigence documentaire :** le frontend Titan ne présente aucun kind interdit.
- **Observation dépôt :** types TypeScript fermés et séparation visuelle, mais pas de validation
  runtime des réponses; le test de séparation ne couvre pas tous les kinds interdits.
- **Preuves :** `frontend/src/types.ts`, `App.tsx`, `App.test.tsx`.
- **Impact :** une régression de contrat pourrait être affichée si le backend régressait.
- **Sévérité :** Moyen.
- **Correction recommandée :** ajouter des guards/tests frontend complets.
- **Future PR :** F119 ou F121.

### F114-GAP-020 - Contradiction Python 3.13 / 3.14

- **Domaine :** architecture/qualité.
- **Exigence documentaire :** ADR-003 fixe Python 3.13.
- **Observation dépôt :** `pyproject.toml`, Ruff et CI exigent Python 3.14.
- **Preuves :** ADR-003, `pyproject.toml`, `.github/workflows/ci.yml`.
- **Impact :** source de vérité technique contradictoire.
- **Sévérité :** Majeur.
- **Correction recommandée :** décider la version cible puis aligner ADR, package et CI.
- **Future PR :** F121.

### F114-GAP-021 - Couverture et quality gates cibles incomplets

- **Domaine :** tests/CI/qualité.
- **Exigence documentaire :** tests critiques et outils qualité cible.
- **Observation dépôt :** aucun E2E, seuil de couverture, contrôle migration, Black, mypy,
  ESLint, Prettier ou Playwright; aucune preuve de CI verte dans cet audit.
- **Preuves :** `tests/e2e/.gitkeep`, `pyproject.toml`, `frontend/package.json`,
  `.github/workflows/ci.yml`.
- **Impact :** régressions cross-stack, migrations et permissions insuffisamment gardées.
- **Sévérité :** Majeur.
- **Correction recommandée :** prioriser les gates utiles sans ajouter tous les outils en une
  seule PR.
- **Future PR :** F121.

## 7. Points conformes confirmés

1. Les kinds inventory Titan top-level sont fermés à `material`, `article` et
   `material_pack`.
2. Les tests backend couvrent les kinds Titan autorisés/interdits et la contrainte DB.
3. Les périodes imposent `end_at > start_at` et l'overlap demi-ouvert.
4. Les brouillons restent distincts d'une confirmation.
5. La création d'un brouillon ne crée pas d'`InventoryAvailability`.
6. La preview proforma expose tous les effets engageants à `False`.
7. Les surfaces Hahitantsoa et Titan sont distinctes.
8. Les APIs inspectées déclarent explicitement `IsAuthenticated`.
9. Le workflow CI est configuré pour Ruff, pytest, Vitest et build frontend.
10. F115A formalise les reviewers spécialisés, la consolidation, le wrapper terminal et le merge
    humain.

Ces conformités ne prouvent ni la composition sûre des packs, ni une autorisation métier fine,
ni la réussite actuelle de la CI complète.

## 8. Incertitudes restantes

- **F114-UNC-001 - Modèle d'autorisation métier non défini.** Les querysets actuels donnent un
  accès large aux utilisateurs authentifiés, mais aucune matrice de rôles, propriété ou data
  scoping n'est approuvée. F117 doit décider le modèle avant de qualifier l'accès actuel de
  conforme ou non conforme.
- **F114-UNC-002 - Sémantique soft-delete des disponibilités non définie.**
  `InventoryAvailability.is_deleted` existe, mais les conflits ne le filtrent pas. F115B doit
  décider si une période soft-deleted reste volontairement bloquante avant F116.
- Contenu exact de Document A v3.4, Document B v3.4 et Guide v1.8, non extractibles localement.
- Résistance aux courses concurrentes, aucune confirmation n'existant.
- Matrice précise de rôles et permissions attendue.
- Calculs commerciaux, taxes, numérotation, caution et règles de solde détaillées.
- Politique de conservation et stockage des documents sensibles.
- Sémantique métier exacte de `reserved` avant/après confirmation et de
  `InventoryAvailability.is_deleted`.
- Sémantique Hahitantsoa de `material_pack` : ADR-006 évoque des packs Hahitantsoa, tandis que
  le contrat shared availability le décrit Titan-only.
- Réussite de la suite backend complète et de la CI GitHub pour le commit F114.
- Comportement navigateur réel des mutations frontend tant que l'intégration CSRF n'est pas
  testée.

## 9. Rapport d'accomplissement estimé du projet

Le score est un indicateur d'audit, pas une mesure contractuelle. Il utilise :

`score global = somme(poids du domaine × score estimé) / somme des poids`

Échelle : 0 % absent; 25 % fondation non exploitable; 50 % partiel/read-only; 75 %
majoritairement implémenté; 100 % conforme et testé.

| Domaine | Poids | Score estimé | Justification courte | Preuves principales | Risques empêchant 100 % |
|---|---:|---:|---|---|---|
| Architecture projet / stack / CI | 7 | 45 % | Stack foundation active, cible incomplète et version contradictoire | ADR-003, settings, CI, pyproject | Python, async, temps réel, proxy, gates |
| Séparation Hahitantsoa vs Titan | 7 | 65 % | Surfaces et scopes distincts | DEC-001/003, scope modules, UI | ambiguïté pack, cross-scope absent |
| Inventaire articles / matériels / packs | 8 | 60 % | Catalogue et kinds fermés | inventory modèles/API/tests | composition, capacité, achats |
| Disponibilité / conflits / stock | 10 | 35 % | Lecture de conflits utile | availability/selectors/tests | soft-delete, stock, allocation |
| Réservations / brouillons / proformas / confirmation | 12 | 25 % | Brouillon et previews présents | reservations/documents/tests | confirmation et préconditions absentes |
| Services annexes | 3 | 0 % | Aucun workflow | Hahitantsoa discovery seulement | domaine absent |
| Local / événement complet Hahitantsoa | 7 | 20 % | Découverte read-only | DEC-003, Hahitantsoa API/UI | aucun planning/persistence |
| Tarification / totaux / documents commerciaux | 6 | 15 % | Registre/preview uniquement | documents app | aucun calcul/PDF runtime |
| Contrats / paiements / statuts | 13 | 0 % | Aucun workflow | billing README, ADR-004 | domaine absent |
| Logistique / bons / mouvements | 6 | 0 % | Aucun workflow | logistics README | domaine absent |
| Permissions / sécurité / documents privés | 6 | 20 % | Session et authentification de base | views, ADR-007/009 | data scoping, rôles, stockage privé |
| Audit logs / traçabilité | 4 | 10 % | Champs acteurs abstraits uniquement | common models, audit README | attribution et journal absents |
| Backend API | 4 | 50 % | APIs MVP utilisables | URLs, views, OpenAPI tests | permissions et workflows incomplets |
| Frontend UI | 3 | 35 % | MVP catalogue/disponibilité/brouillon | frontend/src | CSRF, erreurs, ERP incomplet |
| Tests automatisés | 2 | 35 % | Bonne foundation backend/frontend | tests, CI | E2E, concurrence, permissions |
| Workflow agents / scripts / documentation dev | 2 | 75 % | Workflow F115A et scripts présents | AGENTS, docs/codex, scripts/dev | branch protection et validation humaine |

**Score global calculé : 28,2 %.**

### Interprétation

- **MVP de préparation :** partiellement opérationnel pour catalogue, disponibilité read-only,
  clients read-only, brouillons et previews.
- **ERP cible :** largement incomplet pour les workflows engageants, financiers, logistiques et
  Hahitantsoa complete-event.
- **Préparation production :** non confirmée.

### Limites de l'estimation

Les poids reflètent la criticité métier documentée, pas un budget ni une durée. Les PDF non
extractibles et l'absence de validation runtime complète limitent la précision.

### Principaux leviers

1. Sécuriser disponibilité, permissions et audit actuels.
2. Aligner stack et quality gates.
3. Décider capacité inventory et composition des packs.
4. Implémenter les préconditions contrat/paiement.
5. Ajouter confirmation transactionnelle et disponibilité cross-scope.

## 10. Découpage recommandé après F114

| PR | Objectif | Fichiers/domaines ciblés | Type | Risque | Validation attendue |
|---|---|---|---|---|---|
| F115B | Décider la sémantique soft-delete des disponibilités | décisions/architecture/inventory docs | Docs | Faible | Décision explicite et cas de tests approuvés |
| F116 | Appliquer la décision soft-delete | inventory availability/selectors/tests | Backend/tests | Moyen | Tests conflits actifs/supprimés, suite inventory |
| F117 | Décider permissions et data scoping | décisions/architecture/API map | Docs | Moyen | Matrice rôles/ressources approuvée |
| F118 | Appliquer permissions et data scoping | settings, customers, drafts, documents | Backend/tests/docs | Élevé | Tests utilisateurs distincts, auth, OpenAPI |
| F119 | Corriger CSRF session et erreurs frontend | frontend API/tests, contrat erreurs | Frontend/tests | Moyen | Tests fetch CSRF, erreurs métier, build |
| F120 | Attribuer acteurs et préserver l'historique | common/reservations/audit | Backend/tests/docs | Élevé | Tests acteur, historique, audit events |
| F121 | Aligner Python et renforcer les gates utiles | ADR/pyproject/CI/tests | Docs/qualité/tests | Moyen | CI verte, migration drift, gates choisis |
| F122 | Décider capacité inventory et composition packs | décisions/architecture | Docs | Moyen | Règles capacité, quantité et packs approuvées |
| F123 | Implémenter capacité inventory et packs | inventory/reservations/tests | Backend/tests | Élevé | Tests scope packs, capacité/quantité |
| F124 | Formaliser le domaine contrat et avenant | décisions/documents | Docs | Moyen | États et immutabilité approuvés |
| F125 | Formaliser le domaine paiement et caution | décisions/billing | Docs | Moyen | États, moyens, reçus et échéances approuvés |
| F126 | Formaliser le contrat de confirmation | décisions/reservations | Docs/tests de contrat | Élevé | Préconditions INV-002/003 approuvées |
| F127 | Implémenter confirmation transactionnelle Titan | reservations/inventory/services/tests | Backend/tests | Critique | concurrence, verrouillage, rollback, audit |
| F128 | Implémenter disponibilité partagée Hahitantsoa/Titan | shared selectors/services/tests | Backend/tests/docs | Critique | tests cross-scope et double allocation |
| F129 | Ouvrir une tranche Hahitantsoa complete-event | décisions puis domaine dédié | Docs/backend/frontend/tests | Élevé | scope distinct, aucun élargissement Titan |
| F130 | Implémenter logistique et retours | logistics/documents/audit/tests | Backend/frontend/tests | Élevé | INV-010 à INV-013 |

Chaque PR doit rester petite, intégrer sa documentation et être validée humainement. La
confirmation transactionnelle ne doit pas précéder la formalisation de ses préconditions.

## 11. Conclusion

### État F114

Le rapport a été consolidé après reviews Domaine/Métier, Backend/API, Frontend/UI,
Tests/CI/Qualité et Scope/Sécurité. Les corrections demandées ont été limitées au rapport.

### Niveau de confiance

- **Élevé** pour les constats directement confirmés dans le code et les tests versionnés.
- **Moyen** pour l'évaluation globale de complétude.
- **Faible à non confirmé** pour le contenu PDF, la concurrence runtime et la préparation
  production.

### Recommandation de prochaine tranche

La prochaine tranche recommandée est **F115B - décision de sémantique soft-delete de la
disponibilité**, car elle résout une ambiguïté technique bornée avant d'ouvrir les workflows
engageants. Elle doit être suivie par F116 implémentation soft-delete, F117 décision
permissions/data scoping et F120 audit/attribution.

Le rapport est prêt pour une nouvelle review orchestrée. Le message du commit `17c885a` reste
obsolète et devra être amendé par l'humain avant PR.
