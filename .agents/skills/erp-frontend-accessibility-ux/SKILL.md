---
name: erp-frontend-accessibility-ux
description: Review WCAG semantics, focus, keyboard behavior, labels, and interaction clarity. Use when visible or interactive frontend behavior changes or accessibility risk is explicitly in scope.
---

## What I do

Catch common accessibility and UX gaps before they reach review.

## Checklist

- [ ] All interactive elements have accessible names (aria-label or visible label)
- [ ] Form inputs have associated `<label>` elements
- [ ] Keyboard navigation works: Tab order is logical, no keyboard traps
- [ ] Focus is managed — moved to new content after navigation, returned after modal close
- [ ] Color is not the only differentiator for state (error, success, disabled)
- [ ] Contrast ratio meets WCAG AA minimum (4.5:1 normal text, 3:1 large)
- [ ] Live regions (aria-live) announce dynamic content changes
- [ ] Loading states show a spinner or skeleton — not just blank space
- [ ] Error messages are associated with their input via aria-describedby
- [ ] Mobile layout does not require horizontal scrolling
- [ ] Touch targets are at least 44x44px on mobile
- [ ] Empty states communicate why no data appears and what to do next

## When to use me

Load during implementation (Agent FE-A) and during UX/accessibility review (Agent FE-B, Agent FE-C).
