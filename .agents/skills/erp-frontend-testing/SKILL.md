---
name: erp-frontend-testing
description: Select or review focused Vitest and React Testing Library coverage for changed behavior. Use when authoring tests or reviewing test adequacy; do not act as a general frontend quality gate.
---

## What I do

Guide frontend agents to write meaningful, resilient tests using Vitest and React Testing Library.

## Checklist

- [ ] Tests cover at least: success render, loading state, empty state, error state
- [ ] User interactions are tested via RTL fireEvent or userEvent, not by calling handlers directly
- [ ] API calls are mocked at the fetch level (msw or vi.fn), never at the component internals
- [ ] Test assertions verify visible UI output, not implementation details (no `wrapper.find` or state checks)
- [ ] Async behavior uses `waitFor` or `findBy` — not arbitrary timeouts
- [ ] Snapshot tests are used sparingly and only for stable presentational components
- [ ] No tests rely on unmocked network calls
- [ ] Test descriptions read as behavior specifications ("renders error when API fails")
- [ ] New components have a corresponding test file
- [ ] Select `L1`–`L4` from `docs/ai-agents/pr-quality-gates.md`; do not run unrelated suites
- [ ] Run a production build for shipped frontend source changes
- [ ] Use targeted Playwright only for browser-level, routing, responsive, or integration risk
- [ ] Reuse green implementer evidence during review unless reproducing a finding

## When to use me

Load during test implementation (Agent FE-A) and during test review (Agent FE-D).
