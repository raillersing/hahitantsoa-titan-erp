# Audit de F134A : Document Artifact Access Audit Event

## Statut
Implémenté et validé.

## Objectif
Tracer avec précision et sécurité tous les accès réussis des utilisateurs authentifiés aux artefacts HTML générés par les instances de document.

## Implémentation
Le service réutilisable existant `record_audit_event_on_commit` de l'application `audit` a été branché sur la vue `DocumentInstancePrivateArtifactAPIView` de l'application `documents`.

Lorsqu'un utilisateur authentifié accède avec succès à un artefact via `GET /api/v1/documents/instances/{id}/artifact/` :
- Un événement d'audit `document.artifact_accessed` est programmé pour création après commit de transaction réussi.
- L'événement référence :
  - `actor` : l'utilisateur connecté ayant effectué la requête.
  - `target_type` : `"document_instance"`.
  - `target_id` : l'identifiant (UUID) de l'instance de document.
  - `metadata` : contient le `template_key`, `content_checksum`, et `generated_content_size_bytes` de l'instance accédée.

## Limites et Exclusions
- Aucun événement d'audit n'est créé pour les tentatives d'accès en échec (ex. : 404, 403, 401) pour se conformer au cahier des charges et éviter le bruit dans les logs d'audit.
- Pas de fuite de `storage_path` dans les données ou métadonnées de l'audit pour des raisons de confidentialité et d'encapsulation.
- L'endpoint est protégé et restreint aux seuls utilisateurs authentifiés.

## Prochaine tâche recommandée
- F134B : Document artifact runtime invariant hardening
