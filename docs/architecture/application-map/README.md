# Cartographie de l'application — README

> **Version:** F176A — 2026-06-24
> **Langue de référence:** français / anglais technique
> **Statut du gel backend:** ACTIF depuis F175A (HEAD `5d74979`)

---

## Qu'est-ce que ce dossier ?

Ce dossier contient la cartographie complète de l'ERP Hahitantsoa / Titan,
versionnée et maintenue. C'est le point d'entrée obligatoire pour tout agent
(backend, frontend, UI/UX, QA, métier, infra) avant de démarrer une tâche
d'implémentation ou de maintenance.

## Comment lire les cartes

| Fichier | Public cible | Quand le consulter |
|---|---|---|
| `README.md` (ce fichier) | Tous | Avant tout parcours |
| `APPLICATION_FUNCTION_CATALOG.md` | Orchestrateur, métier, QA | Pour identifier ce qui existe vs ce qui manque |
| `BACKEND_MAP.md` | Backend-maintenance, orchestrateur | Avant toute mutation backend (gel actif !) |
| `FRONTEND_MAP.md` | Frontend, UI/UX, QA | Avant tout développement ou revue frontend |
| `API_AND_DATA_FLOW_MAP.md` | Frontend, backend-maintenance, QA | Pour comprendre les flux API et leurs dépendances |
| `NAVIGATION_TREE_TARGET.md` | Frontend, UI/UX, métier | Pour connaître l'arborescence de navigation cible |
| `AGENT_USAGE_GUIDE.md` | Tous les agents | Avant chaque tâche exécutable |
| `DIAGRAMS.md` | Tous | Pour visualiser l'architecture et les flux clés |

## Quand les agents doivent consulter cette documentation

1. **Avant tout démarrage de tâche** — l'orchestrateur doit pointer vers la
   cartographie dans le prompt d'agent.
2. **Avant toute revue de code** — le reviewer doit vérifier que la
   modification reste dans les limites de la cartographie.
3. **Après chaque PR modifiant le comportement produit, l'API, la navigation
   ou les workflows métier** — l'agent responsable doit mettre à jour la
   cartographie, ou justifier explicitement pourquoi aucune mise à jour n'est
   requise.
4. **En cas de désaccord entre la cartographie et le code live** — c'est un
   **hard stop** ; le code live l'emporte, mais la cartographie doit être
   corrigée avant de continuer.

## Référence du gel backend (F175A)

- **Verdict:** gel fonctionnel backend approuvé.
- **HEAD de référence:** `5d749792a9a369136829a945b6ea3b64a202b2e4`
- **CI main:** verte au moment du gel (run 28089063984)
- **Règle:** aucun nouveau bundle backend feature ne peut démarrer sans
  autorisation humaine explicite.
- **Ce qui reste autorisé après gel:**
  - correction de bugs backend
  - maintenance de tests backend
  - mise à jour de documentation backend
  - frontend catch-up
  - tâches docs-only (comme F176A)

## Liens vers les sources de vérité

- Document A (CDC Technique) : `docs/references/source/Document_A_CDC_Technique_Evenementiel_v3.4.pdf`
- Document B (Présentation Métier) : `docs/references/source/Document_B_Presentation_Metier_Evenementiel_v3.4.pdf`
- Guide de développement : `docs/references/source/Guide_Developpement_Hahitantsoa_Titan_v1.8.pdf`
- Règles métier : `docs/business-rules/`
- Décisions acceptées : `docs/decisions/`
- ADRs acceptés : `docs/adr/`
- Audits : `docs/audits/`
- Queue orchestrateur : `docs/ai-agents/orchestrator-task-queue.md`
- Runbook commandes : `docs/ai-agents/agent-command-runbook.md`
- Workflow agents : `docs/ai-agents/README.md`
- Design canonique : `docs/design/DESIGN.md`

## Historique des versions

| Version | Date | Description |
|---|---|---|
| F176A | 2026-06-24 | Création initiale de la cartographie complète |

---
*Fin du README*
