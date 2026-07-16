---
name: erp-frontend-error-recovery
description: Review frontend API-failure, retry, empty-state, and error-boundary behavior. Use when a change adds or modifies an error path; do not load for an unrelated final quality review.
---

## What I do

Ensure frontend code handles failures gracefully and communicates errors clearly to users.

## Checklist

- [ ] API errors show a user-friendly message, not a raw stack trace or JSON blob
- [ ] Network timeouts are handled (fetch with AbortController or a timeout wrapper)
- [ ] Error boundaries catch React render crashes and show a fallback UI
- [ ] After an error, the user can retry the action without a full page reload
- [ ] Form submission errors preserve entered data — no destructive clearing
- [ ] 401 responses redirect to login or re-authenticate, not to a blank page
- [ ] 403 responses explain the missing permission, not just "forbidden"
- [ ] Offline or degraded-network states are detected and communicated
- [ ] No unhandled promise rejections — every async call has a `.catch` or try/catch
- [ ] Console.error is used for diagnostics only, not for user-facing messages

## When to use me

Load during implementation and before final quality review.
