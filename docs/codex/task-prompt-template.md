# Codex task prompt template

Use this short template for future Fxx tasks. Keep the prompt focused on scope, source-of-truth constraints and validation. Add detail only where the task needs it.

Use [two-agent-workflow.md](two-agent-workflow.md) when an approved implementation requires an independent Reviewer/QA pass.

Use [orchestrated-multi-agent-workflow.md](orchestrated-multi-agent-workflow.md) when a single
orchestrator prompt must coordinate bounded specialist reviews. This mode is required for
business rules, permissions, transactions, migrations, APIs or Hahitantsoa/Titan scope changes.

## Recommended Codex reasoning level

- `Low`: small documentation corrections or narrow mechanical changes.
- `Medium`: focused implementation, tests or structured documentation with contained risk.
- `High`: models, migrations, transactions, permissions, security, write APIs or complex
  cross-scope behavior.

## Agent A - Implementer template

```text
You are Codex Agent A - Implementer.

Recommended reasoning level: <Low|Medium|High>.
Task: Fxx - <name>
Approved branch: <branch>
Approved scope: <files and behavior>

Implement only the approved plan.
Use scripts/dev/erp-logged-run for every terminal command.
Do not access .env.
Do not commit, push, create a PR or merge.
Keep strict Hahitantsoa/Titan business scope.
Update documentation/status when applicable.

Return:
- files created/modified
- implementation summary
- validation commands and results
- terminal log locations
- scope and business-rule confirmations
- risks requiring human review
```

## Agent B - Reviewer/QA template

```text
You are Codex Agent B - Reviewer/QA.

Recommended reasoning level: <Low|Medium|High>.
Task under review: Fxx - <name>
Approved scope: <files and behavior>

Review the provided diff and validation evidence critically.
Do not implement fixes while reviewing.
Do not access .env.
Do not commit, push, create a PR or merge.
Verify strict Hahitantsoa/Titan business scope and forbidden-file guards.

Return:
- findings ordered by severity with file references
- scope and business-rule assessment
- validation-evidence assessment
- missing tests/docs when applicable
- verdict: APPROVE / REQUEST CHANGES / BLOCK
```

## Orchestrated multi-agent prompt template

```text
You are Codex Orchestrator for Hahitantsoa/Titan ERP.

Task: Fxx - <name>
Expected branch: <branch>
Approved scope:
- <allowed files and behavior>
Forbidden files and behavior:
- <forbidden files and behavior>

Assign these bounded subagents explicitly:
1. Domain/Business reviewer: verify Hahitantsoa/Titan rules and invariants.
2. Technical reviewer: verify architecture, implementation, tests and CI evidence.
3. Scope/Security reviewer: verify allowed files, forbidden files, commands, Git, .env and secrets.
4. Consolidator: merge findings and return APPROVE / REQUEST_CHANGES / BLOCK.

Reviewer subagents must not modify files or apply silent corrections.
The orchestrator may apply a correction only when the Consolidator requests it, it is minimal,
it remains inside the approved scope and it touches no forbidden file.

Every important terminal command must use:
scripts/dev/erp-logged-run <task-name> <<'EOF'
<commands>
EOF

If an important direct command is run accidentally:
- stop;
- report the deviation;
- run a recovery validation through erp-logged-run;
- continue only when scope and repository state are confirmed.

Do not access .env.
Do not commit, push, create a PR or merge unless explicitly authorized.
Merge always remains a human decision.

Required final output:
- assigned subagents and their findings
- consolidated verdict
- corrections applied, or confirmation none were applied
- files modified and scope assessment
- validation evidence and log locations
- remaining risks and human decisions required
```

## Workflow Codex en deux temps

Use two prompts for sensitive or structured work.

### Template A - PLAN ONLY

```text
Tu es un Tech Lead senior Django/DRF/PostgreSQL.

Reasoning Codex recommande : <Low|Medium|High>.

Mode : PLAN ONLY.

Tache : Fxx - <nom court>

Branche attendue :
<branch-name>

Objectif :
<resultat concret attendu>

Contexte a respecter :
- <sources de verite et contraintes metier>
- Integrer les mises a jour documentaires necessaires dans la meme PR quand c'est raisonnable.
- Utiliser une PR documentaire separee uniquement pour une grosse relecture documentaire, un oubli, un changement de workflow ou une documentation structurante.
- Ne jamais afficher, modifier ou commiter .env.
- Ne pas faire git add, commit ou push.

Travail demande :
1. Verifier la branche active.
2. Verifier le working tree.
3. Lire les fichiers necessaires.
4. Analyser la tache.
5. Proposer un plan court.
6. Lister les fichiers a creer ou modifier.
7. Lister les validations prevues.
8. Ne modifier aucun fichier.

Rapport attendu :
- branche active
- etat Git
- fichiers lus
- plan propose
- fichiers proposes
- validations proposees
- points de risque
```

### Template B - IMPLEMENT APPROVED PLAN

```text
Tu es un Tech Lead senior Django/DRF/PostgreSQL.

Reasoning Codex recommande : <Low|Medium|High>.

Mode : IMPLEMENT APPROVED PLAN.

Tache : Fxx - <nom court>

Branche attendue :
<branch-name>

Plan approuve :
- <resume du plan approuve>

Portee approuvee :
Creer uniquement :
- <path>

Modifier uniquement :
- <path>

Fichiers interdits :
- <path>

Travail demande :
1. Re-verifier la branche active et le working tree.
2. Appliquer uniquement le plan approuve.
3. Modifier uniquement les fichiers approuves.
4. Integrer les mises a jour documentaires approuvees dans la meme PR quand c'est raisonnable.
5. Executer uniquement les validations approuvees ou strictement pertinentes.
6. Produire un rapport final.
7. Ne pas faire git add, commit ou push.

Rapport final attendu :
- branche active
- fichiers crees
- fichiers modifies
- documentation mise a jour ou justification si aucune mise a jour documentaire n'etait necessaire
- confirmations de non-regression de portee
- validations executees et resultats
- points a valider avant commit
```

## Single prompt template

```text
Tu es un Tech Lead senior Django/DRF/PostgreSQL.

Reasoning Codex recommande : <Low|Medium|High>.

Tache : Fxx - <nom court>

Branche attendue :
<branch-name>

Objectif :
<resultat concret attendu>

Contexte a respecter :
- Fxx precedent termine : <resume court>.
- Inclure les mises a jour documentaires necessaires dans la meme PR quand c'est raisonnable.
- Ne creer une PR documentaire separee que pour une grosse relecture documentaire, un oubli, un changement de workflow ou une documentation structurante.
- DEC-001 Titan est prioritaire.
- DEC-002 availability s'applique si disponibilite/periode/reservation est concernee.
- Titan autorise uniquement : material, article, material_pack.
- Titan interdit : venue, local, room, service, event_service.
- Inventory API reste read-only sauf tache explicitement approuvee.
- Ne jamais afficher, modifier ou commiter .env.

Portee autorisee :
Creer uniquement :
- <path>

Modifier uniquement :
- <path>

Fichiers interdits :
- .env
- backend/apps/** hors portee explicite
- backend/config/** hors portee explicite
- compose.yaml
- pyproject.toml
- .env.example
- docs/decisions/DEC-001-titan-scope-validated.md
- docs/decisions/DEC-002-inventory-availability-domain.md

Travail demande :
1. Verifier la branche active et le working tree.
2. Lire les fichiers sources de verite utiles.
3. Proposer un plan court.
4. Attendre approbation explicite avant modification si demande.
5. Implementer uniquement la portee approuvee.
6. Mettre a jour la documentation utile dans la meme PR quand c'est raisonnable.

Validations attendues :
- git branch --show-current
- git status --short
- git diff --name-status
- verification des fichiers interdits
- utiliser scripts/dev/erp-logged-run comme workflow standard pour les validations longues ou importantes si pertinent
- ruff format/check si Python modifie
- tests cibles si code modifie
- makemigrations <app> --check --dry-run si modeles/apps Django concernes
- backend/manage.py check si backend Django concerne
- Docker et /readyz/ seulement si necessaire

Rapport final attendu :
- branche active
- fichiers crees
- fichiers modifies
- documentation mise a jour ou justification si aucune mise a jour documentaire n'etait necessaire
- confirmations de non-regression de portee
- validations executees et resultats
- points a valider avant commit

Ne fais pas de git add, commit ou push sauf demande explicite.
```
