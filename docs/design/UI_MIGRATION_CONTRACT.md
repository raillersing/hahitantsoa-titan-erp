# Contrat de migration UI React depuis le prototype

> Version: F177A - 2026-06-24
> Sources: Prototype 4, cartographie F176A, DESIGN.md, frontend live, FE-A

## Objectif

Traduire le prototype client approuve en contrat de migration React ecran par ecran,
sans reutiliser le HTML statique comme code produit.

## Lecture du prototype

Elements confirmes:

- Typographie prototype: `Inter` via Google Fonts.
- Palettes scopees:
  - Hahitantsoa: teal `hah-50..900`, principal `#14b8a6`, fonces `#0d9488`, `#0f766e`
  - Titan: indigo `tit-50..900`, principal `#6366f1`, fonces `#4f46e5`, `#4338ca`
- Fond principal clair: `bg-slate-50`, surfaces `bg-white`, sidebar `bg-slate-900`.
- Navigation cible riche en sidebar avec topbar, quick actions, badges de scope.
- Pages prototype detectees:
  `dashboard`, `login`, `calendar`, `clients`, `client-file`, `appointments`,
  `reservations-hah`, `reservations-titan`, `reservation-new`,
  `reservation-detail`, `inventory`, `inventory-import`, `logistics`, `returns`,
  `damage`, `catalog`, `venues`, `documents`, `billing`, `cashbox`, `hr`,
  `hr-payroll`, `procurement`, `notifications`, `reports`, `admin`, `audit`,
  `mobile`, `help`.

## Typographie

| Element | Valeur extraite | Source | Usage React cible |
|---|---|---|---|
| Police principale | `Inter` | Prototype | Shell, titres, labels, tableaux |
| Poids titre | `700-800` | Prototype | Page title, cards, section headers |
| Labels utilitaires | uppercase compact | Prototype | Eyebrow, table headers, badges |
| Police actuelle | `IBM Plex Sans` | React actuel | Etat existant a migrer |

Decision:

- La base visuelle cible suit le prototype.
- Le passage d'`IBM Plex Sans` vers `Inter` doit etre traite comme une migration UI,
  pas comme un simple detail cosmetique.

## Families de couleurs

| Famille | Valeur / direction | Source | Usage |
|---|---|---|---|
| Hahitantsoa | teal (`#14b8a6`, `#0d9488`, `#0f766e`) | Prototype | Event/full-service, badges, charts, CTA scope Hahitantsoa |
| Titan | indigo (`#6366f1`, `#4f46e5`, `#4338ca`) | Prototype | Rental/material, badges, charts, CTA scope Titan |
| Ergon parent | Non confirme | Non confirme | Indication shell corporate uniquement, a ne pas inventer |
| Neutres | Slate/white surfaces | Prototype | Shell, sidebar, tableaux, formulaires |

## Couleurs semantiques

| Usage | Light cible | Dark cible | Source | Note |
|---|---|---|---|---|
| Success | vert doux / texte vert fonce | vert lisible sur surface sombre | Prototype | deja visible dans badges et trends |
| Warning | amber doux / texte amber fonce | amber lisible sur surface sombre | Prototype | utilise pour alertes et risques |
| Danger | rouge doux / texte rouge fonce | rouge lisible sur surface sombre | Prototype | utilise pour refus / casse |
| Info | bleu doux / texte bleu fonce | bleu lisible sur surface sombre | Prototype | utilise pour actions / infos |
| Denied / read-only | gris ou amber faible + texte explicite | gris plus clair + texte explicite | Prototype + FE-A | la couleur seule ne suffit pas |

## Table de tokens

| Token | Valeur extraite | Light cible | Dark cible | Source | Usage React |
|---|---|---|---|---|---|
| `--font-sans` | `Inter, sans-serif` | idem | idem | Prototype | police globale |
| `--color-bg-app` | `slate-50` | `#f8fafc` | `#0f172a` | Prototype | fond global |
| `--color-bg-sidebar` | `slate-900` | `#0f172a` | `#020617` | Prototype | sidebar |
| `--color-surface` | `white` | `#ffffff` | `#111827` | Prototype | cards, tables, forms |
| `--color-surface-elevated` | Non confirme | `#ffffff` | `#1f2937` | Non confirme | modals, popovers |
| `--color-border` | `slate-100/200` | `#e2e8f0` | `#334155` | Prototype | separations |
| `--color-text-primary` | `slate-800` | `#1e293b` | `#f8fafc` | Prototype | texte principal |
| `--color-text-secondary` | `slate-500/600` | `#64748b` | `#94a3b8` | Prototype | texte secondaire |
| `--color-brand-hah` | `#14b8a6` | idem | version plus claire si necessaire | Prototype | scope Hahitantsoa |
| `--color-brand-titan` | `#6366f1` | idem | version plus claire si necessaire | Prototype | scope Titan |
| `--color-brand-ergon` | Non confirme | Non confirme | Non confirme | Non confirme | shell corporate futur |
| `--color-focus-ring` | `rgba(20,184,166,.4)` | idem ou accessible equivalent | accessible equivalent | Prototype | focus visible |
| `--radius-card` | `1rem-1.25rem` | idem | idem | Prototype | cartes et panels |
| `--shadow-card` | douce, large | idem | plus dense mais propre | Prototype | elevational hierarchy |

## Shell applicatif cible

- Sidebar gauche persistante sur desktop.
- Topbar haute avec titre de page, indicateur de scope, notifications/messages et
  quick actions.
- Content area scrollable avec page header et action bar explicites.
- Le shell doit supporter:
  - identite globale Ergon
  - indicateurs de scope Hahitantsoa/Titan
  - navigation filtree par role
  - quick actions dashboard
  - gating FE-A sur les controles write

## Patterns UI a migrer

### Badges et scope indicators

- Pills scopees Hahitantsoa/Titan visibles dans sidebar, cartes, listes et titres.
- Badges `success/warning/danger/info/read-only`.
- Les badges doivent toujours etre accompagnes d'un libelle textuel explicite.

### Tableaux

- En-tetes fins uppercase, lignes hover, actions de ligne discretes.
- Colonnes prioritaires: statut, reference, client, periode, montant, acteur.
- Lignes read-only actuelles peuvent etre migrees vers tables prototype sans changer
  les donnees backend.

### Cartes

- Cards blanches a coins larges avec ombre legere.
- Dashboard: cartes KPI actionnables, pas purement decoratives.
- Detail pages: cartes resume, timeline, recap metier.

### Stepper / timeline

- Stepper horizontal pour creation / confirmation / logistique / cloture.
- Timeline verticale pour historiques et audit.
- Les etapes ne doivent pas simuler une action backend non disponible.

### Kanban / calendar

- Prototype montre calendrier planning et kanban de travail.
- Mapping contractuel:
  - `calendar` = cible planning/disponibilite
  - kanban = cible operationnelle ou notifications
- Toute etape qui demanderait un nouveau backend reste future ou read-only.

### Formulaires

- Grilles lisibles, groupes metier, labels explicites, etats disabled/loading nets.
- Nouveaux wizards: resume + prerequis + recap de scope.
- Les formulaires doivent exposer clairement denied/read-only quand FE-A retire le write.

### Modals / drawers

- Prototype suggere overlays et surfaces elevees; le frontend live a deja un dialog
  accessible dans `PaymentWorkflowPanel.tsx`.
- Decision: utiliser modals/drawers seulement pour confirmations et actions
  secondaires, pas pour masquer l'information critique.

## Etats UX obligatoires

- Loading: skeleton ou placeholder structurel.
- Empty: expliquer absence de donnees vs filtre vide vs permission vs prerequis absent.
- Error: message actionnable + retry.
- Success: retour visible sans casser le contexte.
- Denied/read-only: badge + texte + controle desactive ou absent.

## Accessibilite

- Navigation clavier viable sur shell, tabs, tableaux, dialogs.
- Focus visible en clair et en sombre.
- Boutons et liens semantiques.
- Labels de formulaires et erreurs liees programmaticalement.
- Contraste suffisant pour texte, badges, bordures et focus.
- Couleur jamais seule pour signaler permission, erreur ou statut.

## Role-based navigation

- La navigation cible du prototype doit etre filtree selon les permissions et le scope.
- Un item de navigation peut exister visuellement mais doit devenir:
  - absent si le scope metier l'interdit,
  - visible read-only si l'utilisateur peut consulter sans ecrire,
  - actionnable si le backend et FE-A le permettent.

## Mapping prototype -> routes React cibles

| Prototype | Route React cible | Statut actuel |
|---|---|---|
| `dashboard` | `#dashboard` | current |
| `login` | auth / `LoginPanel` | current |
| `calendar` | futur `#planning` ou extension `#titan` | gap |
| `clients` | `#customers` | partial |
| `client-file` | `#customers` detail | partial |
| `appointments` | futur Hahitantsoa commercial/planning | gap |
| `reservations-hah` | `#hahitantsoa` | partial |
| `reservations-titan` | `#titan` | partial |
| `reservation-new` | futur wizard reservation | gap |
| `reservation-detail` | detail Titan/Hahitantsoa | gap |
| `inventory` | `#titan` inventory | partial |
| `inventory-import` | futur import inventory | future |
| `logistics` | `#commercial-ops` logistics | partial |
| `returns` | `#commercial-ops` returns | current UI read-only |
| `damage` | `#commercial-ops` breakage/loss | current UI read-only |
| `catalog` | futur catalog scope | future |
| `venues` | Hahitantsoa only, jamais Titan | non confirme / scope gate |
| `documents` | `#commercial-ops` documents | partial |
| `billing` | `#commercial-ops` billing + payments | partial |
| `cashbox` | futur `#cashbox` | future |
| `hr` | future | future |
| `procurement` | future | future |
| `notifications` | dashboard/global shell pattern | future |
| `reports` | futur reports | future |
| `admin` | `#identity` + params futurs | partial |
| `audit` | futur `#audit` | future |
| `mobile` | responsive contract transverse | future |
| `help` | futur help/onboarding | future |

## Mapping prototype -> composants React

| Pattern prototype | Base React existante | Cible |
|---|---|---|
| Sidebar + topbar shell | `App.tsx` | nouveau shell global |
| KPI dashboard cards | `DashboardPanel.tsx` | redesign shell + cards |
| Reservation lists | `AvailabilityPanel.tsx`, `HahitantsoaEventDraftsPanel.tsx` | listes split scopees |
| Documents tabs | `HahitantsoaCommercialOpsPanel.tsx`, `TitanDocumentsPanel.tsx`, `HahitantsoaDocumentsPanel.tsx` | cards/tables prototype |
| Payment dialog | `PaymentWorkflowPanel.tsx` | conserver accessibilite, migrer style |
| Read-only ops lists | `BillingInvoicePanel.tsx`, `LogisticsDeliveryPanel.tsx`, `ReturnsHandlingPanel.tsx`, `BreakageLossPanel.tsx`, `StockMovementLedgerPanel.tsx` | convertir vers tables/cards prototype |
| Identity tables | `IdentityPanel.tsx` | admin/audit style prototype |

## Regles de conflit

Quand prototype et cartographie divergent, classer le point:

- prototype target improvement
- existing implementation gap
- business decision needed
- non confirme
- out-of-scope visual detail
