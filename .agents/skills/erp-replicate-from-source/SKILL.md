---
name: erp-replicate-from-source
description: Reproduce an approved Hahitantsoa/Titan interface, workflow, HTML/PDF, DOCX, or operational document from source evidence without freestyle redesign. Use when visual, print, behavioral, or variable-placement fidelity is required; use a separate construction process when no authoritative model exists.
---

# ERP Replicate From Source

This skill protects an approved source as a product contract. It does not license
a redesign, a generic component library, or invented document content.

## Choose the mode before coding

1. **Strict replication** — an approved source exists. Reproduce it faithfully;
   record only necessary, approved deviations.
2. **Approved adaptation** — the source conflicts with a stated technical or
   accessibility requirement. Preserve everything else and obtain approval for
   the deviation.
3. **New construction** — no authoritative model exists. Do not call it a
   replica; first agree on the design and content with the user.

## Establish the source map

Before implementation, inspect only the authoritative material relevant to the
scope: approved PDF/DOCX/HTML, screenshot, validated live route, logo asset,
font, colour, wording, workflow rule, or variable catalogue. Record a concise
map from each source path/version and visible detail to its target component or
document section.

Reuse a validated route, template, CSS, asset, or print primitive when it already
matches. Do not infer a missing logo, font, clause, field, icon, breakpoint, or
business rule from taste.

## Implement with low freedom

- Preserve wording, order, alignment, spacing, page geometry, colours, type,
  borders, logos, signatures, tables, and variable positions from the source.
- Preserve the real journey: route, input, validation, authorization,
  persistence, reload state, errors, download, preview, and print behavior.
- Use one approved icon system. Do not introduce emoji, mixed icon styles, or a
  new visual dependency for a replica.
- For documents, define paper size, print margins, page breaks, header/footer,
  print colours, and variable rendering explicitly. Keep placeholders at their
  actual source positions, not in a separate generic field list.
- If the source has no responsive variant, do not invent one silently; report the
  proposed behavior and retain desktop fidelity until it is approved.

## Prove fidelity

Use deterministic fixtures, browser, viewport, locale, timezone, and fonts for
comparison. Inspect side-by-side screenshots of each relevant state. For print,
inspect the browser preview and PDF page by page: size, count, breaks, margins,
logo, typography, colour, wording, and variable placement.

Also prove the real business path where relevant: saved data after reload,
authorized and forbidden access, failed requests, and actual export/download.
A build, mocked unit test, HTML source, or successful PDF renderer is not proof
of a faithful result.

## Stop and report

Stop before inventing a result when the source is missing, unreadable,
contradictory, or lacks required assets; when a deviation would alter a validated
workflow; or when the requested behavior extends outside approved scope. State
the exact gap, available evidence, and the decision required.
