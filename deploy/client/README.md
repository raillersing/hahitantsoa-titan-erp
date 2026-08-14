# Déploiement pilote macOS

Ce bundle est destiné au MacBook Pro M3 Pro du client. Il installe une instance
locale persistante, accessible sur `http://127.0.0.1:5173`.

## Prérequis

- macOS Tahoe ;
- Docker Desktop pour Apple Silicon, lancé et autorisé à utiliser le disque du projet ;
- environ 8 Go d'espace libre pour les images et les données initiales.

## Première installation

Depuis la racine du projet, lancer l'installateur :

```sh
chmod +x deploy/client/*-macos.sh
deploy/client/install-macos.sh

# Créer le compte administrateur initial défini dans .env.client
deploy/client/bootstrap-admin-macos.sh
```

L'installateur crée `.env.client`, génère les secrets locaux et affiche le mot de
passe initial. Ne pas committer ce fichier.

Le premier démarrage construit les images, crée les volumes, attend PostgreSQL et
Redis, applique les migrations, puis démarre le backend et le frontend.

Ouvrir ensuite : <http://127.0.0.1:5173/>

## Vérification

```sh
curl http://127.0.0.1:5173/healthz/
curl http://127.0.0.1:5173/readyz/
docker compose --env-file deploy/client/.env.client -f deploy/client/compose.yaml ps
```

Les deux endpoints doivent répondre avec un statut `200`; les services doivent être
`healthy` ou `running` selon leur rôle.

## Exploitation

```sh
# Arrêter sans supprimer les données
docker compose --env-file deploy/client/.env.client -f deploy/client/compose.yaml stop

# Redémarrer
docker compose --env-file deploy/client/.env.client -f deploy/client/compose.yaml up -d

# Afficher les logs applicatifs
docker compose --env-file deploy/client/.env.client -f deploy/client/compose.yaml logs --tail=200 backend frontend
```

Ne jamais utiliser `docker compose down -v` sur cette installation : cela supprimerait
les volumes de données.

## Limites du pilote

- l'accès est local au Mac ;
- la synchronisation distante des rapports de bugs et les mises à jour à distance seront
  ajoutées dans les lots dédiés ;
- une sauvegarde PostgreSQL doit être réalisée avant chaque mise à jour applicative ;
- cette instance pilote ne remplace pas encore une architecture de production centralisée.
