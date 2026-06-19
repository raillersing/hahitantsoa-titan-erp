---
name: react-typescript-quality
description: TypeScript strictness, React patterns, and code quality checklist for frontend components
---

## What I do

Ensure React components follow TypeScript strict mode, proper typing, and consistent ERP patterns.

## Checklist

- [ ] `tsconfig.json` strict mode is not weakened for this change
- [ ] Props are typed as a named interface, not inline or `any`
- [ ] No `@ts-ignore` or `@ts-expect-error` without documented reason
- [ ] Event handlers have typed parameters (`React.ChangeEvent`, `React.MouseEvent`, etc.)
- [ ] API responses are typed — no raw `any` casts on fetch results
- [ ] Components use functional style with hooks — no class components
- [ ] `useEffect` dependencies are explicit and correct
- [ ] Async functions in effects handle race conditions (cleanup or abort)
- [ ] Form state uses controlled components or a form library — not raw DOM refs
- [ ] No default exports — use named exports consistently
- [ ] File and folder names follow kebab-case convention
- [ ] Test files co-located or in `__tests__` matching the project convention

## When to use me

Load during implementation (Agent FE-A) and before review (Agent FE-B).