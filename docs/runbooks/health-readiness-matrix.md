# Health and Readiness Matrix

Ce document decrit la strategie Foundation actuelle pour les controles de sante et de readiness du backend.

Il sert de reference documentaire. F45 ne modifie aucun comportement technique, aucun endpoint, aucun Docker Compose et aucun code backend.

## Principes

`/healthz/` et `/readyz/` n'ont pas la meme responsabilite.

- Liveness : verifier que le processus backend repond encore.
- Readiness : verifier que le backend peut servir une requete applicative minimale en s'appuyant sur ses dependances techniques indispensables.

Les reponses HTTP ne doivent jamais exposer de detail interne sensible, de secret, de mot de passe, de token, de cle API ou de valeur issue de `.env`.

## Matrice Foundation actuelle

| Controle | Endpoint ou mecanisme | Statut F45 | Responsabilite | Dependances verifiees |
| --- | --- | --- | --- | --- |
| Backend liveness | `GET /healthz/` | Implemente | Confirmer que le processus backend repond | Aucune dependance externe |
| Backend readiness | `GET /readyz/` | Implemente | Confirmer que les dependances techniques minimales sont joignables | PostgreSQL et Redis |
| PostgreSQL readiness | `GET /readyz/` | Implemente | Verifier une requete PostgreSQL minimale | Base PostgreSQL locale |
| Redis readiness | `GET /readyz/` | Implemente | Verifier une connexion Redis minimale | Redis local via socket |
| Backend Docker healthcheck | Docker Compose | Implemente | Suivre le liveness du conteneur backend | `/healthz/` uniquement |
| PostgreSQL Docker healthcheck | Docker Compose | Implemente | Suivre l'etat du conteneur PostgreSQL | Healthcheck Compose du service `db` |
| Redis Docker healthcheck | Docker Compose | Implemente | Suivre l'etat du conteneur Redis | Healthcheck Compose du service `redis` |

## Endpoints actuels

### `GET /healthz/`

`/healthz/` est un liveness check minimal.

Il retourne `200` avec :

```json
{"status": "ok"}
```

Il ne consulte ni PostgreSQL, ni Redis, ni aucun domaine metier. Il reste le check utilise par le healthcheck Docker Compose du service backend.

### `GET /readyz/`

`/readyz/` est le readiness check Foundation minimal.

Il retourne `200` lorsque PostgreSQL et Redis sont accessibles :

```json
{"status": "ready", "checks": {"database": "ok", "redis": "ok"}}
```

Il retourne `503` si PostgreSQL ou Redis est indisponible, sans exposer le detail de l'erreur interne.

Le check Redis est implemente sans dependance Python Redis. Il utilise la bibliotheque standard Python via `socket`.

## Controles futurs envisages

Les controles suivants sont envisages pour des phases ulterieures, mais ne sont pas implementes en F45 :

- taches asynchrones ;
- Celery, si adopte plus tard ;
- Channels ou temps reel, si adopte plus tard ;
- frontend ;
- proxy HTTP/HTTPS ;
- stockage prive des fichiers sensibles ;
- sauvegardes et restauration ;
- SMTP et notifications.

Ces controles devront faire l'objet de taches explicites avant toute implementation.

## Exclusions explicites

La matrice Foundation ne cree et ne decrit aucun check metier.

Sont explicitement exclus :

- check metier inventory ;
- check metier reservations ;
- endpoint metier ;
- endpoint d'ecriture ;
- modele, migration, serializer, view, URL ou admin ;
- reservation persistante ;
- contrat, facture, paiement ou client ;
- local, salle, venue, lieu, service evenementiel ou service annexe dans Titan.

Titan reste limite a la location pure de materiels, articles et packs materiels.

## Logs et secrets

Les validations locales importantes peuvent utiliser :

```sh
scripts/dev/erp-logged-run nom-de-tache <<'EOF'
commandes ici
EOF
```

Ne jamais lancer avec ce wrapper une commande qui affiche `.env`, mots de passe, tokens, cles API ou details internes sensibles.

Les logs locaux sont ecrits dans `logs/terminal/`, ignores par Git, et destines uniquement au developpement local.
