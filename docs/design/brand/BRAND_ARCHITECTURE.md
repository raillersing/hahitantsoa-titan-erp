# Architecture de marque ERP

> Version: F177A - 2026-06-24
> Portee: reference canonique de marque pour le redesign frontend ERP

## Objectif

Definir la hierarchie Ergon / Hahitantsoa / Titan Rental pour l'ERP, sans reinventer
les logos ni modifier leurs pixels. Ce document oriente uniquement l'usage produit,
les contextes d'affichage, et la lisibilite en modes clair et sombre.

## Hierarchie de marque

- Ergon est la marque parente / corporate.
- Hahitantsoa est le scope operationnel evenementiel / full-service.
- Titan Rental est le scope operationnel location pure.
- Le shell ERP peut porter l'identite Ergon comme niveau parent.
- Le contexte module, la navigation et les ecrans doivent montrer clairement
  Hahitantsoa ou Titan quand les regles metier divergent.

## Inventaire des logos dans le repo

Logos canoniques confirmes:

- `docs/design/brand/assets/ergon-logo.png`
- `docs/design/brand/assets/hahitantsoa-logo.png`
- `docs/design/brand/assets/titan-rental-logo.png`

Fichiers annexes non canoniques a ne pas versionner comme assets produit:

- `docs/design/brand/assets/LOGO-HD_ERGON.png:Zone.Identifier`
- `docs/design/brand/assets/LOGO-HD_HAHITANTSOA.png:Zone.Identifier`
- `docs/design/brand/assets/LOGO-HD_TITAN.png:Zone.Identifier`

## Regles d'usage dans l'ERP

### Ergon

- Utiliser Ergon dans le shell global si l'ecran represente l'application comme
  plateforme d'entreprise.
- Utiliser Ergon sur login, splash, titre global, aide transverse, administration
  globale et documentation produit.
- Ne pas utiliser Ergon pour masquer un workflow qui doit rester explicitement
  Hahitantsoa ou Titan.

### Hahitantsoa

- Utiliser Hahitantsoa pour les ecrans evenementiels, prospects, rendez-vous,
  dossiers evenements, documents lies aux evenements et modules full-service.
- Le contexte Hahitantsoa doit rester distinct de Titan dans les badges, titres
  de page, cartes de resume, et parcours de reservation.

### Titan Rental

- Utiliser Titan Rental pour les ecrans de location pure, inventaire materiel,
  disponibilite, sorties, retours, casse/perte, et logistique liee au materiel.
- Titan ne doit jamais etre applique a des flux Hahitantsoa incluant salle, lieu,
  local, service ou event-service.

## Regles shell / topbar / sidebar

- Sidebar et topbar: identite parent ERP possible via Ergon, avec indicateur de
  scope Hahitantsoa ou Titan visible au niveau du module actif.
- Dashboard mixte: shell parent + cartes ou badges differenciant Hahitantsoa et Titan.
- Pages modulees: le titre de page, les filtres principaux ou l'action bar doivent
  rappeler le scope metier actif.

## Regles login / splash

- Login: Ergon en marque principale si l'ecran parle de l'application ERP au sens
  global; Hahitantsoa et Titan peuvent apparaitre comme scopes operes.
- Splash / loading shell: meme regle que login.
- Si un flux futur impose une entree scopee, l'indication Hahitantsoa ou Titan doit
  etre textuelle en plus du logo.

## Fonds clairs et fonds sombres

- Fonds clairs: les trois logos PNG existants sont confirmes comme assets disponibles.
- Fonds sombres: aucune variante dediee dark n'est fournie dans le repo.
- Lisibilite sur fond sombre: Non confirme tant qu'un controle visuel et/ou des
  variantes adaptees ne sont pas valides.
- Hard stop implementation dark mode: ne pas lancer un usage logo final sur surfaces
  sombres si la lisibilite reelle n'est pas satisfaisante.

## Espacement minimum

- Respecter une zone de respiration autour des logos; ne pas coller un logo a une
  bordure, un badge, ou un fond tres charge.
- Recommandation produit initiale: au moins l'equivalent de 0.5x la hauteur du logo
  en padding visuel autour de l'actif affiche.

## Usages interdits

- Etirer ou comprimer un logo.
- Recolorer un logo sans validation explicite.
- Melanger Ergon, Hahitantsoa et Titan comme s'ils etaient interchangeables.
- Utiliser Titan pour des flux Hahitantsoa ou inversement.
- Poser un logo sur un fond qui le rend peu lisible.
- Construire de faux variants dark/light sans asset confirme.

## Points non confirmes

- Variantes officielles monochromes.
- Variantes officielles pour fond sombre.
- Minimum size exact par marque.
- Regles print ou PDF hors perimetre F177A.
