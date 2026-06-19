---
name: erp-frontend-testing
description: Component and page test checklist — coverage, mocking, edge cases, and regression safety for Vitest + RTL
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

## When to use me

Load during test implementation (Agent FE-A) and during test review (Agent FE-D).