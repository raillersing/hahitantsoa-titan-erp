# Copilot instructions - Hahitantsoa / Titan ERP

Copilot et les agents VS Code doivent suivre le workflow multi-agent strict du projet.

- Travailler uniquement sur le périmètre de tâche explicitement approuvé.
- Une branche par tâche, une PR par tranche.
- Ne jamais merger une PR.
- Utiliser `scripts/dev/erp-logged-run` pour chaque commande terminale de validation.
- Toute commande terminale importante doit passer par `scripts/dev/erp-logged-run`; ne pas lancer directement `git`, `gh`, `pytest`, `npm`, `ruff`, `docker` ou scripts de validation sans journalisation.
- Ne pas lire, afficher, sourcer, inspecter ou modifier `.env`.
- Ne pas exposer de secrets, de tokens, de cookies ou de clés API.
- Ne pas modifier le backend ou le frontend hors périmètre expressément autorisé.
- Valider localement avant push si cela est applicable.
- Vérifier que la CI GitHub passe avant de proposer un merge.
- Respecter Titan : seuls `material`, `article` et `material_pack` sont autorisés ; jamais local, salle, lieu, service, event_service.
- Pour toute tâche touchant règles métier, permissions, transactions, migrations, APIs ou scope Hahitantsoa/Titan, utiliser le mode orchestrateur multi-agents décrit dans `docs/codex/orchestrated-multi-agent-workflow.md`.
- Dans ce mode, assigner explicitement les sous-agents Domaine/Métier, Technique, Scope/Sécurité et Consolidateur ; les reviewers ne corrigent jamais silencieusement et le verdict consolidé est obligatoire.
- L'orchestrateur ne peut appliquer que les corrections minimales demandées par le Consolidateur et comprises dans le scope approuvé.
- En cas de doute, s'arrêter et demander au superviseur humain.

Voir AGENTS.md pour les règles complètes et docs/ai-agents/F113_AGENT_WORKFLOW_INVENTORY.md pour l’inventaire workflow.
