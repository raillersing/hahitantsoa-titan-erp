# Codex reasoning policy

This policy helps choose the smallest useful Codex reasoning level for future tasks while preserving senior review quality and Titan safeguards.

## Low

Use Low for simple documentation or narrow text corrections.

Examples:

- README or runbook wording updates.
- Status updates in `PLANS.md`.
- Small typo fixes.
- Non-technical documentation reordering.

Low tasks must still verify branch, Git status and scope.

## Medium

Use Medium for structured changes that need local reasoning but not deep transaction or security analysis.

Examples:

- Pure Python helpers.
- Targeted unit tests.
- Documentation structure such as templates, checklists or runbooks.
- AppConfig or registry checks.
- Narrow validation helpers without database writes.

Medium tasks should include targeted validation and explicit checks that no forbidden backend artifact was created.

## High

Use High for changes where correctness depends on data integrity, authorization, security or cross-domain business rules.

Examples:

- Django models and migrations.
- PostgreSQL constraints.
- Transactions and locking.
- Availability or reservation allocation behavior.
- API write endpoints.
- Permissions, authentication hardening or sensitive file access.
- Payments, invoices, contracts, cash register, audit or client data.

High tasks must explicitly reason about DEC-001, DEC-002 when relevant, database behavior, rollback paths, tests and operational validation.

## Permanent safeguards

Regardless of reasoning level:

- Never display, modify or commit `.env`.
- Respect DEC-001 and DEC-002.
- Titan allows only `material`, `article` and `material_pack`.
- Titan forbids `venue`, `local`, `room`, `service` and `event_service`.
- Keep the inventory API read-only until a task explicitly validates otherwise.
- Do not create models, migrations, serializers, views, URLs, endpoints, admin or frontend outside explicit scope.
- Do not commit or push unless explicitly requested.
