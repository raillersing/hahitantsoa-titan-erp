# F113-2 - Inventaire workflow agents

## 1. Résumé exécutif

F113-2 harmonise le workflow multi-agent existant du projet ERP Hahitantsoa/Titan. Le livrable se concentre sur la mise en cohérence des règles agents, sur un guide opérationnel pour Copilot/VS Code Agent, et sur un inventaire de la documentation workflow utilisée.

Ce document clarifie ce que les agents peuvent faire seuls, ce qui reste réservé à l'humain, et quels sont les garde-fous à appliquer pour préserver les règles métier Titan et la phase documentaire.

## 2. Inventaire des fichiers agents existants

- `AGENTS.md`
- `docs/ai/codex-only-autonomous-workflow-f89.md`
- `docs/codex/two-agent-workflow.md`
- `docs/codex/orchestrated-multi-agent-workflow.md`
- `docs/codex/reasoning-policy.md`
- `docs/codex/task-prompt-template.md`
- `docs/codex/validation-checklist.md`
- `docs/ai/templates/codex/README.md`
- `docs/ai/templates/codex/task-spec-template.md`
- `docs/ai/templates/codex/implementation-prompt-template.md`
- `docs/ai/templates/codex/review-prompt-template.md`
- `docs/ai/templates/codex/fixer-prompt-template.md`
- `docs/ai/templates/codex/pr-report-template.md`
- `.github/copilot-instructions.md` (nouveau)
- `docs/ai-agents/F113_AGENT_WORKFLOW_INVENTORY.md` (nouveau)

## 3. Inventaire des documents workflow existants

- `docs/runbooks/ci-quality-gates.md`
- `docs/runbooks/local-development.md`
- `.github/workflows/ci.yml`
- `scripts/dev/erp-logged-run`
- `docs/decisions/DEC-001-titan-scope-validated.md`
- `docs/decisions/DEC-002-inventory-availability-domain.md`
- `PLANS.md`

## 4. Synthèse des règles existantes

Les règles métier et de workflow sont déjà bien documentées :

- une tâche = une branche = une PR ;
- aucune modification hors périmètre explicite ;
- `.env` est strictement interdit ;
- Titan autorise uniquement `material`, `article` et `material_pack` ;
- Titan interdit local, salle, lieu, service, event_service ;
- `scripts/dev/erp-logged-run` est obligatoire pour les commandes terminales importantes ;
- Codex est le principal agent senior pour implementation et revue ;
- Aider et Gemini sont des outils secondaires pour des cas limités ;
- la CI GitHub est une garde-fou nécessaire, mais le merge reste manuel ;
- un plan court doit précéder les modifications sensibles.

## 5. Nouvelle méthode multi-agent automatisée

La méthode proposée harmonise Codex et Copilot/VSC Agent autour des mêmes règles :

- utiliser `AGENTS.md` comme source de vérité principale ;
- utiliser `.github/copilot-instructions.md` comme guide opérationnel succinct ;
- utiliser `docs/ai-agents/F113_AGENT_WORKFLOW_INVENTORY.md` comme inventaire et résumé ;
- appliquer un workflow à une seule branche et une seule PR par tâche ;
- limiter strictement les fichiers modifiés au périmètre autorisé ;
- exécuter les validations locales et/ou CI avant de proposer une fusion ;
- conserver le merge comme une décision humaine finale.

## 6. Ce que les agents peuvent faire seuls

- corriger et enrichir la documentation validée ;
- implémenter des modifications petites et ciblées dans des fichiers approuvés ;
- ajouter ou adapter des tests lorsque cela fait partie du périmètre ;
- exécuter des validations via `scripts/dev/erp-logged-run` ;
- traiter une correction de test échouée si elle reste dans le même périmètre et ne nécessite pas de changement d'architecture ;
- créer une branche, committer, pousser et ouvrir une PR lorsque la tâche l'autorise.

## 7. Ce qui reste réservé à l'humain

- approuver le plan et le périmètre de la tâche ;
- valider la PR et la conformité aux règles métier ;
- décider du merge ;
- vérifier les checks CI passants ;
- arbitrer les désaccords de scope ou d'architecture ;
- préparer, protéger et maintenir les secrets locaux et `.env` ;
- initier et superviser les changements d'architecture ou de migration.

## 8. Règles de correction automatique après échec de test

- la correction est autorisée seulement si elle reste dans le périmètre approuvé ;
- l'agent corrige la cause du test échoué et réexécute les mêmes validations ;
- si la correction impose des fichiers hors scope ou un changement d'architecture, l'agent s'arrête et demande une décision humaine ;
- la correction doit être minimale, ciblée et documentée ;
- aucune PR ne doit être mergée automatiquement après une correction.

## 9. Risques et garde-fous

Risques principaux :

- fuite ou accès à `.env` ou à des secrets ;
- dérive de périmètre Titan vers des éléments interdits ;
- modifications backend/frontend hors scope ;
- merge sans revue ou sans CI verte ;
- utilisation de commandes hors `scripts/dev/erp-logged-run` ;
- dépendance à une protection de branche GitHub non disponible.

Garde-fous à appliquer :

- vérifier la branche et l'état Git avant chaque tâche ;
- ne jamais fusionner sans validation humaine et CI passante ;
- vérifier les fichiers interdits dans chaque diff ;
- documenter les risques et les changements dans le PR report.

## 10. Prochaines tâches recommandées

- F114 : audit global ERP vs Document A v3.4, Document B v3.4 et Guide de développement v1.8.
- F115 : corrections backend par domaines avec focus sur les invariants métier et la transactionnalité.
- F116 : corrections frontend par domaines avec focus sur le scope Titan et l'interface utilisateur.

## 11. Règle obligatoire `erp-logged-run`

Les agents doivent exécuter toute commande terminale importante via `scripts/dev/erp-logged-run`.

Sont concernés :
- les commandes Git et GitHub CLI ;
- les validations locales ;
- les tests backend/frontend ;
- les builds ;
- les commandes de récupération après erreur ;
- les commandes utilisées comme preuve dans un rapport ou une PR.

Une commande directe non journalisée est considérée comme un écart de méthode. Dans ce cas, l'agent doit lancer immédiatement une validation de récupération journalisée avant de poursuivre.

## 12. Mode orchestrateur multi-agents F115A

F115A ajoute un mode Codex permettant de lancer une tache sensible avec un seul prompt
orchestrateur. Ce mode complete, sans remplacer, le workflow classique Agent A / Agent B.

L'orchestrateur assigne explicitement quatre roles bornes :

- **Domaine/Metier** : controle les invariants et la separation Hahitantsoa/Titan ;
- **Technique** : controle architecture, code, tests et CI ;
- **Scope/Securite** : controle fichiers autorises/interdits, commandes, Git, `.env` et secrets ;
- **Consolidateur** : fusionne les avis et rend `APPROVE`, `REQUEST_CHANGES` ou `BLOCK`.

Les agents de review n'appliquent aucune correction. Une correction par l'orchestrateur est
autorisee uniquement si elle est minimale, dans le scope approuve, hors fichiers interdits et
explicitement demandee par le Consolidateur. Le merge reste une decision humaine.

Le mode orchestrateur doit etre utilise pour les regles metier, permissions, transactions,
migrations, APIs et changements de scope Hahitantsoa/Titan. Le document operationnel et le
template de prompt sont dans `docs/codex/orchestrated-multi-agent-workflow.md`.
