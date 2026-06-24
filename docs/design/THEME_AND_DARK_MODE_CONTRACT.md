# Contrat officiel theme clair / sombre

> Version: F177A - 2026-06-24

## Objectif

Definir le contrat officiel de theming light/dark pour le frontend ERP, sans
implementer le switcher dans cette tache.

## Sources

- Prototype 4
- `docs/design/brand/BRAND_ARCHITECTURE.md`
- `docs/design/DESIGN.md`
- styles React actuels
- exigences d'accessibilite

## Modes supportes

- `light`
- `dark`
- `system`

## Comportement UX cible

- Default cible initial: `system` si la base technique le permet; sinon `light`
  jusqu'a l'ajout du support `prefers-color-scheme`.
- Emplacement futur du toggle: topbar globale.
- Persistance future: stockage client explicite si le user modifie le mode.
- Fallback: si preference stockee absente ou invalide, revenir a `system`, sinon `light`.

## Guidance technique pour future tache React

- Utiliser un token map central via variables CSS.
- Structure recommandee:
  - `:root`
  - `[data-theme="light"]`
  - `[data-theme="dark"]`
- `prefers-color-scheme` peut piloter l'initialisation si aucun choix utilisateur n'existe.
- F177A ne livre aucune implementation directe.

## Categories de tokens

| Categorie | Light cible | Dark cible | Statut |
|---|---|---|---|
| Background | `#f8fafc` | `#0f172a` | confirme |
| Surface | `#ffffff` | `#111827` | confirme |
| Elevated surface | `#ffffff` | `#1f2937` | non confirme |
| Border | `#e2e8f0` | `#334155` | confirme |
| Text primary | `#1e293b` | `#f8fafc` | confirme |
| Text secondary | `#64748b` | `#94a3b8` | confirme |
| Muted text | `#94a3b8` | `#64748b` a ajuster | partiel |
| Brand primary HAH | `#14b8a6` | variante plus claire si necessaire | confirme |
| Brand primary TIT | `#6366f1` | variante plus claire si necessaire | confirme |
| Brand secondary | `#0d9488` / `#4f46e5` | variantes contrastees | partiel |
| Focus ring | teal visible | teal/neutral visible | confirme |
| Success | vert confirme | vert adapte contraste | partiel |
| Warning | amber confirme | amber adapte contraste | partiel |
| Danger | rouge confirme | rouge adapte contraste | partiel |
| Info | bleu confirme | bleu adapte contraste | partiel |
| Read-only / denied | gris + texte | gris/amber + texte | confirme |

## Exigences par surface

### Sidebar

- Light: possible seulement si la strategie shell future l'exige.
- Dark: surface dense, contrastes textes/badges verifies.
- Les badges Hahitantsoa/Titan doivent rester lisibles sur fond sombre.

### Topbar

- Doit exposer clairement titre, scope, quick actions, notifications.
- Le focus clavier doit rester visible dans les deux themes.

### Dashboard

- KPI cards, micro-charts, badges, et quick actions accessibles dans les deux themes.
- Les graphiques ne doivent pas s'appuyer uniquement sur la couleur.

### Cards / tables / forms

- Surfaces coherentes, separations visibles, textes secondaires lisibles.
- Disabled, read-only et denied distincts sans reduire le contraste sous le seuil utile.

### Modals / drawers

- Surface elevee distincte de la page.
- Overlay et focus trap a valider en implementation.

### Badges / status pills

- Variantes success/warning/danger/info/read-only dans les deux themes.
- Toujours accompagner d'un texte, icone ou libelle clair.

### Charts / metrics

- Hahitantsoa et Titan gardent leurs couleurs de scope.
- Prevoir variantes dark plus lumineuses si les barres/legendes perdent en contraste.

### Alerts / toasts / empty states / skeletons

- Etats explicites, jamais invisibles ou purement chromatiques.
- Skeletons et surfaces de chargement doivent garder une hierarchie lisible.

### Disabled buttons / permission-denied controls

- Montrer l'indisponibilite sans faire disparaitre la comprehension du flux.
- FE-A gating doit s'appliquer en clair et en sombre avec le meme sens produit.

## Logos et themes

| Cas | Asset confirme | Statut |
|---|---|---|
| Logo sur fond clair | oui, PNG existants | confirme |
| Logo sur fond sombre | aucune variante dediee fournie | Non confirme |

Decision:

- Si aucune variante dark n'est livree, les futures taches frontend doivent valider
  la lisibilite reelle avant d'utiliser les logos sur surfaces sombres.
- Hard stop si la visibilite n'est pas acceptable.

## Accessibilite

- Contraste texte: viser au moins WCAG AA.
- Contraste non texte: bordures, focus, et controles doivent rester perceptibles.
- Hover/focus/active/disabled distincts en clair et en sombre.
- Etats erreur visibles et textuellement explicites.
- La couleur seule ne suffit jamais pour signaler un etat.

## Tests attendus pour future implementation

- Test du toggle de theme.
- Test de preference persistante si implemente.
- Test du fallback `system`.
- Spot-check contraste sur shell, cards, tables, forms, badges.
- Tests DOM ou snapshots critiques sur pages majeures dans les deux themes.

## Hard stops

- Stop si la lisibilite des logos sur fond sombre n'est pas acceptable.
- Stop si les couleurs du prototype ne peuvent pas etre adaptees de facon accessible.
- Stop si les tokens dark contredisent la hierarchie de marque approuvee.
