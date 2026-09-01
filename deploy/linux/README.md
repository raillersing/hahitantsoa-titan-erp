# Déploiement Linux de production

Cette cible est validée pour Docker Engine sur `linux/amd64` et `linux/arm64`.
Les images officielles utilisées sont multi-architecture et aucun champ `platform`
n’est imposé : le serveur construit donc les images adaptées à son processeur. Une
autre architecture Linux est possible seulement si toutes les images référencées la
publient ; elle doit être qualifiée sur le serveur cible avant mise en service.

Elle est distincte de `deploy/client/`, qui demeure le pilote local macOS.

## Pré-requis

- un serveur Linux maintenu, avec Docker Engine et Docker Compose Plugin ;
- un nom DNS public pointant vers le serveur ;
- les ports TCP 80 et 443, ainsi que UDP 443, ouverts vers le serveur ;
- aucun autre reverse proxy n’utilisant ces ports ;
- un emplacement de sauvegarde chiffré hors du serveur.

## Installation initiale

Depuis le répertoire `deploy/linux` du serveur :

```sh
cp production.env.example production.env
chmod 600 production.env
```

Modifiez `production.env` localement : remplacez chaque valeur
`REPLACE_WITH_A_LONG_RANDOM_VALUE` par une valeur aléatoire stockée dans votre
gestionnaire de secrets, et remplacez `erp.example.com` par le domaine réel.
Ce fichier ne doit jamais être versionné, copié dans un ticket ou envoyé par messagerie.

Construisez puis démarrez la pile :

```sh
docker compose --env-file production.env -f compose.yaml up -d --build
docker compose --env-file production.env -f compose.yaml ps
```

Les services `db`, `redis` et `backend` doivent être `healthy`. Créez ensuite le
premier administrateur de manière interactive :

```sh
docker compose --env-file production.env -f compose.yaml exec backend \
  python backend/manage.py createsuperuser
```

Ne placez jamais son mot de passe dans le dépôt, dans un script ou dans une variable
de configuration versionnée.

## Vérification après démarrage

```sh
curl --fail --silent --show-error https://erp.example.com/healthz/
curl --fail --silent --show-error https://erp.example.com/readyz/
docker compose --env-file production.env -f compose.yaml exec backend \
  python backend/manage.py check --deploy
```

La seconde commande confirme PostgreSQL et Redis. La troisième doit terminer sans
erreur de sécurité avant toute ouverture aux utilisateurs.

## Sauvegarde et restauration

Créez une sauvegarde avant toute mise à jour :

```sh
./backup.sh
```

Copiez immédiatement le fichier produit vers le stockage hors serveur chiffré. Une
restauration doit être testée sur une instance Linux isolée, jamais sur la base en
production. Le test automatisé restaure le dump dans un PostgreSQL éphémère, sans
port ni volume de production :

```sh
./restore-verify.sh backups/postgres-AAAAMMJJTHHMMSSZ.dump
```

Le test est validé uniquement si cette commande réussit, puis si une instance Linux
isolée basée sur la sauvegarde démarre, répond à `/readyz/` et permet une connexion
avec un compte de test.

## Mise à jour et retour arrière

1. Exécuter `./backup.sh` et vérifier la copie hors serveur.
2. Noter le SHA de la version actuellement en service.
3. Déployer le SHA approuvé, puis lancer les trois vérifications ci-dessus.
4. En cas d’échec, revenir au SHA/image précédent et restaurer seulement si la
   migration rend les données incompatibles. Toute restauration est tracée dans le
   registre d’incident.

Ne lancez jamais `docker compose down -v` : cette commande détruit les volumes de
données PostgreSQL, Redis et média.
