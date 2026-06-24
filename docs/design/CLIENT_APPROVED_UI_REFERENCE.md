# Reference UI client approuvee

> Version: F177A - 2026-06-24

## Statut

Prototype 4 est la reference visuelle et de navigation approuvee par le client pour
le redesign frontend ERP.

## Artefact prototype

- Fichier reel present dans le repo:
  `docs/design/prototypes/client-approved/ERP Hahitantsoa - Prototype 4.html`
- Le chemin attendu par le brief
  `docs/design/prototypes/client-approved/ERP_Hahitantsoa_Prototype_4.html`
  n'existe pas actuellement.
- Pour F177A, le fichier HTML reel ci-dessus fait foi comme artefact Prototype 4.

## Portee autorisee

La migration React doit extraire du prototype:

- structure de navigation
- shell sidebar / topbar / content
- page IDs et sections
- composants UI
- tokens et palettes
- patterns de cartes, tableaux, formulaires, badges, timelines, kanban, aides
- responsive mobile/tablette
- attentes d'accessibilite
- regles light/dark

## Portee interdite

- Le prototype HTML n'est pas du code de production React.
- Ne pas copier-coller le HTML statique dans `frontend/`.
- Ne pas copier les scripts inline comme implementation produit.
- Ne pas traiter les donnees de demonstration du prototype comme des contrats backend.

## Priorite des sources

1. Backend/API contracts et Document A/B pour les comportements et donnees.
2. Cartographie F176A pour la structure applicative et les workflows.
3. Prototype 4 pour le style visuel, le shell, la navigation et la presentation UX.
4. Architecture de marque pour l'usage Ergon / Hahitantsoa / Titan.
5. Contrat light/dark pour les tokens thematiques.
6. React actuel pour l'etat technique existant et les points de migration.

## Regle frontend

Avant toute implementation frontend, les agents doivent consulter:

- `docs/architecture/application-map/README.md`
- `docs/architecture/application-map/FRONTEND_MAP.md`
- `docs/architecture/application-map/API_AND_DATA_FLOW_MAP.md`
- `docs/architecture/application-map/NAVIGATION_TREE_TARGET.md`
- `docs/design/brand/BRAND_ARCHITECTURE.md`
- `docs/design/CLIENT_APPROVED_UI_REFERENCE.md`
- `docs/design/UI_MIGRATION_CONTRACT.md`
- `docs/design/THEME_AND_DARK_MODE_CONTRACT.md`
- `docs/design/FRONTEND_PROTOTYPE_GAP_ANALYSIS.md`
- `docs/design/FRONTEND_MIGRATION_ROADMAP_FROM_PROTOTYPE.md`
- `docs/design/DESIGN.md`

## Autorites complementaires

- Le backend/API reste autoritaire sur le comportement des ecrans.
- La cartographie F176A reste autoritaire sur la carte applicative.
- FE-A reste autoritaire sur les regles de permission-aware UX gating deja integrees.
