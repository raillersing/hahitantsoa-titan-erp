---
name: erp-frontend-typescript-quality
description: Review TypeScript and React changes for strict, safe contracts, local conventions, and the smallest maintainable implementation. Use when types, component contracts, API boundaries, or effects change; do not generalize a faithful replica beyond its approved scope.
---

# ERP Frontend TypeScript Quality

Preserve the repository's strict TypeScript configuration and use types to make
invalid UI states difficult to represent.

## Review checklist

- Keep strict compiler checks enabled. Do not silence errors with broad `any`,
  non-null assertions, unchecked casts, or `@ts-ignore` unless a local,
  documented boundary makes the risk explicit.
- Treat API, storage, URL, file, and untyped library input as `unknown`; validate
  and narrow it at the boundary before it reaches the UI.
- Model mutually exclusive async and document states with discriminated unions or
  similarly explicit states. Avoid boolean combinations that allow impossible
  loading/error/success combinations.
- Give component props precise, minimal contracts. Make optional data genuinely
  optional in rendering, and make callbacks describe their real ownership and
  failure behavior.
- Keep effects cancellable or stale-safe where requests can race, and keep their
  dependencies honest. Do not hide state errors behind disabled lint rules.
- Follow local naming, export, path, and component patterns. Do not rename or
  reorganize stable code solely for personal preference.
- Reuse an existing component, formatter, type, or dependency before adding an
  abstraction. Split a component only for a distinct responsibility, testability,
  or measured complexity—not future speculation.
- Keep replica-specific types and layout data local unless reuse is demonstrated.
  Fidelity work must not turn into an unapproved design-system rewrite.

## Evidence

Run the repository's TypeScript check, lint, and targeted tests. When a contract
touches a real API or print preview, pair static success with the corresponding
runtime evidence; type safety alone does not prove route, permission, or visual
fidelity.
