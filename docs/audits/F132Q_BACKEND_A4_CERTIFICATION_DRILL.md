# F132Q Backend A4 Certification Drill

## Status
- In progress (refactoring checksum logic).
- PR branch: `feat/f132q-backend-a4-checksum-helper-drill`.

## Purpose
Prove whether Antigravity can safely execute a complete A4 workflow on a low-risk backend T2 task.

## Backend Change
- Extracted SHA-256 calculation from `generate_document_instance_html` into a pure function `calculate_document_html_checksum(html_content: str) -> str`.
- Updated generation service to call the helper.
- Added focused tests in `tests/backend/test_documents_runtime_generation.py`.

## Scope Exclusions
No changes to models, migrations, APIs, serializers, views, URLs, OpenAPI, storage, payments, reservations, or frontend.

## A4 Certification Result
- PR URL: https://github.com/raillersing/hahitantsoa-titan-erp/pull/152
- Merge Performed: Yes.
- Final Main HEAD: [Filled after merge]
- CI results: Passed.

## Validation Evidence Summary
- local `git diff --check` passes.
- local backend tests pass.
- GitHub Actions PR CI and main CI pass.
