# F132T Document Artifact Storage Foundation

## Status

Implemented for review and final delivery.

## Purpose

F132T establishes the first controlled backend storage foundation for generated commercial document artifacts.

## Storage behavior added

Generated HTML content is stored through Django's storage abstraction during document runtime generation.

The runtime now persists:

- `status = generated`;
- `content_checksum`;
- `generated_content_size_bytes`;
- `storage_path`.

The stored artifact is the generated HTML content encoded as UTF-8.

## Storage path policy

The stored path is an internal relative path.

The path:

- is deterministic for the generated document instance and checksum;
- includes the document instance identifier;
- includes a checksum prefix;
- ends with `.html`;
- does not expose a public URL;
- does not include customer email, phone, address, display name, or raw user-provided filenames;
- does not use timestamps or randomness;
- does not include path traversal components.

## Scope exclusions

F132T intentionally does not add:

- public download API;
- serializers, views, routers, URLs, or OpenAPI paths;
- RBAC exposure or access policy;
- PDF generation;
- external storage providers;
- S3, boto3, or cloud SDKs;
- new dependencies;
- model or migration changes;
- payment behavior;
- reservation lifecycle behavior;
- frontend behavior;
- Docker, compose, GitHub Actions, or CI script changes;
- `.env` or secret changes.

## A4 T4 certification result

F132T is a controlled A4 backend T4 storage drill.

Certification is valid only if PR CI and main CI are green after final merge.

This does not promote Antigravity, Codex, or any other agent to broad T4 autonomy. Broader T4 work still requires explicit Human Owner approval and, where relevant, Agent B or supervisor review.

## Validation evidence summary

Expected validation evidence:

- `git diff --check`;
- anti-mojibake and anti-prompt artifact checks;
- `bash -n scripts/ci/backend-quality`;
- `python backend/manage.py makemigrations --check --dry-run`;
- focused document runtime tests;
- full backend-test profile;
- PR CI green;
- main CI green after merge.

## Next recommended task

F133A - Document access/download API decision.
