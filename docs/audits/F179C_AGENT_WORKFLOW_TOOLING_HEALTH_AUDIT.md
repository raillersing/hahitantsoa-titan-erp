# F179C — Audit de santé du workflow agent, tooling et skills

> Date : 2026-06-25
> Repo : `/home/raillersing/projects/hahitantsoa-titan-erp`
> Base auditée : `main` @ `d2a32463ae5d8922ba939cf8bbb49a8aa4f60e79`
> CI `main` de référence : run `28199973139` — `success`

---

## 1. Résumé exécutif

Le workflow agent ERP et la stack tooling sont globalement sains, cohérents et
fonctionnels. Graphify et Ponytail sont complètement propagés. Les principaux
problèmes sont des défauts mineurs d'entretien : bits exécutables manquants,
SHA de queue stale, intervalle CI incohérent, et verbosité de certains docs.

**Verdict :** FE-K peut démarrer sans risque. Les correctifs mineurs listés
dans ce rapport peuvent être appliqués dans la même PR d'audit ou dans un
suivi rapide.

---

## 2. Fichiers inspectés (35 fichiers)

- `AGENTS.md`, `.github/copilot-instructions.md`, `CLAUDE.md`,
  `.claude/settings.json`, `opencode.json`
- `.opencode/` (4 agents, 3 commandes)
- `docs/ai-agents/README.md`, `AI_ORCHESTRATION_INDEX.md`,
  `agent-command-runbook.md`, `orchestrator-task-queue.md`
- `docs/ai-agents/prompt-contracts/` (6 contrats)
- `docs/ai-agents/tooling/` (9 docs)
- `docs/architecture/application-map/README.md`, `FRONTEND_MAP.md`,
  `NAVIGATION_TREE_TARGET.md`, `API_AND_DATA_FLOW_MAP.md`
- `docs/design/` (6 fichiers + `brand/`)
- `scripts/dev/` (24 wrappers)
- `graphify-out/GRAPH_REPORT.md`
- `.agents/skills/` (30 skills)

---

## 3. Évaluation détaillée

### 3.1 AGENTS.md

| Critère | État |
|---------|------|
| Contient Graphify ? | ✅ Oui, §"Knowledge graph consultation order" |
| Contient Ponytail ? | ✅ Oui, §"Anti-overengineering ladder (ERP Ponytail)" |
| Workflow multi-agent | ✅ Complet et à jour |
| Règles métier | ✅ Titan/HAH boundaries correctes |
| Quality gates | ✅ Complètes |
| Sources of truth | ✅ 6 niveaux de priorité |

**Classification :** KEEP

**Remarque :** 267 lignes — concis, bien structuré, document unique
d'autorité. Pas de simplification nécessaire.

---

### 3.2 .github/copilot-instructions.md

| Critère | État |
|---------|------|
| Utile ? | ✅ Oui, pour GitHub Copilot |
| Contenu dupliqué ? | ⚠️ Reprend 58 lignes de règles déjà dans AGENTS.md |
| Cohérent avec AGENTS.md ? | ✅ Oui |
| Manque Graphify ? | ⚠️ Ne mentionne pas Graphify ni Ponytail |

**Classification :** KEEP BUT SIMPLIFY

**Recommandation :** Remplacer les 58 lignes par 3 lignes référençant
AGENTS.md + l'ordre de consultation Graphify + l'échelle Ponytail.

---

### 3.3 CLAUDE.md

| Critère | État |
|---------|------|
| Contient Graphify ? | ✅ Oui, §"Knowledge graph consultation" |
| Contient Ponytail ? | ✅ Oui, §"Anti-overengineering ladder" |
| Hook policy | ✅ Claire (no unreviewed hooks) |
| Worktree/branch discipline | ✅ Complète |

**Classification :** KEEP

---

### 3.4 .claude/settings.json

| Critère | État |
|---------|------|
| Deny list | ✅ `.env`, `secrets/`, F140D audit |
| Surchargé ? | ❌ Non, juste l'essentiel |

**Classification :** KEEP

---

### 3.5 opencode.json

| Critère | État |
|---------|------|
| Instructions list | ✅ 14 docs référencés |
| Agents (4) | ✅ Bien configurés avec permissions |
| Commandes (3) | ⚠️ Voir ci-dessous |
| Plugin Ponytail | ❌ Non installé (intentionnel) |

**Classification :** KEEP

**Anomalies :**
- `pr-create` template utilise `--interval 15` mais le runbook (F151E)
  impose `--interval 30`
- `worktree-preflight` template hardcode `backend` au lieu d'être
  paramétrable

---

### 3.6 .opencode/agents/ (4 fichiers)

| Agent | Références | Classification |
|-------|-----------|----------------|
| `backend-orchestrator.md` | Graphify ✅, Ponytail ✅ | KEEP |
| `frontend-orchestrator.md` | Graphify ✅, Ponytail ✅ | KEEP |
| `docs-agent.md` | Graphify ✅, Ponytail ✅ | KEEP |
| `review-agent.md` | Niche — docs/audits only | KEEP |

**Classification :** KEEP (tous)

---

### 3.7 .opencode/commands/ (3 fichiers)

| Commande | Problème | Classification |
|----------|----------|----------------|
| `task-start.md` | Aucun | KEEP |
| `pr-create.md` | `--interval 15` → doit être `30` | **UPDATE** |
| `worktree-preflight.md` | Hardcode `backend` | **UPDATE** |

---

### 3.8 docs/ai-agents/README.md

| Critère | État |
|---------|------|
| Contenu | 145 lignes, 28+ docs listés |
| Graphify/Ponytail | ✅ Présents |
| Macro-goal docs listés | ⚠️ `macro-goal-contract.md`, `pursue-goal-contract.md`,
  `orchestrator-action-ledger.md`, `orchestrator-delegation-protocol.md` —
  rarement utilisés dans les tâches récentes |
| Exécution model | Codex-centric — toujours correct |

**Classification :** KEEP (peut être simplifié mais pas urgent)

---

### 3.9 docs/ai-agents/AI_ORCHESTRATION_INDEX.md

| Critère | État |
|---------|------|
| Canonical baseline | ✅ AGENTS.md, runbook, queue, graphify.md, ponytail.md |
| Task routing | ✅ Backend, frontend, Antigravity, OpenCode |
| Boundary rules | ✅ Claires |

**Classification :** KEEP

---

### 3.10 docs/ai-agents/agent-command-runbook.md (1 030 lignes)

| Section | Problème | Classification |
|---------|----------|----------------|
| Knowledge Graph + Ponytail | ✅ Complet | KEEP |
| Standard Task Start | ✅ Correct | KEEP |
| Backend Productivity Report | ⚠️ Très long (60+ lignes), section rapport détaillé | KEEP (utile pour les métriques) |
| PR Script Validation Patterns | ⚠️ Sections `Materialise Before Executing` et `Safe Grep` — très détaillées pour un cas rare | KEEP (utile pour la revue) |
| Docker cleanup | ✅ Complet | KEEP |
| CI Wait Policy | ✅ `--interval 30` correct | KEEP |
| Application Cartography Rule | ✅ Présente | KEEP |

**Classification :** KEEP (la longueur est justifiée — c'est le runbook
canonique qui évite de répéter les commandes dans les prompts)

---

### 3.11 docs/ai-agents/orchestrator-task-queue.md

| Problème | Détail |
|----------|--------|
| HEAD SHA stale | Document indique `de36a5f`, réel `d2a3246` |
| F179A status | Marqué "active" — en réalité mergé comme PR #427 |

**Classification :** **UPDATE** (stale)

---

### 3.12 docs/ai-agents/prompt-contracts/ (6 fichiers)

| Contrat | Lignes | Problème | Classification |
|---------|--------|----------|----------------|
| `backend-orchestrator.md` | 192 | Graphify + Ponytail ✅ | KEEP |
| `frontend-orchestrator.md` | 165 | Graphify + Ponytail ✅ | KEEP |
| `agent-prompt-procedure.md` | 561 | Très verbeux — 20+ champs obligatoires, 5 modes d'exécution, niveaux 0-4 | KEEP BUT SIMPLIFY |
| `docs-agent.md` | 67 | Correct | KEEP |
| `review-agent.md` | 69 | Correct | KEEP |
| `tools-agent.md` | 59 | Correct | KEEP |

**Remarque :** `agent-prompt-procedure.md` à 561 lignes est le plus long
contrat. Sa verbosité est partiellement justifiée (document fondateur pour la
rédaction de prompts), mais pourrait être réduite de 30% sans perte
d'information.

---

### 3.13 docs/ai-agents/tooling/ (9 fichiers)

| Doc | Problème | Classification |
|-----|----------|----------------|
| `graphify.md` | ✅ Complet, référence le wrapper | KEEP |
| `ponytail.md` | ✅ Nouveau, complet | KEEP |
| `opencode-workflow.md` | ✅ Graphify + Ponytail présents | KEEP |
| `claude-code-orchestration.md` | ✅ | KEEP |
| `antigravity-workflow.md` | ✅ | KEEP |
| `antigravity-*-capability-model.md` | ✅ | KEEP |
| `antigravity-windows-wsl-adapter.md` | ✅ | KEEP |
| `agent-shared-skills.md` | ✅ 21 skills listés | KEEP |
| `frontend-specialist-skills.md` | ✅ | KEEP |

**Classification :** KEEP (tous)

---

### 3.14 scripts/dev/ (24 wrappers)

| Problème | Détail |
|----------|--------|
| Bits exécutables manquants | **10 scripts** ont `#!/usr/bin/env bash` mais pas le bit exe |
| Scripts concernés | `erp-agent-profile-validate`, `erp-agent-task-start`,
  `erp-docker-agent-cleanup`, `erp-frontend-ci`, `erp-github-repo-rules-audit`,
  `erp-graphify-update`, `erp-pr-worktree-finalize`, `erp-secret-scan-local`,
  `erp-worktree-clean-after-merge`, `erp-worktree-list-validated` |
| Scripts OK | `erp-logged-run`, `erp-agent-scope-guard`, `erp-backend-*`,
  `erp-frontend-quality`, `erp-orchestrator-state-check`, `erp-pr-finalize-from-root`,
  `erp-quality-check`, `erp-task-queue-validate`, `erp-worktree-preflight`,
  `erp-antigravity-wsl-adapter` |

**Classification :** **UPDATE** (10 bits manquants)

---

### 3.15 Graphify integration

| Critère | État |
|---------|------|
| Documenté dans AGENTS.md ? | ✅ Oui, §"Knowledge graph consultation order" |
| Documenté dans le runbook ? | ✅ Oui |
| Documenté dans tous les entrypoints ? | ✅ Oui (CLAUDE.md, opencode-workflow.md, .opencode/agents/, prompt-contracts) |
| Doc tooling présente ? | ✅ `docs/ai-agents/tooling/graphify.md` |
| Wrapper script ? | ✅ `scripts/dev/erp-graphify-update` (mais bit exe manquant) |
| Graph généré ? | ✅ `graphify-out/` présent avec GRAPH_REPORT.md, graph.json |
| Gitignored ? | ✅ `graphify-out/` dans .gitignore |

**Classification :** KEEP (juste le bit exe à corriger)

---

### 3.16 Ponytail integration

| Critère | État |
|---------|------|
| Documenté dans AGENTS.md ? | ✅ Oui, §"Anti-overengineering ladder" |
| Documenté dans tous les entrypoints ? | ✅ Oui |
| Doc tooling présente ? | ✅ `docs/ai-agents/tooling/ponytail.md` |
| Hooks/plugins installés ? | ❌ Non (intentionnel) |
| Intensité par défaut ? | `full` |

**Classification :** KEEP

---

### 3.17 Application cartography (docs/architecture/application-map/)

| Fichier | Problème | Classification |
|---------|----------|----------------|
| `README.md` | SHA référence `5d74979` (pré-F175A) | UPDATE (cosmétique) |
| `FRONTEND_MAP.md` | SHA référence `8cde58a` (pré-F178E/F179A) | UPDATE (cosmétique) |
| `NAVIGATION_TREE_TARGET.md` | SHA référence `8cde58a` | UPDATE (cosmétique) |
| `API_AND_DATA_FLOW_MAP.md` | SHA référence `8cde58a` | UPDATE (cosmétique) |

**Classification :** UPDATE (SHA de référence seulement — le contenu est
toujours correct car les merges F178E/F179A sont docs-only, pas de code
produit modifié)

---

### 3.18 docs/design/

| Fichier | État |
|---------|------|
| `CLIENT_APPROVED_UI_REFERENCE.md` | ✅ Accurate |
| `DESIGN.md` | ✅ Canonique |
| `THEME_AND_DARK_MODE_CONTRACT.md` | ✅ Accurate |
| `FRONTEND_PROTOTYPE_GAP_ANALYSIS.md` | ⚠️ Stale (SHA `c45e...`) |
| `FRONTEND_MIGRATION_ROADMAP_FROM_PROTOTYPE.md` | ⚠️ Partiellement stale |
| `UI_MIGRATION_CONTRACT.md` | ⚠️ Partiellement stale |

**Classification :** KEEP (stale-ness déjà documentée par F178A; ne pas
réparer dans cette PR)

---

### 3.19 .agents/skills/ (30 skills)

| Critère | État |
|---------|------|
| Nombre | 30 skills — portfolio final de F151C |
| Conventions de nommage | ✅ Tous `erp-*` |
| Graphify skill ? | ❌ Pas de skill spécifique Graphify — le workflow est dans AGENTS.md |
| Ponytail skill ? | ❌ Pas de skill spécifique Ponytail — le ladder est dans AGENTS.md |

**Classification :** KEEP (aucun changement nécessaire — les skills sont
optionnels et AGENTS.md est la source d'autorité)

---

### 3.20 Stale ou dupliqué

| Item | Détail | Classification |
|------|--------|----------------|
| `.github/copilot-instructions.md` | 58 lignes dupliquées d'AGENTS.md | KEEP BUT SIMPLIFY |
| `docs/ai-agents/README.md` | 28+ docs listés, certains rarement utilisés | KEEP (pas urgent) |
| `docs/design/FRONTEND_PROTOTYPE_GAP_ANALYSIS.md` | Stale depuis F178A | Déjà documenté |
| Références OpenClaw | 2 fichiers (README.md, worktree-registry.md) | KEEP (décommission notice délibérée) |

---

### 3.21 Conflits ou risques

| Conflit potentiel | État |
|-------------------|------|
| Graphify vs Ponytail ? | ✅ Aucun — complémentaires |
| Ponytail vs backend freeze ? | ✅ Aucun — docs-only |
| Ponytail vs sécurité/tests ? | ✅ Le ladder interdit de couper security/accessibility |
| Scope guard vs nouveau scope ? | ✅ Le scope guard agent-docs couvre tous les fichiers modifiés |
| Claude Code hooks vs Ponytail ? | ✅ Aucun hook installé |
| OpenCode plugin vs Ponytail ? | ✅ Aucun plugin installé |

**Classification :** ✅ Aucun conflit ou risque détecté

---

## 4. Correctifs appliqués dans cette PR

Les correctifs suivants sont suffisamment petits et sûrs pour être inclus
dans la PR d'audit :

| # | Correctif | Fichier | Justification |
|---|-----------|---------|---------------|
| 1 | HEAD SHA → `d2a3246` | `orchestrator-task-queue.md` | Queue stale |
| 2 | F179A → merged (PR #427) | `orchestrator-task-queue.md` | Queue stale |
| 3 | `--interval 15` → `--interval 30` | `.opencode/commands/pr-create.md` | Conformité runbook F151E |
| 4 | `backend` → paramétrable | `.opencode/commands/worktree-preflight.md` | Incohérence : hardcode backend |
| 5 | Bit exe sur 10 scripts | `scripts/dev/` | Conformité runbook |
| 6 | Simplifier copilot-instructions.md | `.github/copilot-instructions.md` | 58 lignes → 5 lignes |

**Note :** Les SHA de référence dans la cartographie (`FRONTEND_MAP.md`,
`NAVIGATION_TREE_TARGET.md`) ne sont pas corrigés ici — les merges F178E/F179A
sont docs-only, donc le contenu reste valide. Le refresh SHA peut attendre.

---

## 5. Recommandations pour les tâches futures

### Priorité haute (avant FE-K)

1. Aucun — FE-K peut commencer directement.

### Priorité moyenne (prochaine fenêtre docs)

1. Simplifier `.github/copilot-instructions.md` vers un renvoi à AGENTS.md
   (5 lignes au lieu de 58).
2. Mettre à jour les SHA de référence dans `FRONTEND_MAP.md`,
   `NAVIGATION_TREE_TARGET.md`, `API_AND_DATA_FLOW_MAP.md`.
3. Envisager de réduire `agent-prompt-procedure.md` de ~30% en supprimant la
   redondance entre les sections de mode.

### Priorité basse (quand pertinent)

1. Vérifier si les docs macro-goal (`macro-goal-contract.md`,
   `pursue-goal-contract.md`, `orchestrator-action-ledger.md`) sont encore
   utilisés. Si non, les marquer comme dépréciés.
2. Envisager de scinder `agent-command-runbook.md` (1 030 lignes) en plusieurs
   fichiers thématiques (Docker, CI, PR, Backend, Frontend).

---

## 6. FE-K readiness

| Condition | État |
|-----------|------|
| Backend suffisant ? | ✅ Oui (gelé mais les endpoints réservations existent) |
| Cartographie claire sur les gaps ? | ✅ FRONTEND_MAP.md §9 liste FE-K comme gap #1-3 |
| Graphify consultable ? | ✅ Rapport présent et à jour |
| Ponytail appliqué ? | ✅ Ladder dans AGENTS.md |
| Permissions/Auth déjà en place ? | ✅ AuthContext + permission gating |
| Patterns existants à réutiliser ? | ✅ HahitantsoaEventDraftsPanel (confirmation), AvailabilityPanel (CRUD), api.ts |
| Docs stale ? | ⚠️ SHA de référence dans la cartographie (cosmétique seulement) |
| Conflits workflow ? | ✅ Aucun |

**Verdict :** ✅ FE-K peut démarrer sans risque.

---

## 7. Résumé des classifications

| Item | Classification |
|------|---------------|
| AGENTS.md | KEEP |
| .github/copilot-instructions.md | KEEP BUT SIMPLIFY |
| CLAUDE.md | KEEP |
| .claude/settings.json | KEEP |
| opencode.json | KEEP |
| .opencode/agents/ (4) | KEEP |
| .opencode/commands/pr-create.md | UPDATE |
| .opencode/commands/worktree-preflight.md | UPDATE |
| docs/ai-agents/README.md | KEEP |
| docs/ai-agents/AI_ORCHESTRATION_INDEX.md | KEEP |
| docs/ai-agents/agent-command-runbook.md | KEEP |
| docs/ai-agents/orchestrator-task-queue.md | UPDATE |
| docs/ai-agents/prompt-contracts/ (6) | KEEP (agent-prompt-procedure: KEEP BUT SIMPLIFY) |
| docs/ai-agents/tooling/ (9) | KEEP |
| scripts/dev/ (10 scripts) | UPDATE (bits exe) |
| Graphify integration | KEEP |
| Ponytail integration | KEEP |
| Application cartography | KEEP (SHA cosmetic only) |
| docs/design/ | KEEP (stale-ness known) |
| .agents/skills/ (30) | KEEP |
| OpenClaw references | KEEP (intentional decommission notices) |

---

## 8. Fichiers créés / modifiés

- **Créé :** `docs/audits/F179C_AGENT_WORKFLOW_TOOLING_HEALTH_AUDIT.md`
- **Modifiés :** voir le diff de la PR
- **Validations :** `bash scripts/dev/erp-agent-scope-guard agent-docs` — PASS
- **PR :** voir PR associée

---

*Fin du rapport d'audit*
