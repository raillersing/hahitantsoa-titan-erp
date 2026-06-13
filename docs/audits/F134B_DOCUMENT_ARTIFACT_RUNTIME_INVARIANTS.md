# Audit de F134B : Document Artifact Runtime Invariant Hardening

## Statut
Implémenté et validé.

## Objectif
Renforcer la robustesse du module de génération d'instances de documents en ajoutant des gardes-fous stricts avant la persistance de l'état en base de données.

## Invariants durcis
Au sein de la fonction `generate_document_instance_html` (`backend/apps/documents/runtime.py`) :
1. **Validation du contenu** : Lève une `DocumentRuntimeGenerationError` (code `empty_generated_html_content`) si le HTML rendu est vide ou ne contient que des espaces blancs.
2. **Intégrité de l'empreinte** : Lève une `DocumentRuntimeGenerationError` (code `invalid_calculated_checksum`) si le checksum calculé est invalide ou n'a pas la longueur attendue de 64 caractères hexadécimaux (SHA-256).
3. **Validation de la taille** : Lève une `DocumentRuntimeGenerationError` (code `invalid_generated_content_size`) si la taille en octets du contenu encodé en UTF-8 est inférieure ou égale à 0.
4. **Sécurité du chemin d'accès** : Lève une `DocumentRuntimeGenerationError` (code `unsafe_storage_path`) si le chemin d'accès retourné par le système de stockage contient des éléments de traversée (`..`) ou commence par un slash (`/`).

## Limites et Exclusions
- Aucune modification de modèle ou de migration (validation au niveau applicatif).
- Le format physique des fichiers enregistrés reste de l'HTML (pas de format PDF).
- Le stockage reste abstrait via le `default_storage` de Django.

## Prochaine tâche recommandée
- F135A : Reservation confirmation preflight backend service
