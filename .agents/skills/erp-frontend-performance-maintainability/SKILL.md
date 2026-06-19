---
name: erp-frontend-performance-maintainability
description: Checklist for render performance, bundle hygiene, and long-term maintainability of frontend code
---

## What I do

Prevent common performance regressions and ensure frontend code remains maintainable over time.

## Checklist

- [ ] Unnecessary re-renders are avoided (React.memo, useMemo, useCallback used judiciously)
- [ ] Large lists use virtualization or pagination, not full DOM rendering
- [ ] Images are sized explicitly to prevent layout shift
- [ ] No large JS bundles added without code-splitting (dynamic import)
- [ ] No inline styles unless dynamic — use CSS modules or styled approach
- [ ] CSS selectors are specific but not over-nested
- [ ] Dead or commented-out code is removed
- [ ] Component file length stays under ~400 lines; split into sub-components when larger
- [ ] Props are destructured explicitly, not spread blindly
- [ ] Side effects are isolated in hooks or effects, not in render
- [ ] Constants and types live in dedicated files, not inline
- [ ] No cyclic dependencies between modules

## When to use me

Load during final quality review or when refactoring existing components.