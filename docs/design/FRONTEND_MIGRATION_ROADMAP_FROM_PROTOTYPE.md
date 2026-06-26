# Roadmap de migration frontend depuis le prototype

> Version: F178B — 2026-06-25

## 1. Etat des bundles historiques

Bundles deja completes sur `main`:

1. FE-B0 — app shell, architecture de marque, fondation light/dark
2. FE-B — logistics / returns / damage-loss / stock operations surfaces
3. FE-B0R — shell/theme/brand visual fidelity polish
4. FE-C — billing / cashbox touchpoints / credit note operator UI
5. FE-D — document workflow et PDF trigger
6. FE-E — audit log viewer
7. FE-F — cashbox sessions
8. FE-G — customer file and reservation redesign pass
9. FE-H — dashboard and navigation shell redesign
10. FE-I — reports/exports placeholders and gates
11. FE-J — responsive / accessibility / dark-mode polish

Ces bundles ne doivent plus etre planifies comme travail futur.

## 2. Roadmap restante recommandee

### FE-K — Reservation detail, reservation wizard, and Titan confirmation UX

- priorite: haute
- objectif: fermer le plus gros ecart fonctionnel/prototype restant
- cibles: `AvailabilityPanel.tsx`, nouvelles surfaces detail/wizard, eventuel raffinage `HahitantsoaEventDraftsPanel.tsx`
- prerequis: aucun changement backend non autorise

### FE-L — Planning / calendar (livré dans F180D1)

- **livré** — `PlanningPanel.tsx` déployé via F180D1 (PR #438)
- statut: weekly table avec filtres Titan/HAH, navigation semaine, scope tags, durée, nombre de ressources
- vue calendrier enrichie (mois/agenda) repoussée si contrat approuvé

### FE-M — Enriched client file and cross-linked commercial history

- priorite: moyenne
- objectif: enrichir `CustomerPanel.tsx` detail avec liens billing/logistics/docs/payments

### FE-N — Settings / admin completion

- priorite: moyenne
- objectif: aller au-dela du `IdentityPanel.tsx` actuel si contrats admin confirms

### FE-O — Reports / exports after business and legal decisions

- priorite: conditionnelle
- objectif: remplacer le placeholder `#reports`
- hard stop: aucun format legal/export ne doit etre invente

### FE-P — Prototype fidelity QA and visual convergence pass

- priorite: transverse
- objectif: verifier shell, cards, badges, tables, dark mode, mobile/tablet, logos

## 3. Regle de depart

Avant toute nouvelle tache frontend:

- lire F178A
- lire F178B
- verifier que le bundle vise un vrai gap restant et non un bundle deja merge

---
*Fin de la roadmap de migration*
