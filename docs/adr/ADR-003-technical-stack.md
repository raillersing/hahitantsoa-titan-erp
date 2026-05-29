# ADR-003 - Technical Stack

## Contexte

Le projet necessite une API robuste, une interface moderne, des traitements asynchrones, du temps reel, une base relationnelle et une documentation API.

## Decision

La stack cible est :

- Python 3.13 ;
- Django 5.2 LTS ;
- Django REST Framework ;
- React ;
- TypeScript strict ;
- Vite ;
- PostgreSQL ;
- Celery, Redis et Celery Beat ;
- Django Channels et Redis ;
- Flower non expose publiquement ;
- Nginx ;
- serveur ASGI ;
- OpenAPI avec drf-spectacular ;
- Docker Compose des la Foundation.

## Alternatives considerees

- Django + HTMX a la place de React.
- Backend non Django.
- Base non relationnelle principale.

## Consequences

- React reste le frontend cible.
- Les contrats API devront etre documentes.
- Les controles qualite devront couvrir backend et frontend.

## Statut

ACCEPTED

