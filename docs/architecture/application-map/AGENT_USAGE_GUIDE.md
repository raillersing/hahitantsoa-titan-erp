# AGENT_USAGE_GUIDE.md — Guide d'utilisation de la cartographie

> **Version:** F176A — 2026-06-24
> **Portée:** docs-only, read/write autorisé sur `docs/architecture/application-map/`

---

## 1. À quoi sert ce guide ?

Ce document explique comment les agents futurs (backend-maintenance, frontend,
UI/UX, décision métier, QA, infra) doivent utiliser la cartographie de
l'application pour rester alignés, éviter les chevauchements, et respecter les
limites de périmètre.

## 2. Avant chaque tâche — checklist obligatoire

L'orchestrateur doit s'assurer que le prompt d'agent contient ces étapes :

1. **Lire** `docs/architecture/application-map/README.md`
2. **Consulter** `APPLICATION_FUNCTION_CATALOG.md` pour identifier les
   fonctions concernées par la tâche
3. **Consulter** `BACKEND_MAP.md` si la tâche touche le backend
4. **Consulter** `FRONTEND_MAP.md` si la tâche touche le frontend
5. **Consulter** `API_AND_DATA_FLOW_MAP.md` pour comprendre les dépendances
   API entre frontend et backend
6. **Consulter** `NAVIGATION_TREE_TARGET.md` pour vérifier que les
   modifications de navigation restent dans l'arbre cible
7. **Consulter** `AGENT_USAGE_GUIDE.md` (ce fichier) pour les règles de mise
   à jour

## 3. Par type d'agent

### 3.1 Agent frontend (FE-A à FE-F)

**Avant de commencer:**
- Lire `FRONTEND_MAP.md` — quels écrans existent, quels sont manquants
- Lire `API_AND_DATA_FLOW_MAP.md` — quels endpoints sont déjà exposés
- Lire `NAVIGATION_TREE_TARGET.md` — quelle navigation cible Document A
- Lire `docs/design/DESIGN.md` — principes UI/UX canoniques

**Règles:**
- Ne jamais inventer un endpoint backend qui n'existe pas dans
  `BACKEND_MAP.md` sans autorisation explicite.
- Ne jamais exposer dans Titan des concepts interdits (local, salle, lieu,
  service) — voir `docs/business-rules/scope.md`.
- Tout nouvel écran doit correspondre à un nœud de
  `NAVIGATION_TREE_TARGET.md`.
- Mettre à jour `FRONTEND_MAP.md` après chaque PR frontend.

### 3.2 Agent backend-maintenance (Agent A, B, C...)

**Avant de commencer:**
- Vérifier que la tâche n'est **pas** une nouvelle feature backend — le gel
  F175A est actif.
- Lire `BACKEND_MAP.md` — quels modèles, services, endpoints existent
- Lire `APPLICATION_FUNCTION_CATALOG.md` — statut de la fonction concernée
- Lire `API_AND_DATA_FLOW_MAP.md` — quels workflows dépendent de ce code

**Règles:**
- Le gel backend interdit les nouvelles features sans autorisation humaine.
- Les corrections de bugs et maintenance de tests sont autorisées.
- Toute modification de modèle nécessite une revue de migration via
  `erp-backend-migration-guardian`.
- Ne jamais affaiblir une règle métier de priorité supérieure (DEC > ADR >
  règles métier > architecture).

### 3.3 Agent UI/UX (Agent FE-B)

**Avant de commencer:**
- Lire `NAVIGATION_TREE_TARGET.md` — structure de navigation cible
- Lire `FRONTEND_MAP.md` — écrans existants et leur état
- Lire `docs/design/DESIGN.md` — principes canoniques
- Lire `APPLICATION_FUNCTION_CATALOG.md` — fonctions planifiées pour
  identifier les écrans futurs

**Règles:**
- La navigation cible doit rester conforme à Document A/B.
- Ne pas proposer de designs qui contournent le backend gelé.
- Chaque proposition doit référencer un `function_id` du catalogue.

### 3.4 Agent décision métier

**Avant de commencer:**
- Lire `APPLICATION_FUNCTION_CATALOG.md` — état des fonctions métier
- Lire `NAVIGATION_TREE_TARGET.md` — navigation cible complète
- Lire `docs/business-rules/` — règles canoniques

**Règles:**
- Ne pas demander d'implémenter une fonction classée `Non confirmé` sans
  preuve dans Document A/B.
- Respecter la frontière Hahitantsoa / Titan (DEC-001, DEC-003).

### 3.5 Agent QA

**Avant de commencer:**
- Lire `APPLICATION_FUNCTION_CATALOG.md` — identifier les tests associés
- Lire `BACKEND_MAP.md` et `FRONTEND_MAP.md` — couverture de tests
- Lire `API_AND_DATA_FLOW_MAP.md` — workflows à tester end-to-end

**Règles:**
- Reporter les écarts entre la cartographie et le code live comme des bugs
  de documentation ou de code.
- Valider que chaque `function_id` implémenté possède des tests
  correspondants.

## 4. Comment identifier les modules autorisés / interdits

Chaque fonction du catalogue contient :
- `backend_app_files` — quels fichiers backend sont concernés
- `frontend_routes_pages` — quels écrans frontend sont concernés
- `forbidden_areas` — zones à ne jamais toucher pour cette fonction

Si une tâche implique un fichier non listé dans le catalogue pour la
fonction concernée, c'est un signal d'alerte : consulter l'orchestrateur
avant de continuer.

## 5. Comment éviter les chevauchements entre agents

- **Un agent = un worktree = une branche = un périmètre non chevauchant.**
- Vérifier `git worktree list` avant chaque tâche.
- Vérifier `gh pr list` pour connaître les PRs actives.
- Ne jamais modifier un worktree actif d'un autre agent.
- Ne jamais mélanger backend, frontend et docs dans une même branche.

## 6. Mise à jour de la cartographie après chaque PR

**Règle impérative:**

> Après chaque PR modifiant le comportement produit, l'API, la navigation ou
> les workflows métier, l'agent responsable doit **soit** mettre à jour la
> cartographie, **soit** justifier explicitement dans le rapport final
> pourquoi aucune mise à jour n'est requise.

**Processus de mise à jour:**
1. Identifier les fichiers de cartographie impactés.
2. Modifier uniquement les sections concernées.
3. Mettre à jour la date de version dans l'en-tête.
4. Ajouter une entrée dans l'historique de version de `README.md`.
5. Inclure la mention "Cartography updated" dans le corps de la PR.

## 7. Hard stops — quand la cartographie et le code live divergent

Si un agent découvre que la cartographie affirme quelque chose de faux par
rapport au code live, c'est un **hard stop** :

1. Arrêter immédiatement la tâche en cours.
2. Documenter la divergence (fichier cartographie, section, code live
   contradictoire).
3. Corriger la cartographie dans une PR docs-only dédiée, ou justifier
   explicitement si la divergence est attendue (ex: gel backend).
4. Ne jamais utiliser la cartographie obsolète comme base de décision.

## 8. Règle du gel backend après F175A

| Action | Autorisé ? |
|---|---|
| Correction de bug backend | ✅ Oui |
| Maintenance de tests backend | ✅ Oui |
| Refactoring sans changement de comportement | ⚠️ Sous réserve de revue |
| Nouvelle feature backend | ❌ Non (autorisation humaine requise) |
| Nouveau modèle / migration | ❌ Non (autorisation humaine requise) |
| Nouveau endpoint API | ❌ Non (autorisation humaine requise) |
| Frontend catch-up | ✅ Oui (bundles FE-A, FE-B, FE-C) |
| Docs-only (comme F176A) | ✅ Oui |

## 9. Références rapides

- `docs/ai-agents/orchestrator-task-queue.md` — queue des tâches actives
- `docs/ai-agents/agent-command-runbook.md` — commandes standard
- `docs/ai-agents/README.md` — workflow officiel des agents
- `docs/ai-agents/pr-quality-gates.md` — critères de qualité PR
- `docs/design/DESIGN.md` — guide UI/UX canonique
- `.agents/skills/` — skills ERP disponibles

---
*Fin du guide d'utilisation*
