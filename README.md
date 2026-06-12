# Hahitantsoa / Titan ERP

Ce repository contient le futur ERP evenementiel pour les activites Hahitantsoa et Titan.

Statut actuel : **Etat post-F128 roadmap - socles backend/frontend/documentaires en place, finalisation ERP encore incomplete**.

Le cadrage d'ensemble est consolide dans
[`docs/audits/F128_APPLICATION_WIDE_STATE_AND_FINALIZATION_ROADMAP.md`](docs/audits/F128_APPLICATION_WIDE_STATE_AND_FINALIZATION_ROADMAP.md).
Ce document remplace les anciens reperes MVP comme etat courant global sans effacer leur valeur
historique de preuve et d'acceptation locale.

F86/F87 restent l'historique d'acceptation locale du MVP read-only Hahitantsoa/Titan. Ce resultat
`PASS` reste conserve dans
[`docs/runbooks/mvp-integrated-local-acceptance-result.md`](docs/runbooks/mvp-integrated-local-acceptance-result.md)
et resume dans
[`docs/mvp/mvp-readonly-local-acceptance-summary.md`](docs/mvp/mvp-readonly-local-acceptance-summary.md).

Depuis F98-F102, puis les slices backend ulterieures jusqu'au roadmap F128, l'etat courant a evolue :
le repository dispose deja de socles concrets pour inventory, availability, customers, documents
registry, Hahitantsoa discovery, reservations draft-only et fondations backend de lifecycle.
Cependant, l'application n'est toujours pas production-ready : les documents runtime, les paiements,
les APIs de lifecycle finales, le RBAC, la logistique, le frontend ERP complet et le deploiement de
production restent a finaliser. Les documents MVP/read-only existants doivent donc etre lus comme
historique controle, pas comme une affirmation d'exhaustivite ou de readiness finale.

La Foundation documentaire est terminee. F4 PostgreSQL/Redis est termine et a ajoute l'infrastructure Docker Compose locale pour ces deux services.

F5 a initialise uniquement un backend Django minimal et verifiable avec Python 3.14 comme version locale de developpement Foundation.

F6 a ajoute la qualite backend minimale : Ruff, Ruff format, pytest, pytest-django et un test de demarrage Django Foundation.

F7 a durci minimalement la configuration Django Foundation : lecture centralisee des variables d'environnement, conversions booleennes strictes, listes CSV et premiers reglages de securite configurables par environnement.

F8 a ajoute un endpoint backend de sante minimal `GET /healthz/`. Ce liveness check retourne seulement `{"status": "ok"}` et ne teste pas PostgreSQL ou Redis.

F9 a ajoute un service backend Docker Compose local. Il utilise Django `runserver` uniquement pour le developpement et expose `http://127.0.0.1:8000/healthz/` apres demarrage.

F10 a ajoute un healthcheck Docker Compose au service backend pour refleter la disponibilite reelle de `/healthz/`.

F11 a valide l'application controlee des migrations Django standards en base PostgreSQL locale. Cela concerne uniquement les apps integrees `admin`, `auth`, `contenttypes` et `sessions`; ce ne sont pas des migrations metier.

F12 a ajoute un readiness endpoint PostgreSQL minimal `GET /readyz/`. `/healthz/` reste un liveness check sans acces base de donnees, tandis que `/readyz/` verifie uniquement l'acces PostgreSQL avec une requete minimale. Redis n'est pas encore teste.

F13 a ajoute une structure de packages de domaines backend sous `backend/apps/`.

F14 a active uniquement l'app Django technique `apps.common`. Les autres domaines restent des packages preparatoires non actives dans `INSTALLED_APPS`.

F15 a ajoute des modeles abstraits techniques dans `apps.common` pour preparer les futurs modeles backend. Ces modeles sont abstraits uniquement : ils ne creent aucune table, aucune migration metier et aucun modele metier Hahitantsoa/Titan.

F16 a active uniquement l'app Django `apps.inventory` pour valider le pattern AppConfig du futur domaine inventory. `inventory` ne contient encore aucun modele metier, aucune migration, aucun endpoint API metier, aucun serializer et aucun viewset.

F17 a ajoute un garde-fou pur Python dans `apps.inventory` pour formaliser les types d'elements autorises pour Titan.

F18 a ajoute le premier modele concret minimal `InventoryItem` et une migration initiale inventory controlee. `InventoryItem.kind` reste limite aux valeurs autorisees pour Titan : `material`, `article` et `material_pack`. Aucun endpoint API, serializer, view, viewset ou admin n'est cree.

F19 a ajoute des tests DB pour `InventoryItem`. Ces tests valident la persistance des valeurs autorisees, le rejet applicatif des valeurs interdites et la contrainte DB. Aucune migration nouvelle et aucun endpoint API ne sont crees.

F20 a ajoute un serializer DRF minimal pour `InventoryItem`. Il prepare la validation de la future couche API sans creer d'endpoint, d'URL, de view, de viewset, d'admin ou de migration.

F21 a ajoute une API read-only minimale pour `InventoryItem`. Elle expose uniquement la liste et le detail des items actifs et non supprimes. Aucune ecriture API n'est autorisee et aucune migration n'est creee.

F22 a ajoute une documentation OpenAPI minimale avec drf-spectacular pour usage local/dev :

- `/api/schema/`
- `/api/docs/swagger/`
- `/api/docs/redoc/`

F22 ne cree aucune migration et aucun endpoint d'ecriture.

F23 a protege l'API inventory read-only par authentification DRF standard. Les endpoints inventory exigent un utilisateur authentifie.

Les endpoints suivants restent publics :

- `/healthz/`
- `/readyz/`
- `/api/schema/`
- `/api/docs/swagger/`
- `/api/docs/redoc/`

F23 ne cree aucune migration et aucun endpoint d'ecriture.

F24 a ajoute les routes DRF session login/logout pour usage dev/local avec la Browsable API :

- `/api-auth/login/`
- `/api-auth/logout/`

L'API inventory reste protegee. Aucun JWT, token auth, role metier, migration ou endpoint d'ecriture n'est cree.

F25 a ajoute une commande locale de seed d'utilisateur de developpement :

```sh
python backend/manage.py seed_dev_user
```

Elle lit `DJANGO_DEV_USERNAME`, `DJANGO_DEV_PASSWORD` et `DJANGO_DEV_EMAIL` depuis l'environnement charge par Django. `DJANGO_DEV_EMAIL` est optionnel. Le mot de passe ne doit jamais etre commite, et la commande ne l'affiche jamais.

Cette commande est destinee au local/dev uniquement. Elle refuse de s'executer lorsque `DEBUG=False`, cree ou met a jour un utilisateur standard non staff et non superuser, et permet de tester `/api-auth/login/` en session locale. F25 ne cree aucune migration, aucun modele, aucun endpoint, aucun JWT/token et aucun role metier.

F26 a ajoute une commande locale de seed de donnees `InventoryItem` de demonstration :

```sh
python backend/manage.py seed_demo_inventory
```

Cette commande est destinee au local/dev uniquement et refuse `DEBUG=False`. Elle cree uniquement des donnees conformes Titan avec les kinds `material`, `article` et `material_pack`.

Elle ne cree jamais de local, salle, lieu, service annexe ou service evenementiel. F26 ne cree aucune migration, aucun modele, serializer, view, endpoint, JWT/token ou role metier.

F27 a ajoute un smoke test authentifie du parcours inventory. Le test couvre le seed d'un utilisateur dev, le seed des donnees demo inventory, le login session Django/DRF, `GET /api/v1/inventory/items/` authentifie et la validation des kinds Titan autorises.

Le smoke test attend uniquement `material`, `article` et `material_pack`, et verifie l'absence de `venue`, `local`, `room`, `service` et `event_service`.

F28 a ajoute un smoke test du detail inventory authentifie et confirme que l'API inventory reste read-only. Le test couvre le seed dev user, le seed demo inventory, le login session, `GET /api/v1/inventory/items/`, `GET /api/v1/inventory/items/<id>/`, le refus de POST, PUT, PATCH et DELETE, et la validation des kinds Titan.

F29 a ajoute le socle de domaine `InventoryAvailability` pour representer de futures periodes d'indisponibilite ou de reservation d'un `InventoryItem`. Ce n'est pas encore un module complet de reservation, planning, contrat, facture, paiement ou client.

L'API inventory reste read-only et aucun endpoint d'ecriture n'est cree.

F30 a ajoute des helpers internes pour detecter les conflits de disponibilite inventory sur une periode donnee. Ces helpers utilisent les periodes `blocked` et `reserved` et traitent les intervalles comme `[start_at, end_at)`.

F30 ne cree aucune API, aucun serializer, aucune view, aucune URL, aucun endpoint d'ecriture et aucun module complet de reservation.

F31 a ajoute un smoke test interne qui valide que les donnees creees par `seed_demo_inventory` peuvent etre utilisees avec `InventoryAvailability` et les helpers internes de disponibilite.

F31 ne cree aucune API, aucun serializer, aucune view, aucune URL, aucun endpoint d'ecriture et aucun module complet de reservation. L'API inventory reste read-only.

F32 a ajoute un document de decision sur le domaine de disponibilite inventory : `docs/decisions/DEC-002-inventory-availability-domain.md`.

F32 ne modifie aucun code applicatif. Aucune migration, aucun modele, serializer, view, endpoint, test ou module complet de reservation n'est cree. L'API inventory reste read-only.

F33 a ajoute le squelette du domaine `reservations` et installe l'app Django `apps.reservations`.

F33 ne cree aucun modele, migration, serializer, view, URL, endpoint, admin ou frontend. L'API inventory reste read-only.

F34 a ajoute un garde-fou pur Python dans `apps.reservations` pour formaliser les kinds `InventoryItem` reservables par les futures reservations Titan.

Seuls les kinds suivants sont reservables :

- `material`
- `article`
- `material_pack`

Les kinds `venue`, `local`, `room`, `service`, `event_service` et les kinds inconnus sont refuses.

F34 ne cree aucun modele, migration, serializer, view, URL, endpoint, admin ou frontend. L'API inventory reste read-only.

F35 a ajoute un value object immuable et des helpers purs Python pour valider les futures periodes de reservation dans `apps.reservations`.

Les bornes `start_at` et `end_at` sont obligatoires, doivent etre des datetimes timezone-aware, et `end_at` doit etre strictement superieur a `start_at`.

Les periodes sont interpretees comme des intervalles demi-ouverts `[start_at, end_at)`, alignes avec `DEC-002-inventory-availability-domain.md`.

F35 ne cree aucun modele, migration, serializer, view, URL, endpoint, admin ou frontend. L'API inventory reste read-only.

F36 a ajoute un helper pur Python de validation d'une future demande de reservation item + periode.

Cette validation combine le kind reservable via `assert_reservable_inventory_item_kind` et la periode valide via `make_reservation_period`.

F36 ne cree aucune reservation persistante, aucun modele, migration, serializer, view, URL, endpoint, admin ou frontend. L'API inventory reste read-only.

F121E-0 remplace les anciennes generations de prompts et workflows agents par un seul
systeme officiel :

- `AGENTS.md` reste la source courte de verite ;
- `docs/ai-agents/` definit les roles backend/frontend, les quality gates, le template
  de tache et la boucle d'amelioration ;
- les subagents natifs sont utilises lorsqu'ils sont disponibles, sinon les memes roles
  sont executes sequentiellement ;
- la publication Git est permise uniquement quand la tache l'autorise explicitement ;
- le merge reste toujours humain.

F37 ajoute un helper backend interne de validation de disponibilite pour une future demande de reservation item + periode.

Ce helper combine :

- la validation F36 du kind reservable et de la periode ;
- les helpers internes F30 `InventoryAvailability` pour lire les conflits existants.

F37 lit la DB uniquement pour verifier les conflits de disponibilite, ne cree aucune reservation persistante, n'ecrit jamais en DB et laisse `inventory_unit_count` a `None` tant qu'aucun champ quantite/unite/stock n'est valide sur `InventoryItem`.

F37 ne cree aucun modele, migration, serializer, view, URL, endpoint, admin ou frontend. L'API inventory reste read-only.

F38 ajoute un value object interne de preview d'une future demande de reservation item.

Cette preview compose le helper F37 `validate_reservation_item_availability_request` et expose un statut interne :

- `invalid` ;
- `unavailable` ;
- `available`.

F38 ne fait aucun calcul commercial, ne cree aucun devis, n'ecrit jamais en DB et ne cree aucune reservation persistante. F38 ne cree aucun modele, migration, serializer, view, URL, endpoint, admin ou frontend. L'API inventory reste read-only.

F39 standardise l'image Docker backend locale pour les tests backend reproductibles.

L'image backend installe maintenant les dependances de developpement Python declarees dans `pyproject.toml` et embarque le dossier `tests/`. Apres build et demarrage Compose, les tests backend peuvent etre lances sans `pip install` manuel et sans `docker compose cp` :

```sh
docker compose exec backend python -m pytest tests/backend -q
```

Le backend continue de demarrer avec Django `runserver` via `docker compose up -d`. F39 ne modifie aucune logique metier, aucun modele, migration, serializer, view, URL, endpoint, admin ou frontend.

F40 ajoute une couche service interne de preview de reservation item.

Le service `preview_reservation_item_service` orchestre la preview F38 sans dupliquer la logique, sans double lecture DB et sans ecriture DB. Il ne cree aucune reservation persistante et ne cree aucun endpoint API.

F40 ne modifie aucune logique metier inventory, availability ou preview. F40 ne cree aucun modele, migration, serializer, view, URL, endpoint, admin, frontend, contrat, facture, paiement, client ou workflow commercial complet.

F41 ajoute un controle Redis minimal au readiness endpoint `GET /readyz/`.

`/healthz/` reste un liveness check minimal sans acces PostgreSQL ou Redis. `/readyz/` verifie maintenant PostgreSQL et Redis, et retourne un detail stable par check :

```json
{"status": "ready", "checks": {"database": "ok", "redis": "ok"}}
```

F41 n'ajoute pas de dependance Python Redis. Le check Redis utilise une verification minimale via la stdlib Python et ne cree aucun modele, migration, serializer, view metier, URL metier, endpoint metier, endpoint d'ecriture, admin ou frontend.

F42 a nettoye les statuts documentaires apres la validation post-merge de F41. F42 ne modifie aucun code backend, test, Dockerfile, Compose, `.env.example`, modele, migration, serializer, view, URL, endpoint, admin ou frontend.

F43 a standardise le workflow local de logs terminal pour les validations importantes. Le script `scripts/dev/erp-logged-run` enregistre les sorties dans `logs/terminal/`, affiche la sortie via `tee`, copie le log vers le presse-papiers Windows si `clip.exe` est disponible, et propage le code retour de la commande executee.

F44 a nettoye les statuts documentaires apres F43. F44 ne modifie aucun code backend, test backend, Dockerfile, Compose, `.env.example`, modele, migration, serializer, view, URL, endpoint, admin ou frontend.

F45 documente la matrice de sante Foundation dans `docs/runbooks/health-readiness-matrix.md`. Cette matrice clarifie `/healthz/` comme liveness minimal, `/readyz/` comme readiness PostgreSQL + Redis, les controles futurs non implementes et les exclusions de scope. F45 ne modifie aucun comportement technique.

F46 a nettoye les statuts documentaires apres F45. F46 ne modifie aucun code backend, test backend, Dockerfile, Compose, `.env.example`, modele, migration, serializer, view, URL, endpoint, admin ou frontend.

F47 formalise le workflow documentaire integre : les futures taches doivent inclure les mises a jour documentaires necessaires dans la meme PR quand c'est raisonnable, au lieu de creer systematiquement une PR de nettoyage documentaire separee. F47 ne modifie aucun comportement technique.

F48 cadre le smoke test Foundation local dans la documentation. Cette tache documente le scenario minimal de validation locale avec Docker Compose, `/healthz/`, `/readyz/` et Django check, sans creer de script, CI, code backend ou changement technique.

F49 valide operationnellement le smoke test Foundation local documente en F48. Le build backend, le demarrage `db`/`redis`/`backend`, le backend healthy, `/healthz/` en HTTP 200, `/readyz/` en HTTP 200 avec PostgreSQL + Redis, le Django check et l'arret propre des services ont ete verifies sans creer de script, CI, code backend ou changement technique.

F50 ajoute un selector interne inventory availability pour lister les `InventoryItem` actifs, non supprimes, conformes Titan et disponibles sur une periode. Ce selector reste en lecture seule, sans API, serializer, view, URL, admin, frontend, modele, migration, stock, quantite ou ecriture DB.

F51 ajoute un selector interne reservations pour lister les items Titan disponibles pour une future reservation en deleguant au selector inventory F50. Il reste read-only et ne cree aucune API, serializer, view, URL, admin, frontend, modele, migration, reservation persistante, contrat, facture, paiement, client, stock ou quantite.

F52 ajoute un service interne reservations pour preparer une liste structuree d'items Titan disponibles pour une periode. Il s'appuie sur le selector F51, materialise les items en tuple et retourne un compteur, sans dupliquer la logique d'overlap inventory, sans ecriture DB et sans reservation persistante.

F53 ajoute des tests de coherence entre les services reservations F40 et F52. Ces tests verifient que la preview et les options d'items disponibles restent alignees sur les memes regles Titan de disponibilite, sans modifier la logique metier et sans creer de reservation persistante.

F54 a ajoute un service interne batch qui genere les previews des items disponibles en s'appuyant sur F52 et F40. F54 ajoute aussi des tests de garde-fou Titan scope sur les services reservations. Cela reste interne, read-only, sans API, modele, migration, reservation persistante, stock, quantite, unite ou pricing.

F55 a ajoute des tests de robustesse temporelle et d'ordre deterministe pour les services reservations disponibles. Les services doivent respecter les periodes timezone-aware, les intervalles demi-ouverts `[start_at, end_at)` et retourner les items disponibles dans un ordre stable.

F55 ne cree aucun service de resume de disponibilite, aucune API, modele, migration, reservation persistante, stock, quantite, unite ou pricing.

F56 a ajoute un service interne de resume de disponibilite reservations base sur les services F52 et F54. Ce resume expose la periode, le nombre d'items disponibles, le nombre de previews disponibles et les kinds disponibles dans l'ordre stable herite de F55.

F56 reste interne et read-only. F56 ne cree aucun compteur par kind, aucune API, modele, migration, reservation persistante, stock, quantite, unite ou pricing.

F57 optimise la composition interne des services reservations disponibles pour eviter un double calcul des options disponibles dans le service de resume F56.

F57 ne change pas le comportement metier, ne change aucune signature publique et reste interne, read-only, sans API, modele, migration, reservation persistante, stock, quantite, unite ou pricing.

F58 ajoute des tests de contrat public interne pour les services reservations. Ces tests verifient les types de retour, les signatures keyword-only, le caractere read-only, le scope Titan et l'absence d'API reservations.

F58 ne change pas le comportement metier, ne cree aucun service, aucune dataclass publique, API, modele, migration, reservation persistante, stock, quantite, unite, pricing ou compteur par kind.

F59 durcit les tests de contrat interne reservations en couvrant l'immutabilite et la structure stable des dataclasses publiques, puis ajoute un test de coherence entre options disponibles, previews et resume de disponibilite.

F59 reste test-only et documentaire. F59 ne change aucun comportement metier, ne cree aucune API, modele, migration, reservation persistante, stock, quantite, unite, pricing, contrat, facture, paiement ou client.

F60 clarifie la prochaine trajectoire MVP API/frontend et documente les garde-fous reservations existants. F60 est documentaire uniquement.

Trajectoire MVP envisagee :

- F61 : definir et autoriser explicitement la plus petite exposition API read-only utile au MVP ;
- F62 : implementer uniquement l'API read-only approuvee, apres autorisation explicite ;
- F63 : bootstrap frontend seulement apres autorisation explicite, avec une page minimale consommant les endpoints read-only approuves ;
- F64 : ajouter une validation smoke backend/frontend MVP ;
- F65 : affiner le parcours de demo locale, les notes UX et le runbook MVP.

Cette trajectoire n'autorise pas de contrat, facture, paiement, client, stock, quantite, unite, pricing, workflow complet de reservation, logique Titan local/salle/venue/room/hall/service/event-service, ni API d'ecriture sans autorisation explicite.

F60 ne change aucun comportement applicatif et ne cree aucune API, modele, migration, serializer, view, URL, admin, frontend, reservation persistante, contrat, facture, paiement, client, stock, quantite, unite, pricing ou ecriture DB metier.

F61 ajoute la premiere surface API read-only reservations explicitement autorisee :

- `GET /api/v1/reservations/availability-summary/`

Cet endpoint authentifie retourne uniquement un resume de disponibilite pour une periode : bornes, nombre d'items disponibles, nombre de previews disponibles et kinds disponibles. Il ne cree aucune reservation, n'ecrit jamais en DB et n'expose pas de detail d'item.

F61 ajoute aussi le premier bootstrap frontend React/Vite/TypeScript. La page initiale consomme uniquement l'API inventory read-only existante `GET /api/v1/inventory/items/` avec la session Django locale existante.

F61 ne cree aucun modele reservations, aucune migration reservations, aucun admin, aucune API d'ecriture, aucune reservation persistante, aucun workflow frontend de reservation, aucun contrat, facture, paiement, client, stock, quantite, unite, pricing ou workflow commercial complet.

F62 est terminee et a ajoute une seconde surface API reservations authentifiee et read-only :

- `GET /api/v1/reservations/available-item-previews/`

Cet endpoint retourne une liste minimale des previews d'items Titan disponibles pour une periode, en composant le service interne existant. F62 ajoute aussi Vitest, jsdom et React Testing Library pour tester la page inventory frontend existante.

F62 ne cree aucun modele reservations, aucune migration reservations, aucun admin, aucune API d'ecriture, aucune reservation persistante, aucun workflow frontend de reservation ou de login, aucun contrat, facture, paiement, client, stock, quantite, unite, pricing ou workflow commercial complet.

F63 connecte le frontend aux APIs reservations read-only F61/F62 avec un panneau de consultation de disponibilite. Le frontend affiche la periode, le resume et les previews d'items disponibles sans creer de reservation.

F63 extrait aussi les types et appels API frontend dans des modules simples et ajoute le runbook `docs/runbooks/mvp-local-smoke-validation.md`.

F63 ne modifie aucun comportement backend et ne cree aucune reservation persistante, API d'ecriture, logique de login frontend, workflow de creation de reservation, CI, configuration de deploiement ou workflow commercial.

F64 a valide operationnellement le smoke test MVP local backend/frontend documente en F63.

F65 est terminee et a ajoute une commande locale/dev idempotente pour creer deux periodes techniques `InventoryAvailability` de demonstration :

```sh
python backend/manage.py seed_demo_availability
```

La commande utilise uniquement les items existants crees par `seed_demo_inventory`, refuse `DEBUG=False`, laisse le pack demo disponible et ne cree aucune reservation persistante. Le statut `reserved` utilise ici est uniquement un statut technique d'indisponibilite inventory.

Le parcours complet est documente dans [docs/runbooks/mvp-local-demo-flow.md](docs/runbooks/mvp-local-demo-flow.md). Le frontend affiche aussi explicitement que la consultation est read-only, exige une session backend locale et ne cree aucune reservation.

F66 est terminee et a ajoute une [checklist d'acceptation de la demonstration MVP locale](docs/runbooks/mvp-local-demo-acceptance.md), un scenario manuel navigateur et une indication frontend pour choisir une periode chevauchant la fenetre demo F65.

F66 ne modifie aucun backend, endpoint, modele, migration, admin ou comportement d'ecriture. Il ne cree aucun workflow frontend de login ou de reservation, aucun outillage e2e, CI ou configuration de deploiement.

F67 est terminee et consigne les preuves disponibles dans [docs/runbooks/mvp-local-demo-acceptance-result.md](docs/runbooks/mvp-local-demo-acceptance-result.md). Elle documente aussi la prochaine etape MVP recommandee sans l'implementer.

F67 est documentaire uniquement et n'implemente pas F68.

F68 est terminee et enregistre le resultat `PASS` de l'acceptation navigateur humaine du parcours MVP local. Cette tache est documentaire uniquement.

F69 est terminee et a ajoute la plus petite surface backend authentifiee et read-only pour consulter la preview de disponibilite d'un item Titan sur une periode :

- `GET /api/v1/reservations/items/<uuid:inventory_item_id>/availability-preview/`

F69 delegue au service interne existant, expose uniquement un statut public et un nombre de conflits, et ne cree aucune reservation persistante ni API d'ecriture. Aucune integration frontend n'est ajoutee dans F69.

F70 clarifie le plus petit scope MVP Hahitantsoa et la roadmap globale Hahitantsoa/Titan dans [DEC-003](docs/decisions/DEC-003-hahitantsoa-mvp-scope.md). Le premier slice Hahitantsoa doit rester read-only, distinct de Titan et limite aux concepts confirmes avant toute implementation.

F70 ne modifie aucun comportement applicatif. Le resultat d'acceptation locale Titan reste `PASS`, mais le projet complet n'est pas production-ready.

F121E-0 remplace les anciens workflows agents concurrents par un systeme multi-agent
officiel unique. `AGENTS.md` reste la source courte de verite et
[`docs/ai-agents/`](docs/ai-agents/README.md) porte les roles backend/frontend, les
quality gates, le template de tache et la boucle d'amelioration. Le merge reste humain.

F72 est terminee et a supprime les exemples documentaires historiques qui demandaient aux agents de sourcer directement `.env`.

F73 ajoute un garde-fou pur Python pour les concepts confirmes du premier slice Hahitantsoa read-only. Ce package structurel n'est pas une app Django et n'ajoute aucune persistence, API, selector, catalogue, value object ou interface frontend.

F74 ajoute un unique value object pur Python, immuable et read-only pour representer un item de decouverte Hahitantsoa valide par les garde-fous F73. F74 n'ajoute aucun selector, catalogue, jeu de donnees demo, acces DB, API, frontend ou workflow metier.

F75 ajoute un selector interne pur Python retournant un tuple immuable des categories de decouverte Hahitantsoa validees. Ce catalogue statique read-only ne represente ni des entites reelles, ni un inventaire de production, ni une disponibilite commerciale, et n'ajoute aucun acces DB, API ou frontend.

F76 documente le contrat de la future API read-only Hahitantsoa `GET /api/v1/hahitantsoa/discovery-items/`. F76 est documentaire uniquement et n'implemente aucun serializer, view, URL ou endpoint.

F77 a implemente `GET /api/v1/hahitantsoa/discovery-items/`, une API authentifiee et strictement read-only qui delegue au selector F75. Elle expose uniquement `concept` et `label`, sans DB, modele, migration, admin, frontend ou workflow commercial. F77 est mergee et validee post-merge.

Le projet n'est pas production-ready. Les modeles inventory existants restent des socles minimaux et le frontend React reste un MVP local controle. La CI GitHub Actions existe depuis F91, mais `main` n'est pas protege automatiquement ; les checks `Backend quality` et `Frontend quality` restent donc des gates manuels obligatoires avant merge. Il existe maintenant une ecriture metier limitee, `POST /api/v1/reservations/drafts/`, pour creer des brouillons de reservation draft-only. Il n'existe toujours pas de module complet de reservation/location, confirmation transactionnelle, paiement, facture runtime, contrat runtime ou generation PDF runtime.

L'infrastructure locale PostgreSQL/Redis ne demarre aucun service applicatif et ne publie pas les ports PostgreSQL ou Redis sur l'hote.

Le runbook local est disponible dans [docs/runbooks/local-development.md](docs/runbooks/local-development.md).

## Commandes backend locales

Executer ces commandes uniquement lorsque les variables requises sont deja exportees dans
l'environnement du shell ou fournies par l'outillage local documente. Ne jamais sourcer,
afficher, ouvrir, inspecter ou lire directement `.env`.

```sh
.venv/bin/python -m pip install -e ".[dev]"
.venv/bin/python -m ruff format --check .
.venv/bin/python -m ruff check .
.venv/bin/python backend/manage.py check
.venv/bin/python -m pytest
```

## Documents a lire en priorite

1. [AGENTS.md](AGENTS.md)
2. [PLANS.md](PLANS.md)
3. [docs/decisions/DEC-001-titan-scope-validated.md](docs/decisions/DEC-001-titan-scope-validated.md)
4. [docs/decisions/DEC-002-inventory-availability-domain.md](docs/decisions/DEC-002-inventory-availability-domain.md)
5. [docs/decisions/DEC-003-hahitantsoa-mvp-scope.md](docs/decisions/DEC-003-hahitantsoa-mvp-scope.md)
6. [docs/adr/ADR-006-titan-excludes-venues-and-services.md](docs/adr/ADR-006-titan-excludes-venues-and-services.md)
7. [docs/business-rules/scope.md](docs/business-rules/scope.md)
8. [docs/architecture/foundation-plan.md](docs/architecture/foundation-plan.md)
9. [docs/runbooks/local-development.md](docs/runbooks/local-development.md)

## Workflow agents officiel

Le workflow agent officiel est documente dans `docs/ai-agents/`.

- Utiliser `docs/ai-agents/task-prompt-template.md` pour cadrer les futures taches.
- Utiliser les templates backend/frontend pour assigner des roles bornes.
- Utiliser `docs/ai-agents/pr-quality-gates.md` pour les validations et rapports PR.
- Utiliser des subagents natifs lorsqu'ils sont disponibles, sinon executer les memes
  roles sequentiellement.
- Utiliser uniquement Codex et les subagents Codex. OpenClaw est decommissionne du
  workflow actif et ses sorties ne doivent pas etre utilisees.
- Les agents peuvent committer, pousser et ouvrir une PR uniquement lorsque la tache
  l'autorise explicitement.
- Le merge reste toujours humain.
- Integrer les mises a jour documentaires utiles dans la meme PR que la tache quand c'est raisonnable.

Ces documents ne remplacent pas les sources de verite. `AGENTS.md`, `DEC-001` et `DEC-002` restent prioritaires.

## Perimetre fonctionnel cible

Hahitantsoa couvre l'evenement complet et peut inclure local, materiels/articles, mobilier et services annexes eventuels.

Titan couvre uniquement la location pure de materiels/articles et de packs materiels. Titan exclut definitivement les locaux et les services annexes.

Les materiels sont partages entre Hahitantsoa et Titan : une reservation confirmee dans un volet rend le materiel indisponible dans l'autre.

F91 a ajoute la CI GitHub Actions dans `.github/workflows/ci.yml`. Cette CI execute les quality gates backend et frontend sur les pull requests vers `main` et les pushes vers `main`. Le backend utilise PostgreSQL et Redis en services GitHub Actions, puis execute Ruff format, Ruff lint et pytest. Le frontend execute `npm ci`, Vitest et le build Vite. Le runbook est disponible dans [`docs/runbooks/ci-quality-gates.md`](docs/runbooks/ci-quality-gates.md).

F92 documente le fonctionnement des quality gates CI, les regles de merge, le diagnostic des echecs CI et le lien avec le workflow Codex supervise. F92 ne modifie aucun code applicatif ni le workflow CI.

F93 ajoute le helper local `scripts/dev/erp-quality-check` pour lancer rapidement les validations locales non-DB alignees avec la CI : Ruff format, Ruff lint, tests frontend et build frontend. Les tests backend DB-backed restent valides via GitHub Actions CI ou le workflow Docker Compose documente, car ils necessitent PostgreSQL et Redis.

F95 documente l'etat des protections de branche : la CI est active, mais `main` n'est pas protege par GitHub branch protection dans l'etat actuel du depot prive. Les checks `Backend quality` et `Frontend quality` restent donc des gates manuels obligatoires avant merge humain.

F98 ajoute le registry read-only des templates documents et les endpoints de consultation `GET /api/v1/documents/templates/` et `GET /api/v1/documents/templates/<template_key>/`.

F99 ajoute l'API clients/contacts read-only pour alimenter les futurs workflows sans encore creer de paiement, facture, contrat ou document runtime.

F100 introduit `ReservationDraft` et `ReservationDraftLine`, avec une API authentifiee de creation et consultation de brouillons de reservation. Cette creation reste draft-only : elle ne confirme pas la reservation, ne bloque pas l'inventaire, ne genere pas de facture, contrat, paiement ou PDF runtime.

F101 connecte le frontend availability panel a la creation de `ReservationDraft` depuis les items disponibles et un client selectionne. Le controle frontend reste limite a un brouillon editable et n'expose pas de confirmation, paiement, facture, contrat ou PDF.

F102 met a jour les sources documentaires A/B en v3.4, ajoute l'inventaire `docs/references/document_templates_inventory.md`, enregistre `shared.breakage_repair_invoice.v1` et ajoute le template source `Template_Facture_Casse_Remise_Etat_style_fidele_v5.pdf`. F102 ne genere aucun PDF client runtime.
