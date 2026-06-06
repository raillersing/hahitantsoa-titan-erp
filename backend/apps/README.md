# Backend Domain Packages

`backend/apps/` prepare les futurs domaines applicatifs du backend.

Ces dossiers sont des packages Python de structure. Ils ne sont pas encore des applications Django activees dans `INSTALLED_APPS`.

F13 ne cree aucun modele, migration, serializer, viewset ou endpoint metier.

F73 ajoute `apps.hahitantsoa` comme package structurel pur Python contenant uniquement des
garde-fous de scope read-only. Il ne s'agit pas d'une application Django activee et F73 ne cree
aucune persistence, API, selector, catalogue, value object, interface frontend ou workflow
commercial.
