---
name: frontend-state-forms
description: Form handling, validation, data fetching, and client-side state management patterns
---

## What I do

Guide agents to manage form state, validation, and data fetching in a controlled, maintainable way.

## Checklist

- [ ] Form inputs are controlled (value + onChange), not uncontrolled refs
- [ ] Validation runs on blur and on submit — not only on submit
- [ ] Validation errors are shown inline per field, not aggregated at the top only
- [ ] Required fields are marked visibly and enforced client-side before API call
- [ ] Submit button is disabled while the request is in flight (prevents double-submit)
- [ ] Form state resets after successful submission
- [ ] Optimistic updates are used only for non-critical UI — critical writes wait for API confirmation
- [ ] Shared state (user, permissions, filters) is lifted to a parent or context, not duplicated
- [ ] No direct DOM manipulation for visibility or class toggling — use React state
- [ ] URL query params for filter/sort state are preferred over component-local state when persistence matters

## When to use me

Load during form or data-fetching implementation.