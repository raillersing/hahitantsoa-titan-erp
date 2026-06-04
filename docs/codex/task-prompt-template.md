# Codex task prompt template

Use this short template for future Fxx tasks. Keep the prompt focused on scope, source-of-truth constraints and validation. Add detail only where the task needs it.

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
4. Executer uniquement les validations approuvees ou strictement pertinentes.
5. Produire un rapport final.
6. Ne pas faire git add, commit ou push.

Rapport final attendu :
- branche active
- fichiers crees
- fichiers modifies
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

Validations attendues :
- git branch --show-current
- git status --short
- git diff --name-status
- verification des fichiers interdits
- utiliser scripts/dev/erp-logged-run pour les validations longues ou importantes si pertinent
- ruff format/check si Python modifie
- tests cibles si code modifie
- makemigrations <app> --check --dry-run si modeles/apps Django concernes
- backend/manage.py check si backend Django concerne
- Docker et /readyz/ seulement si necessaire

Rapport final attendu :
- branche active
- fichiers crees
- fichiers modifies
- confirmations de non-regression de portee
- validations executees et resultats
- points a valider avant commit

Ne fais pas de git add, commit ou push sauf demande explicite.
```
