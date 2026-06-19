---
name: erp-security-review
description: Authorization, permission checks, data isolation, input validation, and secure-coding checklist for security-sensitive changes
---

## What I do

Ensure backend changes maintain proper authorization, data isolation, and input validation — preventing common security regressions.

## Checklist

- [ ] Every write endpoint checks authorization: `request.user` has the required permission or role
- [ ] Read endpoints filter querysets by the user's organization or tenant scope — no cross-tenant data leaks
- [ ] Input is validated against expected types and ranges — no raw user input passed to ORM filters or raw SQL
- [ ] No secrets, API keys, or credentials are logged, exposed in responses, or committed
- [ ] `transaction.atomic()` is used for writes that span multiple model changes
- [ ] No mass-assignment vulnerabilities — use serializers or explicit field whitelists, not `**request.data`
- [ ] File uploads are validated for type and size, stored outside the web root
- [ ] CSRF, XSS, and clickjacking protections are not weakened
- [ ] Rate limiting or throttling is considered for public-facing endpoints
- [ ] Agent B (Independent Backend Reviewer) reviews all security-sensitive changes

## When to use me

Load when implementing or reviewing changes that touch authorization, permissions, data isolation, input handling, or any security-sensitive logic.

## Source

- [Backend Agent Template — Agent B](../backend-agent-template.md#agent-b---independent-backend-reviewer)
- [AGENTS.md — Engineering rules](../../AGENTS.md#engineering-rules)
- [PR Quality Gates — Backend gates](../pr-quality-gates.md#backend-gates)
