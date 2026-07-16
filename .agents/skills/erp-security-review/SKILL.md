---
name: erp-security-review
description: Review broad secure-coding risks spanning input validation, isolation, uploads, browser protections, and secret handling. Use for cross-cutting security changes; use erp-backend-auth-permission-auditor alone for a permission-only backend review.
---

## What I do

Ensure backend changes maintain proper authorization, data isolation, and input validation — preventing common security regressions.

## Checklist

- [ ] Input is validated against expected types and ranges — no raw user input passed to ORM filters or raw SQL
- [ ] No secrets, API keys, or credentials are logged, exposed in responses, or committed
- [ ] `transaction.atomic()` is used for writes that span multiple model changes
- [ ] No mass-assignment vulnerabilities — use serializers or explicit field whitelists, not `**request.data`
- [ ] File uploads are validated for type and size, stored outside the web root
- [ ] CSRF, XSS, and clickjacking protections are not weakened
- [ ] Rate limiting or throttling is considered for public-facing endpoints
- [ ] Agent B (Independent Backend Reviewer) reviews all security-sensitive changes

## Source

- [Backend Agent Template — Agent B](../../../docs/ai-agents/backend-agent-template.md#agent-b---independent-backend-reviewer)
- [AGENTS.md — Engineering rules](../../../AGENTS.md#engineering-rules)
- [PR Quality Gates — Backend gates](../../../docs/ai-agents/pr-quality-gates.md#backend-gates)
