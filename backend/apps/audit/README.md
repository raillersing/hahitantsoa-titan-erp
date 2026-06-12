# Audit

Role : accueillir les journaux d'audit, la tracabilite et les evenements sensibles.

F121C ajoute une fondation minimale pour enregistrer les succes durables d'actions sensibles :

- `AuditEvent` persiste l'acteur optionnel, l'action, la cible et des metadonnees minimales ;
- `record_audit_event_on_commit(...)` planifie la creation uniquement apres commit reussi ;
- un rollback annule le callback et ne laisse aucun faux audit de succes.

F121C ne cree aucun endpoint, serializer, view, event bus, integration Celery ou workflow de confirmation. Les audits de refus et d'echec restent hors perimetre jusqu'a une decision technique dediee.
